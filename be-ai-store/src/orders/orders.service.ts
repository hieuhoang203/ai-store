import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async checkout(dto: CheckoutDto) {
    if (!dto.items.length) {
      throw new BadRequestException('Cart is empty');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: dto.items.map((item) => item.variantId) },
        active: true,
        isDeleted: false,
      },
    });

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const items = dto.items.map((item) => {
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
    const orderNo = `AI${Date.now()}`;

    const order = await this.prisma.order.create({
      data: {
        orderNo,
        userId: dto.userId,
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

    const payment = await this.paymentsService.createBankingQrPayment(order.id);
    return { order, payment };
  }
}
