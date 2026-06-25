import { Injectable } from '@nestjs/common';
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

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
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
            giaoHang: { where: { daXoa: false } },
          },
        },
      },
    });

    return order.chiTiet
      .flatMap((item) =>
        item.giaoHang.map((delivery) =>
          [`${item.goiDichVu.sanPham.tenSanPham} - ${item.goiDichVu.tenGoi}`, delivery.noiDungGiao || 'Đã giao'].join('\n'),
        ),
      )
      .join('\n\n');
  }

  async sendOrderDeliveryMessage(orderId: string) {
    const order = await this.prisma.donHang.findUnique({
      where: { id: orderId },
      include: { nguoiDung: true },
    });
    if (!order?.nguoiDung.telegramId) return null;

    const content = await this.generateDeliveryContent(orderId);
    await this.telegramService.sendMessage(order.nguoiDung.telegramId, content);
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
    const content = this.renderDeliveryContent(payload as Prisma.JsonValue);

    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.giaoHang.create({
        data: {
          chiTietDonHangId: request.chiTietDonHangId,
          yeuCauNhaCungCapId,
          nguonGiaoHang: LoaiNguonGiaoHang.NHA_CUNG_CAP,
          noiDungGiao: content,
          duLieuGiao: payload,
          metadata: { type },
          giaoLuc: new Date(),
          trangThai: TrangThaiGiaoHang.DA_GIAO,
        },
      });
      await tx.yeuCauNhaCungCap.update({
        where: { id: yeuCauNhaCungCapId },
        data: { trangThai: TrangThaiYeuCauNhaCungCap.DA_TRA_KET_QUA, traKetQuaLuc: new Date(), duLieuPhanHoi: payload },
      });
      return created;
    });

    await this.completeOrderIfFullyDelivered(request.chiTietDonHang.donHangId);
    return delivery;
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
}
