import { Test, TestingModule } from '@nestjs/testing';
import { TrangThaiTaiNguyen } from '../../generated/prisma/client.js';
import { InventoriesService } from './inventories.service';
import { PrismaService } from '../database/prisma.service';

describe('InventoriesService', () => {
  let service: InventoriesService;

  const mockPrismaService = {
    taiNguyenGiaoHang: {
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    nhaCungCapGoiDichVu: {
      aggregate: jest.fn(),
    },
    goiPhuongThucGiaoHang: {
      findMany: jest.fn(),
    },
    goiDichVu: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<InventoriesService>(InventoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('releaseExpiredReservations', () => {
    it('releases expired reservations and returns the count', async () => {
      const now = new Date();
      mockPrismaService.taiNguyenGiaoHang.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.releaseExpiredReservations(now);

      expect(result).toBe(5);
      expect(mockPrismaService.taiNguyenGiaoHang.updateMany).toHaveBeenCalledWith({
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
    });
  });

  describe('refreshVariantDisplayStock', () => {
    it('calculates stock and updates variant display stock', async () => {
      const mockTx = {
        taiNguyenGiaoHang: {
          count: jest.fn().mockResolvedValue(10),
        },
        nhaCungCapGoiDichVu: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { soLuongCoTheNhan: 15, soLuongDangGiu: 3 },
          }),
        },
        goiPhuongThucGiaoHang: {
          findMany: jest.fn().mockResolvedValue([
            { cauHinh: { remainingUses: 7 } },
            { cauHinh: { maxUses: 10, usedCount: 4 } },
          ]),
        },
        goiDichVu: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      await service.refreshVariantDisplayStock(mockTx as any, 'goi-dich-vu-1');

      expect(mockTx.taiNguyenGiaoHang.count).toHaveBeenCalledWith({
        where: {
          goiDichVuId: 'goi-dich-vu-1',
          daXoa: false,
          trangThai: TrangThaiTaiNguyen.SAN_SANG,
        },
      });
      expect(mockTx.nhaCungCapGoiDichVu.aggregate).toHaveBeenCalledWith({
        where: {
          goiDichVuId: 'goi-dich-vu-1',
          daXoa: false,
          trangThai: 'DANG_HOAT_DONG',
          nhaCungCap: { daXoa: false, trangThai: 'DANG_HOAT_DONG' },
        },
        _sum: { soLuongCoTheNhan: true, soLuongDangGiu: true },
      });
      expect(mockTx.goiPhuongThucGiaoHang.findMany).toHaveBeenCalledWith({
        where: {
          goiDichVuId: 'goi-dich-vu-1',
          daXoa: false,
          trangThai: 'DANG_HOAT_DONG',
          phuongThuc: { daXoa: false, trangThai: 'DANG_HOAT_DONG', kieu: 'GUI_LINK' },
        },
        select: { cauHinh: true },
      });
      expect(mockTx.goiDichVu.update).toHaveBeenCalledWith({
        where: { id: 'goi-dich-vu-1' },
        data: { tonHienThi: 35 },
      });
    });
  });

  describe('announceOutOfStockIfNeeded', () => {
    it('does nothing and resolves', async () => {
      await expect(service.announceOutOfStockIfNeeded('goi-dich-vu-1')).resolves.toBeUndefined();
    });
  });

  describe('releaseReservationForOrder', () => {
    it('returns 0', async () => {
      const result = await service.releaseReservationForOrder('order-1');
      expect(result).toBe(0);
    });
  });
});
