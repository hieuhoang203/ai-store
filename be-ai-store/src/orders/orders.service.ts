import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryPasswordService } from '../inventories/inventory-password.service';
import { InventoriesService } from '../inventories/inventories.service';
import { PAYMENT_QR_TTL_MS } from '../payments/payments.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderHistoryDto } from './dto/order-history.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
    private readonly inventoriesService: InventoriesService,
    private readonly inventoryPasswordService: InventoryPasswordService,
    private readonly configService: ConfigService,
  ) {}

  async checkout(dto: CheckoutDto) {
    const requestedItems = this.normalizeItems(dto);
    if (!requestedItems.length) {
      throw new BadRequestException('Cart is empty');
    }
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const expiresAt = new Date(Date.now() + PAYMENT_QR_TTL_MS);

    const order = await this.prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: requestedItems.map((item) => item.variantId) },
          active: true,
          isDeleted: false,
          product: { isDeleted: false, isActive: true },
        },
        include: { product: true },
      });

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      const items = requestedItems.map((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          throw new BadRequestException(`Variant ${item.variantId} is not available`);
        }

        const unitPrice = variant.sellPrice;
        const totalPrice = unitPrice.mul(item.quantity);
        return { ...item, unitPrice, totalPrice };
      });

      const subtotal = items.reduce(
        (sum, item) => sum.add(item.totalPrice),
        new Prisma.Decimal(0),
      );
      const createdOrder = await tx.order.create({
        data: {
          orderNo: `AI${this.createPayosOrderCode()}`,
          userId: user.id,
          subtotal,
          discount: new Prisma.Decimal(0),
          totalAmount: subtotal,
          items: {
            create: items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: { items: true },
      });

      const orderItemMap = new Map(createdOrder.items.map((item) => [item.variantId, item]));
      for (const item of items) {
        const reservedInventoryIds = await this.inventoriesService.reserveAvailableInventories(tx, {
          variantId: item.variantId,
          quantity: item.quantity,
          userId: user.id,
          orderId: createdOrder.id,
          reservedUntil: expiresAt,
        });
        const orderItem = orderItemMap.get(item.variantId);
        if (orderItem) {
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { inventoryId: reservedInventoryIds[0] },
          });
        }
      }

      return createdOrder;
    });

    let payment: Awaited<ReturnType<PaymentsService['createPayosPayment']>>;
    try {
      payment = await this.paymentsService.createPayosPayment(order.id, expiresAt);
    } catch (error) {
      await this.inventoriesService.releaseReservationForOrder(order.id);
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        },
      });
      throw error;
    }

    return { order, payment: this.presentPayment(payment) };
  }

  async getHistory(dto: OrderHistoryDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 10, 10);
    const where = {
      userId: user.id,
      isDeleted: false,
      OR: [
        { paymentStatus: PaymentStatus.PAID },
        { status: OrderStatus.DELIVERED },
      ],
    } satisfies Prisma.OrderWhereInput;
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
            include: {
              variant: { include: { product: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount.toString(),
        createdAt: order.createdAt,
        quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        products: order.items.map((item) => ({
          productName: item.variant.product.name,
          variantName: item.variant.name,
          quantity: item.quantity,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getDetail(orderId: string, initData: string) {
    const user = await this.authService.getOrCreateTelegramUser(initData);
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
        isDeleted: false,
        OR: [
          { paymentStatus: PaymentStatus.PAID },
          { status: OrderStatus.DELIVERED },
        ],
      },
      include: {
        payments: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: { include: { product: true } },
            deliveries: {
              where: { isDeleted: false },
              orderBy: { createdAt: 'asc' },
              include: { inventory: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const payment = order.payments[0];
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt,
      paidAt: payment?.paidAt,
      bankName: this.getBankName(payment?.qrContent),
      paymentContent: payment?.paymentContent,
      warrantyDays: this.getWarrantyDays(order.items),
      products: order.items.map((item) => ({
        productName: item.variant.product.name,
        variantName: item.variant.name,
        quantity: item.quantity,
        warrantyDays: item.variant.warrantyDays,
        accounts: item.deliveries
          .filter((delivery) => delivery.status === DeliveryStatus.DELIVERED)
          .map((delivery) => {
            const metadata = this.normalizeMetadata(delivery.inventory.metadata);
            return {
              email: delivery.inventory.accountEmail,
              username: metadata.username || delivery.inventory.accountEmail,
              password: this.inventoryPasswordService.decrypt(delivery.inventory.encryptedPassword),
              twoFactor:
                metadata.twoFactor ||
                metadata.twoFa ||
                metadata['2fa'] ||
                metadata.pass2fa ||
                null,
              deliveredAt: delivery.deliveredAt,
            };
          }),
      })),
    };
  }

  async getProfileSummary(initData: string) {
    const user = await this.authService.getOrCreateTelegramUser(initData);
    const where = {
      userId: user.id,
      isDeleted: false,
      OR: [
        { paymentStatus: PaymentStatus.PAID },
        { status: OrderStatus.DELIVERED },
      ],
    } satisfies Prisma.OrderWhereInput;
    const aggregate = await this.prisma.order.aggregate({
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId?.toString(),
        username: user.username,
        fullName: user.fullName,
      },
      stats: {
        orderCount: aggregate._count.id,
        totalSpent: aggregate._sum.totalAmount?.toString() || '0',
      },
      support: {
        telegram: this.configService.get<string>('SUPPORT_TELEGRAM') || '@hieuhv203',
      },
    };
  }

  private normalizeItems(dto: CheckoutDto) {
    const itemMap = new Map<string, number>();
    for (const item of dto.items) {
      itemMap.set(item.variantId, (itemMap.get(item.variantId) || 0) + item.quantity);
    }

    return Array.from(itemMap.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  private createPayosOrderCode() {
    return Date.now() * 100 + Math.floor(Math.random() * 100);
  }

  private presentPayment(payment: { qrContent: string | null } & Record<string, unknown>) {
    const qrContent = this.parseQrContent(payment.qrContent);
    return {
      ...payment,
      qrContent,
    };
  }

  private getWarrantyDays(
    items: Array<{ variant: { warrantyDays: number | null } }>,
  ) {
    const days = items
      .map((item) => item.variant.warrantyDays)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    return days.length ? Math.max(...days) : null;
  }

  private normalizeMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, value == null ? '' : String(value)]),
    );
  }

  private getBankName(qrContent?: string | null) {
    if (!qrContent) return null;

    try {
      const parsed = JSON.parse(qrContent) as { bin?: string; bankName?: string };
      if (parsed.bankName) return parsed.bankName;
      if (parsed.bin === '970422') return 'MB';
      return parsed.bin || null;
    } catch {
      return null;
    }
  }

  private parseQrContent(qrContent: string | null) {
    if (!qrContent) return null;
    try {
      return JSON.parse(qrContent) as unknown;
    } catch {
      return qrContent;
    }
  }
}
