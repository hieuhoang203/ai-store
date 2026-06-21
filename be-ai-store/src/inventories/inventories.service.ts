import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inventory, InventoryStatus, PaymentStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryPasswordService } from './inventory-password.service';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class InventoriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoriesService.name);
  private releaseExpiredReservationsTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPasswordService: InventoryPasswordService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.releaseExpiredReservationsTimer = setInterval(() => {
      void this.releaseExpiredReservations().catch((error: Error) => {
        this.logger.error(`Release expired reservations failed: ${error.message}`);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.releaseExpiredReservationsTimer) {
      clearInterval(this.releaseExpiredReservationsTimer);
    }
  }

  async reserveAvailableInventories(
    tx: TransactionClient,
    {
      variantId,
      quantity,
      userId,
      orderId,
      reservedUntil,
    }: {
      variantId: string;
      quantity: number;
      userId: string;
      orderId: string;
      reservedUntil: Date;
    },
  ) {
    const inviteInventoryIds = await this.reserveInviteLinkInventory(tx, {
      variantId,
      quantity,
      userId,
      orderId,
      reservedUntil,
    });
    if (inviteInventoryIds.length) {
      return inviteInventoryIds;
    }

    const lockedInventories = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "inventories"
      WHERE "variant_id" = ${variantId}::uuid
        AND "status" = 'AVAILABLE'::"InventoryStatus"
        AND "is_deleted" = false
      ORDER BY "created_at" ASC
      LIMIT ${quantity}
      FOR UPDATE SKIP LOCKED
    `;

    if (lockedInventories.length < quantity) {
      throw new BadRequestException('Không đủ số lượng tài khoản trong kho.');
    }

    const inventoryIds = lockedInventories.map((inventory) => inventory.id);
    await tx.inventory.updateMany({
      where: { id: { in: inventoryIds } },
      data: {
        status: InventoryStatus.RESERVED,
        reservedBy: userId,
        reservedAt: new Date(),
        reservedUntil,
        reservedOrderId: orderId,
      },
    });

    return inventoryIds;
  }

  async markReservedInventoriesSold(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const soldInviteInventories = await this.markInviteLinkReservationSold(tx, orderId);
      const inventories = await tx.inventory.findMany({
        where: {
          reservedOrderId: orderId,
          status: { in: [InventoryStatus.RESERVED, InventoryStatus.SOLD] },
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!inventories.length) {
        return soldInviteInventories;
      }

      for (const inventory of inventories.filter((item) => item.status === InventoryStatus.RESERVED)) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            status: InventoryStatus.SOLD,
            encryptedPassword: this.inventoryPasswordService.encrypt(inventory.encryptedPassword),
            deliveredAt: new Date(),
          },
        });
      }

      const standardInventories = await tx.inventory.findMany({
        where: { id: { in: inventories.map((inventory) => inventory.id) } },
        orderBy: { createdAt: 'asc' },
      });

      return [...soldInviteInventories, ...standardInventories];
    });

  }

  async releaseReservationForOrder(orderId: string) {
    const releasedInviteReservations = await this.releaseInviteLinkReservationForOrder(orderId);
    const reservedInventories = await this.prisma.inventory.findMany({
      where: {
        reservedOrderId: orderId,
        status: InventoryStatus.RESERVED,
        isDeleted: false,
      },
      select: { id: true, variantId: true },
    });

    if (!reservedInventories.length) return releasedInviteReservations;

    const released = await this.prisma.inventory.updateMany({
      where: { id: { in: reservedInventories.map((inventory) => inventory.id) } },
      data: {
        status: InventoryStatus.AVAILABLE,
        reservedBy: null,
        reservedAt: null,
        reservedUntil: null,
        reservedOrderId: null,
      },
    });

    return releasedInviteReservations + released.count;
  }

  async releaseExpiredReservations(now = new Date()) {
    const releasedInviteReservations = await this.releaseExpiredInviteLinkReservations(now);
    const expiredReservations = await this.prisma.inventory.findMany({
      where: {
        status: InventoryStatus.RESERVED,
        reservedUntil: { lt: now },
        isDeleted: false,
      },
      select: { id: true, reservedOrderId: true },
      take: 500,
    });

    if (!expiredReservations.length) return releasedInviteReservations;
    const reservedOrderIds = Array.from(
      new Set(
        expiredReservations
          .map((inventory) => inventory.reservedOrderId)
          .filter((orderId): orderId is string => Boolean(orderId)),
      ),
    );
    const ordersWithPendingPayments = reservedOrderIds.length
      ? await this.prisma.payment.findMany({
          where: {
            orderId: { in: reservedOrderIds },
            status: PaymentStatus.PENDING,
          },
          select: { orderId: true },
        })
      : [];
    const pendingOrderIds = new Set(ordersWithPendingPayments.map((payment) => payment.orderId));
    const releasableReservations = expiredReservations.filter(
      (inventory) => !inventory.reservedOrderId || !pendingOrderIds.has(inventory.reservedOrderId),
    );

    if (!releasableReservations.length) return releasedInviteReservations;

    const released = await this.prisma.inventory.updateMany({
      where: { id: { in: releasableReservations.map((inventory) => inventory.id) } },
      data: {
        status: InventoryStatus.AVAILABLE,
        reservedBy: null,
        reservedAt: null,
        reservedUntil: null,
        reservedOrderId: null,
      },
    });

    this.logger.log(`Released ${released.count} expired inventory reservations`);
    return releasedInviteReservations + released.count;
  }

  async getReservedInventoriesForOrder(orderId: string) {
    return this.prisma.inventory.findMany({
      where: {
        reservedOrderId: orderId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assertOrderHasReservedInventory(orderId: string) {
    const count = await this.prisma.inventory.count({
      where: {
        reservedOrderId: orderId,
        status: InventoryStatus.RESERVED,
        isDeleted: false,
      },
    });

    if (!count) {
      const inviteCount = await this.countInviteLinkReservationsForOrder(orderId);
      if (!inviteCount) {
        throw new NotFoundException('No reserved inventory for order');
      }
    }
  }

  async announceOutOfStockIfNeeded(variantId: string) {
    const inventoryCount = await this.prisma.inventory.count({
      where: {
        variantId,
        status: { in: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED] },
        isDeleted: false,
      },
    });

    if (inventoryCount === 0) {
      await this.notificationsService.announceVariantOutOfStock(variantId);
      return;
    }

    const inventories = await this.prisma.inventory.findMany({
      where: {
        variantId,
        status: { in: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED] },
        isDeleted: false,
      },
      select: { metadata: true, status: true },
    });
    const purchasableOrPendingCount = inventories.reduce((sum, inventory) => {
      const metadata = this.normalizeMetadata(inventory.metadata);
      if (metadata.inventoryType !== 'INVITE_LINK') return sum + 1;

      const maxUses = this.toSafeInteger(metadata.maxUses);
      const usedSlots = this.toSafeInteger(metadata.usedSlots);
      const reservedSlots = this.toReservedSlots(metadata.reservedSlots);
      const reservedCount = reservedSlots.reduce((total, slot) => total + slot.quantity, 0);
      return sum + Math.max(maxUses - usedSlots - reservedCount, 0);
    }, 0);

    if (purchasableOrPendingCount === 0) {
      await this.notificationsService.announceVariantOutOfStock(variantId);
    }
  }

  private async reserveInviteLinkInventory(
    tx: TransactionClient,
    {
      variantId,
      quantity,
      userId,
      orderId,
      reservedUntil,
    }: {
      variantId: string;
      quantity: number;
      userId: string;
      orderId: string;
      reservedUntil: Date;
    },
  ) {
    const [inventory] = await tx.$queryRaw<Array<{ id: string; metadata: Prisma.JsonValue }>>`
      SELECT "id", "metadata"
      FROM "inventories"
      WHERE "variant_id" = ${variantId}::uuid
        AND "status" = 'AVAILABLE'::"InventoryStatus"
        AND "is_deleted" = false
        AND "metadata" ->> 'inventoryType' = 'INVITE_LINK'
      ORDER BY "created_at" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (!inventory) return [];

    const metadata = this.normalizeMetadata(inventory.metadata);
    if (metadata.inventoryType !== 'INVITE_LINK') return [];

    const reservedSlots = this.cleanReservedSlots(metadata.reservedSlots, new Date());
    const maxUses = this.toSafeInteger(metadata.maxUses);
    const usedSlots = this.toSafeInteger(metadata.usedSlots);
    const reservedCount = reservedSlots.reduce((sum, slot) => sum + slot.quantity, 0);

    if (maxUses <= 0 || maxUses - usedSlots - reservedCount < quantity) {
      throw new BadRequestException('Không đủ số lượng tài khoản trong kho.');
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        metadata: {
          ...metadata,
          usedSlots,
          reservedSlots: [
            ...reservedSlots,
            {
              orderId,
              userId,
              quantity,
              reservedAt: new Date().toISOString(),
              reservedUntil: reservedUntil.toISOString(),
            },
          ],
        },
      },
    });

    return Array.from({ length: quantity }, () => inventory.id);
  }

  private async markInviteLinkReservationSold(tx: TransactionClient, orderId: string) {
    const inventories = await tx.$queryRaw<Array<{ id: string; metadata: Prisma.JsonValue }>>`
      SELECT "id", "metadata"
      FROM "inventories"
      WHERE "status" = 'AVAILABLE'::"InventoryStatus"
        AND "is_deleted" = false
        AND "metadata" ->> 'inventoryType' = 'INVITE_LINK'
      FOR UPDATE
    `;
    const soldInventories: Inventory[] = [];

    for (const inventory of inventories) {
      const metadata = this.normalizeMetadata(inventory.metadata);
      const reservedSlots = this.cleanReservedSlots(metadata.reservedSlots, new Date());
      const matchingSlots = reservedSlots.filter((slot) => slot.orderId === orderId);
      if (!matchingSlots.length) continue;

      const quantity = matchingSlots.reduce((sum, slot) => sum + slot.quantity, 0);
      const usedSlots = this.toSafeInteger(metadata.usedSlots) + quantity;
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          metadata: {
            ...metadata,
            usedSlots,
            reservedSlots: reservedSlots.filter((slot) => slot.orderId !== orderId),
            lastSoldAt: new Date().toISOString(),
          },
        },
      });

      const updated = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
      soldInventories.push(...Array.from({ length: quantity }, () => updated));
    }

    return soldInventories;
  }

  private async releaseInviteLinkReservationForOrder(orderId: string) {
    const released = await this.prisma.$transaction(async (tx) => {
      const inventories = await tx.$queryRaw<Array<{ id: string; metadata: Prisma.JsonValue }>>`
        SELECT "id", "metadata"
        FROM "inventories"
        WHERE "status" = 'AVAILABLE'::"InventoryStatus"
          AND "is_deleted" = false
          AND "metadata" ->> 'inventoryType' = 'INVITE_LINK'
        FOR UPDATE
      `;
      let released = 0;

      for (const inventory of inventories) {
        const metadata = this.normalizeMetadata(inventory.metadata);
        const reservedSlots = this.cleanReservedSlots(metadata.reservedSlots, new Date());
        const nextReservedSlots = reservedSlots.filter((slot) => slot.orderId !== orderId);
        released += reservedSlots.length - nextReservedSlots.length;
        if (nextReservedSlots.length === reservedSlots.length) continue;

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { metadata: { ...metadata, reservedSlots: nextReservedSlots } },
        });
      }

      return released;
    });

    return released || 0;
  }

  private async releaseExpiredInviteLinkReservations(now: Date) {
    const released = await this.prisma.$transaction(async (tx) => {
      const inventories = await tx.$queryRaw<Array<{ id: string; metadata: Prisma.JsonValue }>>`
        SELECT "id", "metadata"
        FROM "inventories"
        WHERE "status" = 'AVAILABLE'::"InventoryStatus"
          AND "is_deleted" = false
          AND "metadata" ->> 'inventoryType' = 'INVITE_LINK'
        FOR UPDATE
      `;
      let released = 0;

      for (const inventory of inventories) {
        const metadata = this.normalizeMetadata(inventory.metadata);
        const reservedSlots = this.toReservedSlots(metadata.reservedSlots);
        const nextReservedSlots = this.cleanReservedSlots(reservedSlots, now);
        released += reservedSlots.length - nextReservedSlots.length;
        if (nextReservedSlots.length === reservedSlots.length) continue;

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { metadata: { ...metadata, reservedSlots: nextReservedSlots } },
        });
      }

      return released;
    });

    return released || 0;
  }

  private async countInviteLinkReservationsForOrder(orderId: string) {
    const inventories = await this.prisma.inventory.findMany({
      where: {
        status: InventoryStatus.AVAILABLE,
        isDeleted: false,
      },
      select: { metadata: true },
    });

    return inventories.filter((inventory) =>
      this.toReservedSlots(this.normalizeMetadata(inventory.metadata).reservedSlots).some(
        (slot) => slot.orderId === orderId,
      ),
    ).length;
  }

  private normalizeMetadata(metadata: Prisma.JsonValue | unknown) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, unknown>;
    }

    return metadata as Record<string, unknown>;
  }

  private toReservedSlots(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .map((slot) => {
        if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return null;
        const record = slot as Record<string, unknown>;
        const orderId = typeof record.orderId === 'string' ? record.orderId : '';
        const userId = typeof record.userId === 'string' ? record.userId : '';
        const quantity = this.toSafeInteger(record.quantity);
        const reservedAt = typeof record.reservedAt === 'string' ? record.reservedAt : new Date().toISOString();
        const reservedUntil = typeof record.reservedUntil === 'string' ? record.reservedUntil : '';

        if (!orderId || !quantity || !reservedUntil) return null;
        return { orderId, userId, quantity, reservedAt, reservedUntil };
      })
      .filter((slot): slot is { orderId: string; userId: string; quantity: number; reservedAt: string; reservedUntil: string } => Boolean(slot));
  }

  private cleanReservedSlots(value: unknown, now: Date) {
    return this.toReservedSlots(value).filter(
      (slot) => new Date(slot.reservedUntil).getTime() > now.getTime(),
    );
  }

  private toSafeInteger(value: unknown) {
    const number = Number(value || 0);
    return Number.isSafeInteger(number) && number > 0 ? number : 0;
  }
}
