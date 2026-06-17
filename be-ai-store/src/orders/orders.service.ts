import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryStatus, Prisma } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
  ) {}

  async checkout(dto: CheckoutDto) {
    const requestedItems = this.normalizeItems(dto);
    if (!requestedItems.length) {
      throw new BadRequestException('Cart is empty');
    }
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);

    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: requestedItems.map((item) => item.variantId) },
        active: true,
        isDeleted: false,
        product: { isDeleted: false, isActive: true },
      },
      include: { product: true },
    });

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const inventoryCounts = await this.prisma.inventory.groupBy({
      by: ['variantId'],
      where: {
        variantId: { in: requestedItems.map((item) => item.variantId) },
        status: InventoryStatus.AVAILABLE,
        isDeleted: false,
      },
      _count: { id: true },
    });
    const inventoryCountMap = new Map(inventoryCounts.map((item) => [item.variantId, item._count.id]));

    const items = requestedItems.map((item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        throw new BadRequestException(`Variant ${item.variantId} is not available`);
      }

      const availableCount = inventoryCountMap.get(item.variantId) || 0;
      if (availableCount < item.quantity) {
        throw new BadRequestException(`${variant.name} does not have enough inventory`);
      }

      const unitPrice = variant.sellPrice;
      const totalPrice = unitPrice.mul(item.quantity);
      return { ...item, unitPrice, totalPrice };
    });

    const subtotal = items.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Prisma.Decimal(0),
    );
    const orderNo = `AI${this.createPayosOrderCode()}`;

    const order = await this.prisma.order.create({
      data: {
        orderNo,
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

    const payment = await this.paymentsService.createPayosPayment(order.id);
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
