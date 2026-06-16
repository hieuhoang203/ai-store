import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveProducts() {
    return this.prisma.product.findMany({
      where: { isDeleted: false, isActive: true },
      include: { variants: { where: { isDeleted: false, active: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.product.findFirst({
      where: { id, isDeleted: false, isActive: true },
      include: { variants: { where: { isDeleted: false, active: true } } },
    });
  }
}
