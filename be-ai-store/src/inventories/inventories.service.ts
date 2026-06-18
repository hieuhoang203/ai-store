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
      const inventories = await tx.inventory.findMany({
        where: {
          reservedOrderId: orderId,
          status: { in: [InventoryStatus.RESERVED, InventoryStatus.SOLD] },
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!inventories.length) {
        return [] as Inventory[];
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

      return tx.inventory.findMany({
        where: { id: { in: inventories.map((inventory) => inventory.id) } },
        orderBy: { createdAt: 'asc' },
      });
    });

  }

  async releaseReservationForOrder(orderId: string) {
    const reservedInventories = await this.prisma.inventory.findMany({
      where: {
        reservedOrderId: orderId,
        status: InventoryStatus.RESERVED,
        isDeleted: false,
      },
      select: { id: true, variantId: true },
    });

    if (!reservedInventories.length) return 0;

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

    return released.count;
  }

  async releaseExpiredReservations(now = new Date()) {
    const expiredReservations = await this.prisma.inventory.findMany({
      where: {
        status: InventoryStatus.RESERVED,
        reservedUntil: { lt: now },
        isDeleted: false,
      },
      select: { id: true, reservedOrderId: true },
      take: 500,
    });

    if (!expiredReservations.length) return 0;
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

    if (!releasableReservations.length) return 0;

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
    return released.count;
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
      throw new NotFoundException('No reserved inventory for order');
    }
  }

  async announceOutOfStockIfNeeded(variantId: string) {
    const availableCount = await this.prisma.inventory.count({
      where: {
        variantId,
        status: InventoryStatus.AVAILABLE,
        isDeleted: false,
      },
    });

    if (availableCount === 0) {
      await this.notificationsService.announceVariantOutOfStock(variantId);
    }
  }
}
