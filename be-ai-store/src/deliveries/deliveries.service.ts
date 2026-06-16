import { Injectable } from '@nestjs/common';
import { DeliveryStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  async createDelivery(orderItemId: string, inventoryId: string) {
    const inventory = await this.prisma.inventory.findUniqueOrThrow({
      where: { id: inventoryId },
      include: {
        orderItems: {
          where: { id: orderItemId },
          include: { order: { include: { user: true } } },
        },
      },
    });

    const content = [
      '🎉 Đơn hàng thành công',
      '',
      `Email: ${inventory.accountEmail || ''}`,
      `Password: ${inventory.encryptedPassword || ''}`,
    ].join('\n');

    const delivery = await this.prisma.delivery.create({
      data: {
        orderItemId,
        inventoryId,
        deliveryContent: content,
        deliveredAt: new Date(),
        status: DeliveryStatus.DELIVERED,
      },
    });

    const telegramId = inventory.orderItems[0]?.order.user.telegramId;
    if (telegramId) {
      await this.telegramService.sendMessage(telegramId, content);
    }

    return delivery;
  }
}
