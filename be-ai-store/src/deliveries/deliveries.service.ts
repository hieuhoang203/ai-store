import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { AuditAction, DeliveryStatus, NotificationType, Prisma } from '../../generated/prisma/client.js';
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
    const inventory = await this.prisma.inventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });
    const inventoryMetadata = this.normalizeMetadata(inventory.metadata);

    if (inventoryMetadata.inventoryType === 'INVITE_LINK') {
      const gatewayToken = await this.createUniqueGatewayToken();
      const gatewayUrl = this.buildGatewayUrl(gatewayToken);
      const now = new Date();

      const delivery = await this.prisma.delivery.create({
        data: {
          orderItemId,
          inventoryId,
          deliveredAt: now,
          status: DeliveryStatus.DELIVERED,
          deliveryContent: gatewayUrl,
          metadata: {
            deliveryType: 'LINK_GATEWAY',
            gatewayToken,
            gatewayUrl,
            usedCount: 0,
            maxAccess: this.toSafeInteger(inventoryMetadata.gatewayMaxAccess) || 3,
            firstAccessAt: null,
            lastAccessAt: null,
            expiresAt: this.getGatewayExpiresAt(inventoryMetadata),
            locked: false,
            lockReason: null,
            generatedAt: now.toISOString(),
          },
        },
      });
      await this.logGatewayGenerated(delivery.id, orderItemId, inventoryId, gatewayToken);
      await this.notifyDeliverySuccess(orderItemId, gatewayUrl);
      return delivery;
    }

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
              password: this.isInviteLinkDelivery(delivery)
                ? null
                : this.inventoryPasswordService.decrypt(delivery.inventory.encryptedPassword),
              gatewayUrl: this.getGatewayUrl(delivery.metadata),
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

  private async createUniqueGatewayToken() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const token = this.createGatewayToken();
      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "deliveries"
        WHERE "metadata" ->> 'gatewayToken' = ${token}
        LIMIT 1
      `;

      if (!existing.length) return token;
    }

    throw new Error('Cannot generate unique gateway token');
  }

  private createGatewayToken(length = 12) {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
  }

  private buildGatewayUrl(token: string) {
    const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'http://localhost:8903';
    return `${publicUrl.replace(/\/$/, '')}/join/${token}`;
  }

  private getGatewayExpiresAt(metadata: Record<string, unknown>) {
    if (typeof metadata.gatewayExpiresAt === 'string') return metadata.gatewayExpiresAt;

    const days = this.toSafeInteger(metadata.gatewayTtlDays) || 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  private isInviteLinkDelivery(delivery: { metadata: Prisma.JsonValue | null }) {
    return this.normalizeMetadata(delivery.metadata).deliveryType === 'LINK_GATEWAY';
  }

  private getGatewayUrl(metadata: Prisma.JsonValue | null) {
    const normalized = this.normalizeMetadata(metadata);
    return typeof normalized.gatewayUrl === 'string' ? normalized.gatewayUrl : null;
  }

  private normalizeMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, unknown>;
    }

    return metadata as Record<string, unknown>;
  }

  private toSafeInteger(value: unknown) {
    const number = Number(value || 0);
    return Number.isSafeInteger(number) && number > 0 ? number : 0;
  }

  private async logGatewayGenerated(
    deliveryId: string,
    orderItemId: string,
    inventoryId: string,
    gatewayToken: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        entityName: 'gateway',
        entityId: deliveryId,
        action: AuditAction.CREATE,
        newData: {
          eventType: 'GATEWAY_GENERATED',
          deliveryId,
          orderItemId,
          inventoryId,
          gatewayToken,
        },
      },
    });
  }

  private async notifyDeliverySuccess(orderItemId: string, gatewayUrl: string) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });
    if (!orderItem) return;

    await this.prisma.notification.create({
      data: {
        userId: orderItem.order.userId,
        type: NotificationType.DELIVERY,
        title: 'Giao hàng thành công',
        content: `Đơn hàng đã được giao thành công.\nLink nhận dịch vụ: ${gatewayUrl}`,
      },
    });
  }
}
