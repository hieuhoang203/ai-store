import { Injectable } from '@nestjs/common';
import { InventoryStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveProducts() {
    return this.prisma.product.findMany({
      where: { isDeleted: false, isActive: true },
      include: {
        categoryRef: true,
        variants: {
          where: { isDeleted: false, active: true },
          include: {
            _count: {
              select: {
                inventories: {
                  where: { status: InventoryStatus.AVAILABLE, isDeleted: false },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findActiveCategories() {
    return this.prisma.category.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        icon: true,
        _count: {
          select: {
            products: {
              where: { isDeleted: false, isActive: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  findActiveProductsByCategory(categoryId: string) {
    return this.prisma.product.findMany({
      where: { categoryId, isDeleted: false, isActive: true },
      include: {
        categoryRef: true,
        variants: {
          where: { isDeleted: false, active: true },
          include: {
            _count: {
              select: {
                inventories: {
                  where: { status: InventoryStatus.AVAILABLE, isDeleted: false },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.product.findFirst({
      where: { id, isDeleted: false, isActive: true },
      include: {
        categoryRef: true,
        variants: {
          where: { isDeleted: false, active: true },
          include: {
            _count: {
              select: {
                inventories: {
                  where: { status: InventoryStatus.AVAILABLE, isDeleted: false },
                },
              },
            },
          },
        },
      },
    });
  }
}
