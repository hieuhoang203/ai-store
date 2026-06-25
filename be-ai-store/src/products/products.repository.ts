import { Injectable } from '@nestjs/common';
import { TrangThaiChung } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveProducts() {
    return this.prisma.sanPham.findMany({
      where: {
        daXoa: false,
        trangThai: TrangThaiChung.DANG_HOAT_DONG,
        loai: { daXoa: false, trangThai: TrangThaiChung.DANG_HOAT_DONG },
      },
      include: {
        loai: true,
        goiDichVu: {
          where: {
            daXoa: false,
            trangThai: TrangThaiChung.DANG_HOAT_DONG,
            choPhepMua: true,
          },
          orderBy: [{ thuTu: 'asc' }, { taoLuc: 'asc' }],
        },
      },
      orderBy: [{ thuTu: 'asc' }, { taoLuc: 'desc' }],
    });
  }

  findActiveCategories() {
    return this.prisma.loaiSanPham.findMany({
      where: {
        daXoa: false,
        trangThai: TrangThaiChung.DANG_HOAT_DONG,
        sanPham: {
          some: {
            daXoa: false,
            trangThai: TrangThaiChung.DANG_HOAT_DONG,
            goiDichVu: {
              some: {
                daXoa: false,
                trangThai: TrangThaiChung.DANG_HOAT_DONG,
                choPhepMua: true,
              },
            },
          },
        },
      },
      include: {
        _count: {
          select: {
            sanPham: {
              where: {
                daXoa: false,
                trangThai: TrangThaiChung.DANG_HOAT_DONG,
              },
            },
          },
        },
      },
      orderBy: [{ thuTu: 'asc' }, { taoLuc: 'desc' }],
    });
  }

  findActiveProductsByCategory(categoryId: string) {
    return this.prisma.sanPham.findMany({
      where: {
        loaiId: categoryId,
        daXoa: false,
        trangThai: TrangThaiChung.DANG_HOAT_DONG,
      },
      include: {
        loai: true,
        goiDichVu: {
          where: {
            daXoa: false,
            trangThai: TrangThaiChung.DANG_HOAT_DONG,
            choPhepMua: true,
          },
          orderBy: [{ thuTu: 'asc' }, { taoLuc: 'asc' }],
        },
      },
      orderBy: [{ thuTu: 'asc' }, { taoLuc: 'desc' }],
    });
  }

  findById(id: string) {
    return this.prisma.sanPham.findFirst({
      where: { id, daXoa: false },
      include: {
        loai: true,
        goiDichVu: {
          where: { daXoa: false, choPhepMua: true },
          orderBy: [{ thuTu: 'asc' }, { taoLuc: 'asc' }],
        },
      },
    });
  }
}
