import { ForbiddenException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
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

    const delivery = await this.findDeliveryByToken(token);
    const metadata = this.normalizeMetadata(delivery.metadata);
    if (delivery.trangThai !== 'DA_GIAO') throw new GoneException('Gateway link is not active');
    if (metadata.locked === true) throw new ForbiddenException('Gateway link is locked');

    const expiresAt = typeof metadata.expiresAt === 'string' ? new Date(metadata.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) throw new GoneException('Gateway link is expired');

    const maxAccess = this.toSafeInteger(metadata.maxAccess);
    const usedCount = this.toSafeInteger(metadata.usedCount);
    if (maxAccess > 0 && usedCount >= maxAccess) throw new ForbiddenException('Gateway access limit reached');

    const inviteLink = this.resolveInviteLink(metadata) || this.resolveInviteLink(this.normalizeMetadata(delivery.chiTietDonHang?.goiPhuongThuc?.cauHinh));
    const redirectUrl = this.normalizeRedirectUrl(inviteLink);
    if (!redirectUrl) throw new NotFoundException('Gateway link not found');

    await this.prisma.giaoHang.update({
      where: { id: delivery.id },
      data: {
        metadata: {
          ...metadata,
          usedCount: usedCount + 1,
          firstAccessAt: metadata.firstAccessAt || new Date().toISOString(),
          lastAccessAt: new Date().toISOString(),
          lastIp: context.ipAddress,
          lastUserAgent: context.userAgent,
        },
      },
    });
    await this.redis.client.del(this.getTokenCacheKey(token)).catch(() => undefined);
    return redirectUrl;
  }

  private async findDeliveryByToken(token: string) {
    const cacheKey = this.getTokenCacheKey(token);
    const cachedDeliveryId = await this.redis.client.get(cacheKey).catch(() => null);
    const deliveryId = cachedDeliveryId || (await this.findDeliveryIdByToken(token));
    if (!deliveryId) throw new NotFoundException('Gateway link not found');
    if (!cachedDeliveryId) await this.redis.client.set(cacheKey, deliveryId, 'EX', 300).catch(() => undefined);
    return this.prisma.giaoHang.findUniqueOrThrow({
      where: { id: deliveryId },
      include: { chiTietDonHang: { include: { goiPhuongThuc: true } } },
    });
  }

  private async findDeliveryIdByToken(token: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "giao_hang"
      WHERE "da_xoa" = false
        AND "metadata" ->> 'gatewayToken' = ${token}
      LIMIT 1
    `;
    return rows[0]?.id || null;
  }

  private async assertRateLimit(token: string, ipAddress: string) {
    const key = `gateway:rl:${token}:${ipAddress || 'unknown'}`;
    const count = await this.redis.client.incr(key).catch(() => 1);
    if (count === 1) await this.redis.client.expire(key, 60).catch(() => undefined);
    if (count > 20) throw new HttpException('Too many gateway requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  private assertTokenShape(token: string) {
    if (!/^[0-9A-Za-z]{8,64}$/.test(token)) throw new NotFoundException('Gateway link not found');
  }

  private getTokenCacheKey(token: string) {
    return `gateway:token:${token}`;
  }

  private normalizeMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {} as Record<string, unknown>;
    return metadata as Record<string, unknown>;
  }

  private resolveInviteLink(metadata: Record<string, unknown>) {
    if (typeof metadata.inviteLink === 'string' && metadata.inviteLink.trim()) {
      return metadata.inviteLink;
    }

    const encryptedInviteLink = typeof metadata.encryptedInviteLink === 'string' ? metadata.encryptedInviteLink : '';
    if (!encryptedInviteLink) return '';

    const decrypted = this.inventoryPasswordService.decrypt(encryptedInviteLink);
    if (decrypted && decrypted !== encryptedInviteLink) return decrypted;
    if (!this.inventoryPasswordService.isEncrypted(encryptedInviteLink)) return encryptedInviteLink;
    return '';
  }

  private toSafeInteger(value: unknown) {
    const number = Number(value || 0);
    return Number.isSafeInteger(number) && number > 0 ? number : 0;
  }

  private normalizeRedirectUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return null;
      }
    }
  }
}
