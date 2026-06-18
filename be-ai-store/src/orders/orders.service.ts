import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { InventoriesService } from '../inventories/inventories.service';
import { PAYMENT_QR_TTL_MS } from '../payments/payments.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
    private readonly inventoriesService: InventoriesService,
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

    await Promise.all(
      requestedItems.map((item) => this.inventoriesService.announceOutOfStockIfNeeded(item.variantId)),
    );

    return { order, payment: this.presentPayment(payment) };
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

  private parseQrContent(qrContent: string | null) {
    if (!qrContent) return null;
    try {
      return JSON.parse(qrContent) as unknown;
    } catch {
      return qrContent;
    }
  }
}
