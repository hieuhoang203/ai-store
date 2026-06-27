import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KieuPhuongThucGiaoHang,
  LoaiNguonGiaoHang,
  Prisma,
  TrangThaiDonHang,
  TrangThaiGiaoHang,
  TrangThaiYeuCauNhaCungCap,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { renderDeliveryMessage, renderDeliveryTelegramMessage, type DeliveryAccount } from './delivery-message';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  async createDelivery(chiTietDonHangId: string, taiNguyenId: string) {
    const resource = await this.prisma.taiNguyenGiaoHang.findUniqueOrThrow({ where: { id: taiNguyenId } });
    return this.prisma.giaoHang.create({
      data: {
        chiTietDonHangId,
        taiNguyenId,
        nguonGiaoHang: LoaiNguonGiaoHang.KHO_NOI_BO,
        noiDungGiao: this.renderDeliveryContent(resource.duLieuCongKhai),
        duLieuGiao: resource.duLieuCongKhai || undefined,
        giaoLuc: new Date(),
        trangThai: TrangThaiGiaoHang.DA_GIAO,
      },
    });
  }

  async generateDeliveryContent(orderId: string) {
    const order = await this.prisma.donHang.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        chiTiet: {
          include: {
            goiDichVu: { include: { sanPham: true } },
            giaoHang: { where: { daXoa: false, trangThai: TrangThaiGiaoHang.DA_GIAO }, orderBy: { taoLuc: 'asc' } },
          },
        },
      },
    });

    return renderDeliveryMessage(this.buildDeliveryPayload(order));
  }

  async sendOrderDeliveryMessage(orderId: string) {
    const order = await this.prisma.donHang.findUnique({
      where: { id: orderId },
      include: { nguoiDung: true },
    });
    if (!order?.nguoiDung.telegramId) return null;

    const detail = await this.prisma.donHang.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        chiTiet: {
          include: {
            goiDichVu: { include: { sanPham: true } },
            giaoHang: { where: { daXoa: false, trangThai: TrangThaiGiaoHang.DA_GIAO }, orderBy: { taoLuc: 'asc' } },
          },
        },
      },
    });
    const content = renderDeliveryTelegramMessage(this.buildDeliveryPayload(detail));
    await this.telegramService.sendHtmlMessage(order.nguoiDung.telegramId, content);
    return content;
  }

  async createFulfillmentResource(
    yeuCauNhaCungCapId: string,
    type: KieuPhuongThucGiaoHang,
    payload: Prisma.InputJsonValue,
  ) {
    const request = await this.prisma.yeuCauNhaCungCap.findUniqueOrThrow({
      where: { id: yeuCauNhaCungCapId },
      include: { chiTietDonHang: true },
    });
    const deliveryPayloads = this.normalizeDeliveryPayloads(payload, request.soLuong);

    const deliveries = await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        deliveryPayloads.map((deliveryPayload) =>
          tx.giaoHang.create({
            data: {
              chiTietDonHangId: request.chiTietDonHangId,
              yeuCauNhaCungCapId,
              nguonGiaoHang: LoaiNguonGiaoHang.NHA_CUNG_CAP,
              noiDungGiao: this.renderDeliveryContent(deliveryPayload as Prisma.JsonValue),
              duLieuGiao: deliveryPayload,
              metadata: { type },
              giaoLuc: new Date(),
              trangThai: TrangThaiGiaoHang.DA_GIAO,
            },
          }),
        ),
      );
      await tx.yeuCauNhaCungCap.update({
        where: { id: yeuCauNhaCungCapId },
        data: { trangThai: TrangThaiYeuCauNhaCungCap.DA_TRA_KET_QUA, traKetQuaLuc: new Date(), duLieuPhanHoi: payload },
      });
      return created;
    });

    await this.completeOrderIfFullyDelivered(request.chiTietDonHang.donHangId);
    return deliveries[0];
  }

  private normalizeDeliveryPayloads(payload: Prisma.InputJsonValue, expectedQuantity: number) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, Prisma.InputJsonValue>;
      if (Array.isArray(record.accounts) && record.accounts.length) {
        return record.accounts.slice(0, expectedQuantity).map((account) => account as Prisma.InputJsonValue);
      }
    }

    return [payload];
  }

  private async completeOrderIfFullyDelivered(orderId: string) {
    const order = await this.prisma.donHang.findUniqueOrThrow({
      where: { id: orderId },
      include: { chiTiet: { where: { daXoa: false }, include: { giaoHang: { where: { daXoa: false } } } } },
    });
    const expected = order.chiTiet.reduce((sum, item) => sum + item.soLuong, 0);
    const delivered = order.chiTiet.reduce(
      (sum, item) => sum + item.giaoHang.filter((delivery) => delivery.trangThai === TrangThaiGiaoHang.DA_GIAO).length,
      0,
    );
    if (expected > 0 && delivered >= expected) {
      await this.prisma.donHang.update({ where: { id: orderId }, data: { trangThai: TrangThaiDonHang.DA_GIAO } });
      await this.sendOrderDeliveryMessage(orderId);
    }
  }

  private renderDeliveryContent(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Thông tin giao hàng đã sẵn sàng.';
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${String(item ?? '')}`)
      .join('\n');
  }

  private buildDeliveryPayload(order: {
    maDonHang: string;
    chiTiet: Array<{
      goiDichVu: {
        tenGoi: string;
        thoiHanNgay: number | null;
        baoHanhNgay: number | null;
        sanPham: { tenSanPham: string };
      };
      giaoHang: Array<{ duLieuGiao: Prisma.JsonValue | null; noiDungGiao: string | null }>;
    }>;
  }) {
    return {
      orderCode: order.maDonHang,
      support: {
        telegram: this.configService.get<string>('SUPPORT_TELEGRAM') || '@hieuhv203',
        zalo: this.configService.get<string>('SUPPORT_ZALO') || this.configService.get<string>('SUPPORT_PHONE') || '0966628527',
        email: this.configService.get<string>('SUPPORT_EMAIL') || null,
      },
      products: order.chiTiet.map((item) => ({
        serviceName: `${item.goiDichVu.sanPham.tenSanPham} - ${item.goiDichVu.tenGoi}`,
        duration: this.formatDuration(item.goiDichVu.thoiHanNgay),
        warrantyDays: item.goiDichVu.baoHanhNgay,
        accounts: item.giaoHang.length
          ? item.giaoHang.map((delivery) => this.extractDeliveryAccount(delivery.duLieuGiao, delivery.noiDungGiao))
          : [{}],
      })),
    };
  }

  private extractDeliveryAccount(value: Prisma.JsonValue | null, fallbackContent: string | null): DeliveryAccount {
    const account: DeliveryAccount = {};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      account.email = this.stringValue(record.email);
      account.username = this.stringValue(record.username);
      account.password = this.stringValue(record.password);
      account.gatewayUrl = this.stringValue(record.gatewayUrl) || this.findUrl(fallbackContent);
      account.licenseKey = this.stringValue(record.licenseKey);
      account.apiKey = this.stringValue(record.apiKey);
      account.voucherCode = this.stringValue(record.voucherCode);
      account.workspace = this.stringValue(record.workspace);
      account.type = this.stringValue(record.type);
      return account;
    }

    account.gatewayUrl = this.findUrl(fallbackContent);
    return account;
  }

  private formatDuration(days: number | null) {
    if (!days) return null;
    if (days >= 365 && days % 365 === 0) return `${days / 365} năm`;
    if (days >= 30 && days % 30 === 0) return `${days / 30} tháng`;
    return `${days} ngày`;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private findUrl(value: string | null) {
    return value?.match(/https?:\/\/\S+/)?.[0] || null;
  }
}
