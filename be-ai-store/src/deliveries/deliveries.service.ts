import { Injectable } from '@nestjs/common';
import { DeliveryStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { InventoryPasswordService } from '../inventories/inventory-password.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly inventoryPasswordService: InventoryPasswordService,
  ) {}

  async createDelivery(orderItemId: string, inventoryId: string) {
    const [inventory, orderItem] = await Promise.all([
      this.prisma.inventory.findUniqueOrThrow({
        where: { id: inventoryId },
      }),
      this.prisma.orderItem.findUniqueOrThrow({
        where: { id: orderItemId },
        include: { order: { include: { user: true } } },
      }),
    ]);

    const content = [
      '🎉 Đơn hàng thành công',
      '',
      `Email: ${inventory.accountEmail || ''}`,
      `Password: ${this.inventoryPasswordService.decrypt(inventory.encryptedPassword)}`,
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

    const telegramId = orderItem.order.user.telegramId;
    if (telegramId) {
      await this.telegramService.sendMessage(telegramId, content);
    }

    return delivery;
  }
}
