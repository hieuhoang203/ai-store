import { ForbiddenException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DeliveryStatus,
  NotificationType,
  Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { InventoryPasswordService } from '../inventories/inventory-password.service';
import { RedisService } from '../redis/redis.service';

type AccessContext = {
  ipAddress: string;
  userAgent: string;
};

@Injectable()
export class GatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly inventoryPasswordService: InventoryPasswordService,
  ) {}

  async access(token: string, context: AccessContext) {
    this.assertTokenShape(token);
    await this.assertRateLimit(token, context.ipAddress);

    const gateway = await this.findGatewayByToken(token);
    const metadata = this.normalizeMetadata(gateway.payload as Prisma.JsonValue);

    await this.assertGatewayUsable(gateway, metadata, context);

    const encryptedInviteLink = String(metadata.encryptedInviteLink || '');
    if (!encryptedInviteLink) {
      await this.logGatewayEvent('GATEWAY_MISSING_INVITE_LINK', gateway.id, context, { token });
      throw new NotFoundException('Gateway link not found');
    }

    const inviteLink = this.inventoryPasswordService.decrypt(encryptedInviteLink);
    if (!inviteLink) {
      await this.logGatewayEvent('GATEWAY_MISSING_INVITE_LINK', gateway.id, context, { token });
      throw new GoneException('Gateway link is unavailable');
    }

    await this.recordAccess(gateway, metadata, context);
    await this.redis.client.del(this.getTokenCacheKey(token)).catch(() => undefined);
    return inviteLink;
  }

  private async findGatewayByToken(token: string) {
    const cacheKey = this.getTokenCacheKey(token);
    const cachedGatewayId = await this.redis.client.get(cacheKey).catch(() => null);
    const gatewayId = cachedGatewayId || await this.findGatewayIdByToken(token);

    if (!gatewayId) {
      throw new NotFoundException('Gateway link not found');
    }

    if (!cachedGatewayId) {
      await this.redis.client.set(cacheKey, gatewayId, 'EX', 300).catch(() => undefined);
    }

    if (gatewayId.startsWith('resource:')) {
      const id = gatewayId.replace(/^resource:/, '');
      const resource = await this.prisma.fulfillmentResource.findUniqueOrThrow({
        where: { id },
        include: {
          fulfillment: {
            include: {
              orderItem: {
                include: { order: true },
              },
            },
          },
        },
      });

      return {
        id: resource.id,
        kind: 'resource' as const,
        status: resource.fulfillment.status,
        payload: resource.payload,
        userId: resource.fulfillment.orderItem.order.userId,
      };
    }

    const delivery = await this.findDeliveryByToken(token);
    return {
      id: delivery.id,
      kind: 'delivery' as const,
      status: delivery.status,
      payload: {
        ...this.normalizeMetadata(delivery.metadata),
        encryptedInviteLink: String(this.normalizeMetadata(delivery.inventory.metadata).encryptedInviteLink || ''),
      } as Prisma.JsonObject,
      userId: delivery.orderItem.order.userId,
    };
  }

  private async findGatewayIdByToken(token: string) {
    const resourceRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "fulfillment_resources"
      WHERE "payload" ->> 'gatewayToken' = ${token}
      LIMIT 1
    `;
    if (resourceRows[0]?.id) {
      return `resource:${resourceRows[0].id}`;
    }

    const deliveryId = await this.findDeliveryIdByToken(token);
    return deliveryId ? `delivery:${deliveryId}` : null;
  }

  private async findDeliveryByToken(token: string) {
    const cacheKey = this.getTokenCacheKey(token);
    const cachedDeliveryId = await this.redis.client.get(cacheKey).catch(() => null);
    const deliveryId = cachedDeliveryId || await this.findDeliveryIdByToken(token);

    if (!deliveryId) {
      throw new NotFoundException('Gateway link not found');
    }

    if (!cachedDeliveryId) {
      await this.redis.client.set(cacheKey, deliveryId, 'EX', 300).catch(() => undefined);
    }

    return this.prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId.replace(/^delivery:/, '') },
      include: {
        inventory: true,
        orderItem: {
          include: {
            order: true,
          },
        },
      },
    });
  }

  private async findDeliveryIdByToken(token: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "deliveries"
      WHERE "is_deleted" = false
        AND "metadata" ->> 'gatewayToken' = ${token}
      LIMIT 1
    `;

    return rows[0]?.id || null;
  }

  private async assertDeliveryUsable(
    delivery: Awaited<ReturnType<GatewayService['findDeliveryByToken']>>,
    metadata: Record<string, unknown>,
    context: AccessContext,
  ) {
    if (delivery.status !== DeliveryStatus.DELIVERED || metadata.deliveryType !== 'LINK_GATEWAY') {
      await this.logGatewayEvent('GATEWAY_NOT_DELIVERED', delivery.id, context);
      throw new GoneException('Gateway link is not active');
    }

    if (metadata.locked === true) {
      await this.logGatewayEvent('GATEWAY_LOCKED', delivery.id, context, {
        lockReason: metadata.lockReason || null,
      });
      await this.notifyUser(delivery.orderItem.order.userId, 'Link nhận dịch vụ đã tạm khóa vì lý do bảo mật.');
      throw new ForbiddenException('Gateway link is locked');
    }

    const expiresAt = typeof metadata.expiresAt === 'string' ? new Date(metadata.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await this.logGatewayEvent('GATEWAY_EXPIRED', delivery.id, context, {
        expiresAt: metadata.expiresAt,
      });
      await this.notifyUser(delivery.orderItem.order.userId, 'Link nhận dịch vụ của bạn đã hết hạn.');
      throw new GoneException('Gateway link is expired');
    }

    const usedCount = this.toSafeInteger(metadata.usedCount);
    const maxAccess = this.toSafeInteger(metadata.maxAccess);
    if (maxAccess > 0 && usedCount >= maxAccess) {
      await this.logGatewayEvent('GATEWAY_MAX_ACCESS_REACHED', delivery.id, context, {
        usedCount,
        maxAccess,
      });
      throw new ForbiddenException('Gateway access limit reached');
    }
  }

  private async assertGatewayUsable(
    gateway: Awaited<ReturnType<GatewayService['findGatewayByToken']>>,
    metadata: Record<string, unknown>,
    context: AccessContext,
  ) {
    const isDelivered =
      gateway.kind === 'resource'
        ? gateway.status === 'DELIVERED'
        : gateway.status === DeliveryStatus.DELIVERED;
    if (!isDelivered || metadata.deliveryType !== 'LINK_GATEWAY') {
      await this.logGatewayEvent('GATEWAY_NOT_DELIVERED', gateway.id, context);
      throw new GoneException('Gateway link is not active');
    }

    if (metadata.locked === true) {
      await this.logGatewayEvent('GATEWAY_LOCKED', gateway.id, context, {
        lockReason: metadata.lockReason || null,
      });
      await this.notifyUser(gateway.userId, 'Link nhan dich vu da tam khoa vi ly do bao mat.');
      throw new ForbiddenException('Gateway link is locked');
    }

    const expiresAt = typeof metadata.expiresAt === 'string' ? new Date(metadata.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await this.logGatewayEvent('GATEWAY_EXPIRED', gateway.id, context, {
        expiresAt: metadata.expiresAt,
      });
      await this.notifyUser(gateway.userId, 'Link nhan dich vu cua ban da het han.');
      throw new GoneException('Gateway link is expired');
    }

    const usedCount = this.toSafeInteger(metadata.usedCount);
    const maxAccess = this.toSafeInteger(metadata.maxAccess);
    if (maxAccess > 0 && usedCount >= maxAccess) {
      await this.logGatewayEvent('GATEWAY_MAX_ACCESS_REACHED', gateway.id, context, {
        usedCount,
        maxAccess,
      });
      throw new ForbiddenException('Gateway access limit reached');
    }
  }

  private async recordAccess(
    gateway: Awaited<ReturnType<GatewayService['findGatewayByToken']>>,
    metadata: Record<string, unknown>,
    context: AccessContext,
  ) {
    const now = new Date().toISOString();
    const usedCount = this.toSafeInteger(metadata.usedCount) + 1;
    const nextMetadata = {
      ...metadata,
      usedCount,
      firstAccessAt: metadata.firstAccessAt || now,
      lastAccessAt: now,
    };

    if (gateway.kind === 'resource') {
      await this.prisma.fulfillmentResource.update({
        where: { id: gateway.id },
        data: { payload: nextMetadata },
      });
    } else {
      await this.prisma.delivery.update({
        where: { id: gateway.id },
        data: { metadata: nextMetadata },
      });
    }
    await this.logGatewayEvent('GATEWAY_ACCESSED', gateway.id, context, {
      usedCount,
    });
  }

  private async assertRateLimit(token: string, ipAddress: string) {
    const key = `gateway:rl:${token}:${ipAddress || 'unknown'}`;
    const count = await this.redis.client.incr(key).catch(() => 1);
    if (count === 1) {
      await this.redis.client.expire(key, 60).catch(() => undefined);
    }

    if (count > 20) {
      throw new HttpException('Too many gateway requests', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async logGatewayEvent(
    eventType: string,
    deliveryId: string,
    context: AccessContext,
    extra: Record<string, unknown> = {},
  ) {
    await this.prisma.auditLog.create({
      data: {
        entityName: 'gateway',
        entityId: deliveryId,
        action: eventType === 'GATEWAY_GENERATED' ? AuditAction.CREATE : AuditAction.UPDATE,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        newData: {
          eventType,
          deliveryId,
          ...extra,
        },
      },
    });
  }

  private async notifyUser(userId: string, content: string) {
    await this.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.DELIVERY,
        title: 'Link nhận dịch vụ',
        content,
      },
    });
  }

  private assertTokenShape(token: string) {
    if (!/^[0-9A-Za-z]{8,32}$/.test(token)) {
      throw new NotFoundException('Gateway link not found');
    }
  }

  private getTokenCacheKey(token: string) {
    return `gateway:token:${token}`;
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
}
