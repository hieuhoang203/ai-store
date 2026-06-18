import { BadRequestException } from '@nestjs/common';
import { InventoryStatus } from '../../generated/prisma/client.js';
import { InventoriesService } from './inventories.service';

describe('InventoriesService reservation', () => {
  const passwordService = {
    encrypt: jest.fn((value) => value),
    isEncrypted: jest.fn(() => true),
  };
  const notificationsService = {
    announceVariantOutOfStock: jest.fn(),
  };
  const prisma = {
    inventory: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reserves exactly the locked inventories', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'inventory-1' }, { id: 'inventory-2' }]),
      inventory: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new InventoriesService(prisma as any, passwordService as any, notificationsService as any);
    const reservedUntil = new Date('2026-08-17T10:03:00.000Z');

    const ids = await service.reserveAvailableInventories(tx as any, {
      variantId: '00000000-0000-0000-0000-000000000001',
      quantity: 2,
      userId: '00000000-0000-0000-0000-000000000002',
      orderId: '00000000-0000-0000-0000-000000000003',
      reservedUntil,
    });

    expect(ids).toEqual(['inventory-1', 'inventory-2']);
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['inventory-1', 'inventory-2'] } },
      data: {
        status: InventoryStatus.RESERVED,
        reservedBy: '00000000-0000-0000-0000-000000000002',
        reservedAt: expect.any(Date),
        reservedUntil,
        reservedOrderId: '00000000-0000-0000-0000-000000000003',
      },
    });
  });

  it('fails without reserving partial inventory when locked rows are insufficient', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'inventory-1' }]),
      inventory: {
        updateMany: jest.fn(),
      },
    };
    const service = new InventoriesService(prisma as any, passwordService as any, notificationsService as any);

    await expect(
      service.reserveAvailableInventories(tx as any, {
        variantId: '00000000-0000-0000-0000-000000000001',
        quantity: 2,
        userId: '00000000-0000-0000-0000-000000000002',
        orderId: '00000000-0000-0000-0000-000000000003',
        reservedUntil: new Date('2026-08-17T10:03:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('releases expired reservations back to available inventory', async () => {
    prisma.inventory.findMany.mockResolvedValue([
      { id: 'inventory-1', reservedOrderId: 'order-1' },
      { id: 'inventory-2', reservedOrderId: null },
    ]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.inventory.updateMany.mockResolvedValue({ count: 2 });
    const service = new InventoriesService(prisma as any, passwordService as any, notificationsService as any);
    const now = new Date('2026-08-17T10:03:01.000Z');

    const releasedCount = await service.releaseExpiredReservations(now);

    expect(releasedCount).toBe(2);
    expect(prisma.inventory.findMany).toHaveBeenCalledWith({
      where: {
        status: InventoryStatus.RESERVED,
        reservedUntil: { lt: now },
        isDeleted: false,
      },
      select: { id: true, reservedOrderId: true },
      take: 500,
    });
    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['inventory-1', 'inventory-2'] } },
      data: {
        status: InventoryStatus.AVAILABLE,
        reservedBy: null,
        reservedAt: null,
        reservedUntil: null,
        reservedOrderId: null,
      },
    });
  });

  it('does not release expired reservations that still have pending payments', async () => {
    prisma.inventory.findMany.mockResolvedValue([{ id: 'inventory-1', reservedOrderId: 'order-1' }]);
    prisma.payment.findMany.mockResolvedValue([{ orderId: 'order-1' }]);
    const service = new InventoriesService(prisma as any, passwordService as any, notificationsService as any);

    const releasedCount = await service.releaseExpiredReservations(new Date('2026-08-17T10:03:01.000Z'));

    expect(releasedCount).toBe(0);
    expect(prisma.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('does not announce out of stock while inventory is reserved but unpaid', async () => {
    prisma.inventory.count.mockResolvedValue(1);
    const service = new InventoriesService(prisma as any, passwordService as any, notificationsService as any);

    await service.announceOutOfStockIfNeeded('variant-1');

    expect(prisma.inventory.count).toHaveBeenCalledWith({
      where: {
        variantId: 'variant-1',
        status: { in: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED] },
        isDeleted: false,
      },
    });
    expect(notificationsService.announceVariantOutOfStock).not.toHaveBeenCalled();
  });

  it('announces out of stock only when no available or reserved inventory remains', async () => {
    prisma.inventory.count.mockResolvedValue(0);
    const service = new InventoriesService(prisma as any, passwordService as any, notificationsService as any);

    await service.announceOutOfStockIfNeeded('variant-1');

    expect(notificationsService.announceVariantOutOfStock).toHaveBeenCalledWith('variant-1');
  });
});
