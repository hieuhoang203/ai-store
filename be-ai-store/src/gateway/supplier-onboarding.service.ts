import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NhaCungCapKenhNhanViec,
  NhaCungCapTrangThai,
  Prisma,
  TrangThaiYeuCauNhaCungCap,
  VaiTroHeThong,
} from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { SupplierConnectDto, SupplierFulfillRequestDto } from './dto/supplier-onboarding.dto';

@Injectable()
export class SupplierOnboardingService {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly deliveriesService: DeliveriesService,
    private readonly prisma: PrismaService,
  ) {}

  getFixedInviteLink() {
    const publicUrl = this.configService.get<string>('APP_PUBLIC_URL') || 'http://localhost:8903';
    return `${publicUrl.replace(/\/$/, '')}/suppliers/join`;
  }

  getMiniAppRedirectUrl(token?: string) {
    const miniAppUrl = this.configService.get<string>('TELEGRAM_MINIAPP_URL') || 'http://localhost:405';
    const separator = miniAppUrl.includes('?') ? '&' : '?';
    return `${miniAppUrl}${separator}supplier=connect${token ? `&token=${token}` : ''}`;
  }

  async connect(dto: SupplierConnectDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    if (!user.telegramId) throw new BadRequestException('Telegram profile is required');

    let inviteLinkRecord: any = null;
    if (dto.token) {
      inviteLinkRecord = await this.prisma.lienKetNhaCungCap.findUnique({
        where: { maToken: dto.token },
      });
      if (!inviteLinkRecord) {
        throw new BadRequestException('Mã mời không tồn tại');
      }
      if (inviteLinkRecord.trangThai !== 'CHUA_SU_DUNG') {
        throw new BadRequestException('Mã mời đã được sử dụng hoặc đã hết hạn');
      }
      if (inviteLinkRecord.hetHanLuc && inviteLinkRecord.hetHanLuc < new Date()) {
        await this.prisma.lienKetNhaCungCap.update({
          where: { id: inviteLinkRecord.id },
          data: { trangThai: 'HET_HAN' },
        });
        throw new BadRequestException('Mã mời đã hết hạn');
      }
    }

    const displayName = this.normalizeText(dto.displayName) || user.hoTen || user.username || `Supplier ${user.telegramId}`;
    const supplier = await this.prisma.$transaction(async (tx) => {
      await this.ensureSupplierRole(tx, user.id);

      const createdSupplier = await tx.nhaCungCap.upsert({
        where: { telegramId: user.telegramId ?? undefined },
        create: {
          nguoiDungId: user.id,
          telegramId: user.telegramId,
          usernameTelegram: user.username,
          tenHienThi: displayName,
          soDienThoai: this.normalizeText(dto.phone),
          email: this.normalizeText(dto.email),
          kenhNhanViec: NhaCungCapKenhNhanViec.TELEGRAM_MINI_APP,
          trangThai: NhaCungCapTrangThai.DANG_HOAT_DONG,
        },
        update: {
          nguoiDungId: user.id,
          usernameTelegram: user.username,
          tenHienThi: displayName,
          ...(dto.phone !== undefined ? { soDienThoai: this.normalizeText(dto.phone) } : {}),
          ...(dto.email !== undefined ? { email: this.normalizeText(dto.email) } : {}),
          kenhNhanViec: NhaCungCapKenhNhanViec.TELEGRAM_MINI_APP,
          trangThai: NhaCungCapTrangThai.DANG_HOAT_DONG,
          daXoa: false,
        },
      });

      if (inviteLinkRecord) {
        await tx.lienKetNhaCungCap.update({
          where: { id: inviteLinkRecord.id },
          data: {
            nhaCungCapId: createdSupplier.id,
            telegramIdDaGan: user.telegramId,
            dungLuc: new Date(),
            trangThai: 'DA_SU_DUNG',
          },
        });
      }

      return createdSupplier;
    });

    return {
      inviteLink: this.getFixedInviteLink(),
      supplier: {
        id: supplier.id,
        telegramId: supplier.telegramId?.toString(),
        username: supplier.usernameTelegram,
        displayName: supplier.tenHienThi,
        status: supplier.trangThai,
      },
    };
  }

  async getRequestByToken(token: string, initData: string) {
    const { supplier } = await this.getSupplierFromInitData(initData);
    const request = await this.findRequestByToken(token);
    if (request.nhaCungCapId !== supplier.id) throw new ForbiddenException('Supplier request does not belong to this account');

    return this.presentRequest(request);
  }

  async fulfillRequest(token: string, dto: SupplierFulfillRequestDto) {
    const { supplier } = await this.getSupplierFromInitData(dto.initData);
    const request = await this.findRequestByToken(token);
    if (request.nhaCungCapId !== supplier.id) throw new ForbiddenException('Supplier request does not belong to this account');
    if (request.trangThai === TrangThaiYeuCauNhaCungCap.DA_TRA_KET_QUA) {
      throw new BadRequestException('Supplier request was already fulfilled');
    }

    const delivery = await this.deliveriesService.createFulfillmentResource(
      request.id,
      request.chiTietDonHang.goiPhuongThuc.phuongThuc.kieu,
      dto.payload as Prisma.InputJsonValue,
    );

    return { ok: true, deliveryId: delivery.id };
  }

  private async getSupplierFromInitData(initData: string) {
    const user = await this.authService.getOrCreateTelegramUser(initData);
    if (!user.telegramId) throw new BadRequestException('Telegram profile is required');

    const supplier = await this.prisma.nhaCungCap.findFirst({
      where: { telegramId: user.telegramId, daXoa: false, trangThai: NhaCungCapTrangThai.DANG_HOAT_DONG },
    });
    if (!supplier) throw new ForbiddenException('Supplier account is not connected');
    return { user, supplier };
  }

  private async findRequestByToken(token: string) {
    if (!/^[0-9A-Za-z_-]{16,120}$/.test(token)) throw new NotFoundException('Supplier request not found');

    const request = await this.prisma.yeuCauNhaCungCap.findUnique({
      where: { tokenForm: token },
      include: {
        nhaCungCap: true,
        chiTietDonHang: {
          include: {
            donHang: true,
            goiDichVu: { include: { sanPham: true } },
            goiPhuongThuc: { include: { phuongThuc: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Supplier request not found');
    return request;
  }

  private presentRequest(request: Awaited<ReturnType<SupplierOnboardingService['findRequestByToken']>>) {
    return {
      id: request.id,
      code: request.maYeuCau,
      status: request.trangThai,
      quantity: request.soLuong,
      customerInput: request.duLieuGui,
      order: {
        id: request.chiTietDonHang.donHang.id,
        orderNo: request.chiTietDonHang.donHang.maDonHang,
      },
      product: {
        id: request.chiTietDonHang.goiDichVu.id,
        name: request.chiTietDonHang.goiDichVu.sanPham.tenSanPham,
        variantName: request.chiTietDonHang.goiDichVu.tenGoi,
        deliveryType: request.chiTietDonHang.goiPhuongThuc.phuongThuc.kieu,
      },
    };
  }

  private async ensureSupplierRole(tx: Prisma.TransactionClient, userId: string) {
    const role = await tx.vaiTro.upsert({
      where: { ten: VaiTroHeThong.NHA_CUNG_CAP },
      create: { ten: VaiTroHeThong.NHA_CUNG_CAP },
      update: {},
    });
    await tx.nguoiDungVaiTro.upsert({
      where: { nguoiDungId_vaiTroId: { nguoiDungId: userId, vaiTroId: role.id } },
      create: { nguoiDungId: userId, vaiTroId: role.id },
      update: { daXoa: false },
    });
  }

  private normalizeText(value?: string | null) {
    const normalized = value?.trim();
    return normalized || null;
  }
}
