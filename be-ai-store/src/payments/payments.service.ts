import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { InventoriesService } from '../inventories/inventories.service';
import { BankingQrAdapter } from './adapters/banking-qr.adapter';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankingQrAdapter: BankingQrAdapter,
    private readonly inventoriesService: InventoriesService,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  async createBankingQrPayment(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const amount = order.totalAmount.toString();
    const paymentContent = this.bankingQrAdapter.createPaymentContent(order.orderNo, amount);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.BANKING_QR,
        amount: order.totalAmount,
        paymentContent,
        status: PaymentStatus.PENDING,
      },
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        qrContent: this.bankingQrAdapter.createQrContent(payment),
      },
    });
  }

  async confirmPayment(paymentId: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
      include: {
        order: { include: { items: true } },
      },
    });

    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        status: OrderStatus.PAID,
      },
    });

    for (const item of payment.order.items) {
      const inventory = await this.inventoriesService.sellFirstAvailableInventory(
        item.variantId,
        payment.order.userId,
      );

      await this.prisma.orderItem.update({
        where: { id: item.id },
        data: { inventoryId: inventory.id },
      });

      await this.deliveriesService.createDelivery(item.id, inventory.id);
    }

    return payment;
  }
}
