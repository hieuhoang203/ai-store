import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { InventoryPasswordService } from '../inventories/inventory-password.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  DeliveryMessagePayload,
  renderDeliveryMessage,
  renderDeliveryTelegramMessage,
} from './delivery-message';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly inventoryPasswordService: InventoryPasswordService,
    private readonly configService: ConfigService,
  ) {}

  async createDelivery(orderItemId: string, inventoryId: string) {
    return this.prisma.delivery.create({
      data: {
        orderItemId,
        inventoryId,
        deliveredAt: new Date(),
        status: DeliveryStatus.DELIVERED,
      },
    });
  }

  async generateDeliveryContent(orderId: string) {
    return renderDeliveryMessage(await this.buildDeliveryMessagePayload(orderId));
  }

  async sendOrderDeliveryMessage(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { user: true },
    });
    const payload = await this.buildDeliveryMessagePayload(orderId);
    const content = renderDeliveryMessage(payload);
    const telegramContent = renderDeliveryTelegramMessage(payload);

    await this.prisma.delivery.updateMany({
      where: {
        orderItem: { orderId },
        isDeleted: false,
      },
      data: { deliveryContent: content },
    });

    if (order.user.telegramId) {
      await this.telegramService.sendHtmlMessage(order.user.telegramId, telegramContent);
    }

    return content;
  }

  private async buildDeliveryMessagePayload(orderId: string): Promise<DeliveryMessagePayload> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
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

    return {
      orderCode: order.orderNo,
      support: {
        telegram: this.configService.get<string>('SUPPORT_TELEGRAM'),
        zalo: this.configService.get<string>('SUPPORT_ZALO'),
        email: this.configService.get<string>('SUPPORT_EMAIL'),
      },
      products: order.items.map((item) => ({
        serviceName: item.variant.product.name,
        duration: this.formatDuration(item.variant.durationDays),
        warrantyDays: item.variant.warrantyDays,
        accounts: item.deliveries.map((delivery) => ({
          email: delivery.inventory.accountEmail,
          password: this.inventoryPasswordService.decrypt(delivery.inventory.encryptedPassword),
        })),
      })),
    };
  }

  private formatDuration(durationDays: number | null) {
    if (!durationDays) return null;
    if (durationDays % 30 === 0) {
      const months = durationDays / 30;
      return `${months} Tháng`;
    }
    return `${durationDays} Ngày`;
  }
}
