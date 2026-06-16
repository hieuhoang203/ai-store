import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class InventoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async sellFirstAvailableInventory(variantId: string, reservedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findFirst({
        where: {
          variantId,
          status: InventoryStatus.AVAILABLE,
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!inventory) {
        throw new NotFoundException('No available inventory');
      }

      return tx.inventory.update({
        where: { id: inventory.id },
        data: {
          status: InventoryStatus.SOLD,
          reservedBy,
          reservedAt: new Date(),
          deliveredAt: new Date(),
        },
      });
    });
  }
}
