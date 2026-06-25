import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Order,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  Product,
  ProductVariant,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { InventoriesService } from '../inventories/inventories.service';
import { PayosService } from './payos/payos.service';
import { PayosWebhookBody } from './payos/payos.types';

type OrderForPayment = Order & {
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
    variant: ProductVariant & { product: Product };
  }>;
};

export const PAYMENT_QR_TTL_MS = 3 * 60 * 1000;

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private expiredPaymentTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly inventoriesService: InventoriesService,
    private readonly deliveriesService: DeliveriesService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.expiredPaymentTimer = setInterval(() => {
      void this.processExpiredPendingPayments().catch((error: Error) => {
        this.logger.error(`Process expired pending payments failed: ${error.message}`);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.expiredPaymentTimer) {
      clearInterval(this.expiredPaymentTimer);
    }
  }

  async createPayosPayment(orderId: string, expiresAt: Date) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    const amount = this.toVndInteger(order.totalAmount);
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.BANKING_QR,
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
      },
    });
    const paymentContent = this.createPaymentContent(order.orderNo);

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { paymentContent },
    });

    try {
      const paymentLink = await this.payosService.createPaymentLink({
        orderCode: this.getPayosOrderCode(order.orderNo),
        amount,
        description: paymentContent,
        items: this.toPayosItems(order),
        returnUrl: this.getMiniAppUrl('payment=success'),
        cancelUrl: this.getMiniAppUrl('payment=cancelled'),
        expiredAt: Math.floor(expiresAt.getTime() / 1000),
      });

      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionNo: paymentLink.paymentLinkId,
          qrContent: JSON.stringify({
            provider: 'PAYOS',
            amount: paymentLink.amount,
            currency: paymentLink.currency,
            content: paymentLink.description,
            orderCode: paymentLink.orderCode,
            paymentLinkId: paymentLink.paymentLinkId,
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode,
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
            bin: paymentLink.bin,
            expiresAt: expiresAt.toISOString(),
          }),
        },
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw error;
    }
  }

  async handlePayosWebhook(body: PayosWebhookBody) {
    const data = this.payosService.verifyWebhook(body);

    if (!body.success || body.code !== '00' || data.code !== '00') {
      await this.expirePaymentByOrderCode(Number(data.orderCode));
      return { ok: true };
    }

    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);
    const paymentLinkId = String(data.paymentLinkId || '');
    const description = String(data.description || '');

    if (!Number.isSafeInteger(orderCode) || amount <= 0 || !paymentLinkId) {
      throw new BadRequestException('Invalid payOS webhook data');
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: `AI${orderCode}` },
      include: { payments: true },
    });

    if (!order) {
      return { ok: true, ignored: 'ORDER_NOT_FOUND' };
    }

    const payment = order.payments.find((record) => record.transactionNo === paymentLinkId);

    if (!payment) {
      throw new BadRequestException('Payment link does not match order');
    }

    if (this.toVndInteger(payment.amount) !== amount) {
      throw new BadRequestException('Payment amount does not match order amount');
    }

    if (payment.paymentContent !== description) {
      throw new BadRequestException('Payment description does not match');
    }

    await this.confirmPayment(payment.id);
    return { ok: true };
  }

  async confirmPayment(paymentId: string) {
    const updated = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    });

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            items: {
              include: {
                deliveries: {
                  where: { isDeleted: false },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!updated.count && payment.order.status === OrderStatus.DELIVERED) {
      return payment;
    }

    if (!updated.count && payment.status !== PaymentStatus.PAID) {
      return payment;
    }

    if (updated.count || payment.order.status !== OrderStatus.PAID) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.PAID,
        },
      });
    }

    const soldInventories = await this.inventoriesService.markReservedInventoriesSold(payment.orderId);
    const soldInventoriesByVariant = new Map<string, typeof soldInventories>();
    for (const inventory of soldInventories) {
      const inventories = soldInventoriesByVariant.get(inventory.variantId) || [];
      inventories.push(inventory);
      soldInventoriesByVariant.set(inventory.variantId, inventories);
    }

    for (const item of payment.order.items) {
      const hasSupplier = await this.prisma.supplierVariant.count({
        where: {
          variantId: item.variantId,
          active: true,
          supplier: { active: true },
        },
      });
      if (hasSupplier > 0) {
        continue;
      }

      const existingDeliveryInventoryIds = new Set(item.deliveries.map((delivery) => delivery.inventoryId));
      const inventories = soldInventoriesByVariant.get(item.variantId) || [];
      const missingInventories = inventories
        .filter((inventory) => !existingDeliveryInventoryIds.has(inventory.id))
        .slice(0, Math.max(item.quantity - item.deliveries.length, 0));

      for (let index = 0; index < missingInventories.length; index += 1) {
        const inventory = missingInventories[index];
        if (!item.inventoryId && index === 0 && inventory) {
          await this.prisma.orderItem.update({
            where: { id: item.id },
            data: { inventoryId: inventory.id },
          });
        }

        if (inventory) {
          await this.deliveriesService.createDelivery(item.id, inventory.id);
        }
      }

      if (item.deliveries.length + missingInventories.length < item.quantity) {
        throw new BadRequestException('Reserved inventory is missing for paid order');
      }
    }

    await this.inventoriesService.createSupplierRequestsForPaidOrder(payment.orderId);

    let hasAnySupplierItem = false;
    for (const item of payment.order.items) {
      const hasSupplier = await this.prisma.supplierVariant.count({
        where: {
          variantId: item.variantId,
          active: true,
          supplier: { active: true },
        },
      });
      if (hasSupplier > 0) {
        hasAnySupplierItem = true;
        break;
      }
    }

    if (!hasAnySupplierItem) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.DELIVERED },
      });
      await this.deliveriesService.sendOrderDeliveryMessage(payment.orderId);
    }

    await Promise.all(
      Array.from(new Set(payment.order.items.map((item) => item.variantId))).map((variantId) =>
        this.inventoriesService.announceOutOfStockIfNeeded(variantId),
      ),
    );

    return payment;
  }

  async getPaymentStatus(paymentId: string) {
    await this.syncPendingPayosPayment(paymentId);
    await this.expirePendingPayment(paymentId);

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            items: {
              include: {
                variant: { include: { product: true } },
                deliveries: {
                  where: { isDeleted: false },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    const deliveryMessage =
      payment.order.status === OrderStatus.DELIVERED
        ? await this.deliveriesService.generateDeliveryContent(payment.orderId)
        : null;

    return {
      payment: {
        id: payment.id,
        status: payment.status,
        paidAt: payment.paidAt,
        expiresAt: this.getPaymentExpiresAt(payment),
      },
      order: {
        id: payment.order.id,
        orderNo: payment.order.orderNo,
        status: payment.order.status,
        paymentStatus: payment.order.paymentStatus,
      },
      deliveries: payment.order.items.flatMap((item) =>
        item.deliveries.map((delivery) => ({
          id: delivery.id,
          status: delivery.status,
          deliveredAt: delivery.deliveredAt,
          content: delivery.deliveryContent,
          productName: item.variant.product.name,
          variantName: item.variant.name,
        })),
      ),
      deliveryMessage,
    };
  }

  async expireOrderPendingPayments(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: PaymentStatus.PENDING },
          select: { id: true },
        },
      },
    });

    if (!order) return;

    await Promise.all(order.payments.map((payment) => this.expirePayment(payment.id)));
  }

  private async syncPendingPayosPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });

    if (payment.status !== PaymentStatus.PENDING || payment.provider !== PaymentProvider.BANKING_QR) {
      return;
    }

    const orderCode = this.getPayosOrderCode(payment.order.orderNo);

    try {
      const paymentLink = await this.payosService.getPaymentLink(orderCode);
      if (paymentLink.status !== 'PAID') {
        return;
      }

      if (this.toVndInteger(payment.amount) !== Number(paymentLink.amount)) {
        throw new BadRequestException('Payment amount does not match payOS payment link');
      }

      await this.confirmPayment(payment.id);
    } catch (error) {
      this.logger.warn(
        `Cannot sync payOS payment ${payment.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async processExpiredPendingPayments() {
    const candidates = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: new Date(Date.now() - PAYMENT_QR_TTL_MS) },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    for (const candidate of candidates) {
      await this.syncPendingPayosPayment(candidate.id);
      await this.expirePendingPayment(candidate.id);
    }
  }

  private async expirePendingPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    if (payment.status !== PaymentStatus.PENDING || !this.isExpiredPayment(payment)) {
      return;
    }

    await this.expirePayment(payment.id);
  }

  private async expirePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) return { count: 0 };

    const updated = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
      },
      data: { status: PaymentStatus.FAILED },
    });

    if (updated.count) {
      await this.inventoriesService.releaseReservationForOrder(payment.orderId);
      await this.prisma.order.updateMany({
        where: {
          id: payment.orderId,
          status: OrderStatus.PENDING_PAYMENT,
        },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        },
      });
    }

    return updated;
  }

  private async expirePaymentByOrderCode(orderCode: number) {
    if (!Number.isSafeInteger(orderCode)) return;

    const order = await this.prisma.order.findUnique({
      where: { orderNo: `AI${orderCode}` },
      include: { payments: true },
    });

    if (!order) return;

    await Promise.all(
      order.payments
        .filter((payment) => payment.status === PaymentStatus.PENDING)
        .map((payment) => this.expirePayment(payment.id)),
    );
  }

  private isExpiredPayment(payment: { qrContent: string | null }) {
    const expiresAt = this.getPaymentExpiresAt(payment);
    return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  }

  private getPaymentExpiresAt(payment: { qrContent: string | null }) {
    const qrContent = this.parseQrContent(payment.qrContent);
    if (!qrContent || typeof qrContent !== 'object' || !('expiresAt' in qrContent)) {
      return null;
    }

    const expiresAt = (qrContent as { expiresAt?: unknown }).expiresAt;
    return typeof expiresAt === 'string' ? expiresAt : null;
  }

  private parseQrContent(qrContent: string | null) {
    if (!qrContent) return null;

    try {
      return JSON.parse(qrContent) as unknown;
    } catch {
      return null;
    }
  }

  private createPaymentContent(orderNo: string) {
    const maxDescriptionLength = 25;
    const orderCode = orderNo.replace(/^AI/, '');
    const configuredPrefix = this.configService.get<string>('PAYOS_PAYMENT_DESCRIPTION_PREFIX') || 'AI Store';
    const prefix = configuredPrefix.trim() || 'AI Store';
    const suffix = orderCode.slice(-15);
    const maxPrefixLength = Math.max(maxDescriptionLength - suffix.length - 1, 1);

    return `${prefix.slice(0, maxPrefixLength)} ${suffix}`.slice(0, maxDescriptionLength);
  }

  private getPayosOrderCode(orderNo: string) {
    const orderCode = Number(orderNo.replace(/^AI/, ''));
    if (!Number.isSafeInteger(orderCode)) {
      throw new BadRequestException('Invalid order code');
    }
    return orderCode;
  }

  private toPayosItems(order: OrderForPayment) {
    return order.items.map((item) => ({
      name: `${item.variant.product.name} - ${item.variant.name}`.slice(0, 255),
      quantity: item.quantity,
      price: this.toVndInteger(item.unitPrice),
    }));
  }

  private toVndInteger(value: Prisma.Decimal) {
    const integer = value.toDecimalPlaces(0);
    if (!integer.equals(value)) {
      throw new BadRequestException('Payment amount must be an integer VND amount');
    }
    const amount = integer.toNumber();
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }
    return amount;
  }

  private getMiniAppUrl(paymentStatus: string) {
    const miniAppUrl = this.configService.get<string>('TELEGRAM_MINIAPP_URL') || 'http://localhost:405';
    const separator = miniAppUrl.includes('?') ? '&' : '?';
    return `${miniAppUrl}${separator}${paymentStatus}`;
  }
}
