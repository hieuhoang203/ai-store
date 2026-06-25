import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, TrangThaiTaiNguyen } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class InventoriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoriesService.name);
  private releaseExpiredReservationsTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.releaseExpiredReservationsTimer = setInterval(() => {
      void this.releaseExpiredReservations().catch((error: Error) => {
        this.logger.error(`Release expired reservations failed: ${error.message}`);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.releaseExpiredReservationsTimer) clearInterval(this.releaseExpiredReservationsTimer);
  }

  async releaseExpiredReservations(now = new Date()) {
    const expired = await this.prisma.taiNguyenGiaoHang.updateMany({
      where: {
        trangThai: TrangThaiTaiNguyen.DA_GIU,
        giuDenLuc: { lt: now },
        daXoa: false,
      },
      data: {
        trangThai: TrangThaiTaiNguyen.SAN_SANG,
        giuChoDonHangId: null,
        giuChoNguoiDungId: null,
        giuDenLuc: null,
      },
    });

    return expired.count;
  }

  async refreshVariantDisplayStock(tx: Prisma.TransactionClient, goiDichVuId: string) {
    const internalStock = await tx.taiNguyenGiaoHang.count({
      where: { goiDichVuId, daXoa: false, trangThai: TrangThaiTaiNguyen.SAN_SANG },
    });
    const supplierCapacity = await tx.nhaCungCapGoiDichVu.aggregate({
      where: {
        goiDichVuId,
        daXoa: false,
        trangThai: 'DANG_HOAT_DONG',
        nhaCungCap: { daXoa: false, trangThai: 'DANG_HOAT_DONG' },
      },
      _sum: { soLuongCoTheNhan: true, soLuongDangGiu: true },
    });
    const supplierStock = Math.max(
      Number(supplierCapacity._sum.soLuongCoTheNhan || 0) - Number(supplierCapacity._sum.soLuongDangGiu || 0),
      0,
    );
    await tx.goiDichVu.update({
      where: { id: goiDichVuId },
      data: { tonHienThi: internalStock + supplierStock },
    });
  }

  async announceOutOfStockIfNeeded(_goiDichVuId: string) {
    return;
  }

  async releaseReservationForOrder(_orderId: string) {
    return 0;
  }
}
