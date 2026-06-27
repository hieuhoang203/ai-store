import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KieuPhuongThucGiaoHang, Prisma, TrangThaiChung, TrangThaiTaiNguyen } from '../../generated/prisma/client.js';
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
    const linkMethods = await tx.goiPhuongThucGiaoHang.findMany({
      where: {
        goiDichVuId,
        daXoa: false,
        trangThai: TrangThaiChung.DANG_HOAT_DONG,
        phuongThuc: { daXoa: false, trangThai: TrangThaiChung.DANG_HOAT_DONG, kieu: KieuPhuongThucGiaoHang.GUI_LINK },
      },
      select: { cauHinh: true },
    });
    const linkStock = linkMethods.reduce((sum, method) => sum + this.getConfigLinkStock(method.cauHinh), 0);

    await tx.goiDichVu.update({
      where: { id: goiDichVuId },
      data: { tonHienThi: internalStock + supplierStock + linkStock },
    });
  }

  async announceOutOfStockIfNeeded(_goiDichVuId: string) {
    return;
  }

  async releaseReservationForOrder(_orderId: string) {
    return 0;
  }

  private getConfigLinkStock(config: Prisma.JsonValue | null) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return 0;
    const record = config as Record<string, unknown>;
    const remainingUses = this.toNonNegativeInteger(record.remainingUses);
    if (remainingUses !== null) return remainingUses;

    const maxUses = this.toNonNegativeInteger(record.maxUses);
    if (maxUses === null) return 0;

    const usedCount = this.toNonNegativeInteger(record.usedCount) || 0;
    return Math.max(maxUses - usedCount, 0);
  }

  private toNonNegativeInteger(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
}
