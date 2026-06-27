import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KieuPhuongThucGiaoHang,
  LoaiNguonGiaoHang,
  Prisma,
  TrangThaiDonHang,
  TrangThaiGiaoHang,
  TrangThaiTaiNguyen,
  TrangThaiThanhToan,
  TrangThaiYeuCauNhaCungCap,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { PayosService } from './payos/payos.service';
import { PayosWebhookBody } from './payos/payos.types';

export const PAYMENT_QR_TTL_MS = 3 * 60 * 1000;

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private expiredPaymentTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  onModuleInit() {
    this.expiredPaymentTimer = setInterval(() => {
      void this.processExpiredPendingPayments().catch((error: Error) => {
        this.logger.error(`Process expired pending payments failed: ${error.message}`);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.expiredPaymentTimer) clearInterval(this.expiredPaymentTimer);
  }

  async createPayosPayment(orderId: string, expiresAt: Date) {
    const order = await this.prisma.donHang.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        chiTiet: {
          include: { goiDichVu: { include: { sanPham: true } } },
        },
      },
    });

    const amount = this.toVndInteger(order.tongTien);
    const paymentContent = this.createPaymentContent(order.maDonHang);
    const payment = await this.prisma.thanhToan.create({
      data: {
        donHangId: order.id,
        nhaCungCapThanhToan: 'PAYOS',
        soTien: order.tongTien,
        noiDungThanhToan: paymentContent,
        trangThai: TrangThaiThanhToan.CHO_THANH_TOAN,
      },
    });

    try {
      const paymentLink = await this.payosService.createPaymentLink({
        orderCode: this.getPayosOrderCode(order.maDonHang),
        amount,
        description: paymentContent,
        items: order.chiTiet.map((item) => ({
          name: `${item.goiDichVu.sanPham.tenSanPham} - ${item.goiDichVu.tenGoi}`.slice(0, 255),
          quantity: item.soLuong,
          price: this.toVndInteger(item.donGia),
        })),
        returnUrl: this.getMiniAppUrl('payment=success'),
        cancelUrl: this.getMiniAppUrl('payment=cancelled'),
        expiredAt: Math.floor(expiresAt.getTime() / 1000),
      });

      return this.prisma.thanhToan.update({
        where: { id: payment.id },
        data: {
          maGiaoDich: paymentLink.paymentLinkId,
          duLieuQr: {
            provider: 'PAYOS',
            amount: paymentLink.amount,
            currency: paymentLink.currency,
            content: paymentLink.description,
            orderCode: paymentLink.orderCode,
            paymentLinkId: paymentLink.paymentLinkId,
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode,
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
            bin: paymentLink.bin,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    } catch (error) {
      await this.prisma.thanhToan.update({
        where: { id: payment.id },
        data: { trangThai: TrangThaiThanhToan.THAT_BAI },
      });
      await this.prisma.donHang.update({
        where: { id: order.id },
        data: { trangThai: TrangThaiDonHang.DA_HUY, trangThaiThanhToan: TrangThaiThanhToan.THAT_BAI },
      });
      throw error;
    }
  }

  async handlePayosWebhook(body: PayosWebhookBody) {
    const data = this.payosService.verifyWebhook(body);
    if (!body.success || body.code !== '00' || data.code !== '00') {
      await this.expirePaymentByOrderCode(Number(data.orderCode));
      return { ok: true };
    }

    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);
    const paymentLinkId = String(data.paymentLinkId || '');
    const description = String(data.description || '');

    if (!Number.isSafeInteger(orderCode) || amount <= 0 || !paymentLinkId) {
      throw new BadRequestException('Invalid payOS webhook data');
    }

    const order = await this.prisma.donHang.findUnique({
      where: { maDonHang: `AI${orderCode}` },
      include: { thanhToan: true },
    });
    if (!order) return { ok: true, ignored: 'ORDER_NOT_FOUND' };

    const payment = order.thanhToan.find((record) => record.maGiaoDich === paymentLinkId);
    if (!payment) throw new BadRequestException('Payment link does not match order');
    if (this.toVndInteger(payment.soTien) !== amount) throw new BadRequestException('Payment amount does not match');
    if (payment.noiDungThanhToan !== description) throw new BadRequestException('Payment description does not match');

    await this.confirmPayment(payment.id);
    return { ok: true };
  }

  async confirmPayment(paymentId: string) {
    const payment = await this.prisma.thanhToan.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        donHang: {
          include: {
            chiTiet: {
              include: {
                goiPhuongThuc: { include: { phuongThuc: true } },
              },
            },
          },
        },
      },
    });

    if (payment.trangThai !== TrangThaiThanhToan.DA_THANH_TOAN) {
      await this.prisma.$transaction(async (tx) => {
        await tx.thanhToan.update({
          where: { id: paymentId },
          data: { trangThai: TrangThaiThanhToan.DA_THANH_TOAN, thanhToanLuc: new Date() },
        });
        await tx.donHang.update({
          where: { id: payment.donHangId },
          data: { trangThai: TrangThaiDonHang.DA_THANH_TOAN, trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN },
        });
      });
    }

    await this.fulfillPaidOrder(payment.donHangId);
    return this.prisma.thanhToan.findUniqueOrThrow({ where: { id: paymentId } });
  }

  async getPaymentStatus(paymentId: string) {
    await this.syncPendingPayosPayment(paymentId);
    await this.expirePendingPayment(paymentId);

    const payment = await this.prisma.thanhToan.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        donHang: {
          include: {
            chiTiet: {
              include: {
                goiDichVu: { include: { sanPham: true } },
                giaoHang: { where: { daXoa: false }, orderBy: { taoLuc: 'asc' } },
              },
            },
          },
        },
      },
    });

    const deliveries = payment.donHang.chiTiet.flatMap((item) =>
      item.giaoHang.map((delivery) => ({
        id: delivery.id,
        status: this.mapDeliveryStatus(delivery.trangThai),
        deliveredAt: delivery.giaoLuc,
        content: delivery.noiDungGiao,
        productName: item.goiDichVu.sanPham.tenSanPham,
        variantName: item.goiDichVu.tenGoi,
      })),
    );

    return {
      payment: {
        id: payment.id,
        status: this.mapPaymentStatus(payment.trangThai),
        paidAt: payment.thanhToanLuc,
        expiresAt: this.getPaymentExpiresAt(payment.duLieuQr),
      },
      order: {
        id: payment.donHang.id,
        orderNo: payment.donHang.maDonHang,
        status: this.mapOrderStatus(payment.donHang.trangThai),
        paymentStatus: this.mapPaymentStatus(payment.donHang.trangThaiThanhToan),
      },
      deliveries,
      deliveryMessage: deliveries.map((delivery) => delivery.content).filter(Boolean).join('\n\n') || null,
    };
  }

  async expireOrderPendingPayments(orderId: string) {
    const payments = await this.prisma.thanhToan.findMany({
      where: { donHangId: orderId, trangThai: TrangThaiThanhToan.CHO_THANH_TOAN },
      select: { id: true },
    });
    await Promise.all(payments.map((payment) => this.expirePayment(payment.id)));
  }

  private async fulfillPaidOrder(orderId: string) {
    const order = await this.prisma.donHang.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        chiTiet: {
          where: { daXoa: false },
          include: {
            goiPhuongThuc: { include: { phuongThuc: true } },
            giaoHang: { where: { daXoa: false } },
          },
        },
      },
    });

    for (const item of order.chiTiet) {
      if (item.giaoHang.length >= item.soLuong) continue;
      const kieu = item.goiPhuongThuc.phuongThuc.kieu;

      if (kieu === KieuPhuongThucGiaoHang.GUI_LINK) {
        await this.deliverFromInternalResource(item.id, item.goiDichVuId, item.goiPhuongThucId);
        continue;
      }

      await this.createSupplierRequest(item.id, item.soLuong);
    }

    const refreshed = await this.prisma.donHang.findUniqueOrThrow({
      where: { id: orderId },
      include: { chiTiet: { include: { giaoHang: { where: { daXoa: false } } } } },
    });
    const expected = refreshed.chiTiet.reduce((sum, item) => sum + item.soLuong, 0);
    const delivered = refreshed.chiTiet.reduce(
      (sum, item) => sum + item.giaoHang.filter((delivery) => delivery.trangThai === TrangThaiGiaoHang.DA_GIAO).length,
      0,
    );

    await this.prisma.donHang.update({
      where: { id: orderId },
      data: { trangThai: delivered >= expected ? TrangThaiDonHang.DA_GIAO : TrangThaiDonHang.CHO_NHA_CUNG_CAP },
    });
  }

  private async deliverFromInternalResource(chiTietDonHangId: string, goiDichVuId: string, goiPhuongThucId: string) {
    const resource = await this.prisma.taiNguyenGiaoHang.findFirst({
      where: {
        goiDichVuId,
        goiPhuongThucId,
        daXoa: false,
        trangThai: TrangThaiTaiNguyen.SAN_SANG,
      },
      orderBy: { taoLuc: 'asc' },
    });

    if (!resource) {
      await this.createSupplierRequest(chiTietDonHangId, 1);
      return;
    }

    const content = this.renderDeliveryContent(resource.duLieuCongKhai);
    await this.prisma.$transaction([
      this.prisma.taiNguyenGiaoHang.update({
        where: { id: resource.id },
        data: { trangThai: TrangThaiTaiNguyen.DA_BAN, soLanDaDung: { increment: 1 }, banLuc: new Date() },
      }),
      this.prisma.giaoHang.create({
        data: {
          chiTietDonHangId,
          taiNguyenId: resource.id,
          nguonGiaoHang: LoaiNguonGiaoHang.KHO_NOI_BO,
          noiDungGiao: content,
          duLieuGiao: resource.duLieuCongKhai || undefined,
          giaoLuc: new Date(),
          trangThai: TrangThaiGiaoHang.DA_GIAO,
        },
      }),
    ]);
  }

  private async createSupplierRequest(chiTietDonHangId: string, quantity: number) {
    const existing = await this.prisma.yeuCauNhaCungCap.count({ where: { chiTietDonHangId } });
    if (existing) return;

    const item = await this.prisma.chiTietDonHang.findUniqueOrThrow({
      where: { id: chiTietDonHangId },
      include: { goiDichVu: true },
    });
    const supplier = await this.prisma.nhaCungCapGoiDichVu.findFirst({
      where: {
        goiDichVuId: item.goiDichVuId,
        goiPhuongThucId: item.goiPhuongThucId,
        daXoa: false,
        trangThai: 'DANG_HOAT_DONG',
        nhaCungCap: { daXoa: false, trangThai: 'DANG_HOAT_DONG' },
      },
      orderBy: [{ uuTien: 'asc' }, { taoLuc: 'asc' }],
      include: { nhaCungCap: true },
    });
    if (!supplier) return;

    const request = await this.prisma.yeuCauNhaCungCap.create({
      data: {
        chiTietDonHangId,
        nhaCungCapId: supplier.nhaCungCapId,
        maYeuCau: `SUP${Date.now()}${Math.floor(Math.random() * 1000)}`,
        soLuong: quantity,
        duLieuGui: item.duLieuKhachNhap || undefined,
        trangThai: TrangThaiYeuCauNhaCungCap.CHO_NHAN,
      },
    });

    if (supplier.nhaCungCap.telegramId) {
      await this.telegramService.sendMessage(
        supplier.nhaCungCap.telegramId,
        [
          'Bạn có yêu cầu xử lý đơn hàng mới.',
          '',
          `Mã yêu cầu: ${request.maYeuCau}`,
          `Số lượng: ${request.soLuong}`,
          '',
          'Vui lòng mở trang/form dành cho nhà cung cấp để nhận và trả kết quả.',
        ].join('\n'),
      );
    }
  }

  private async syncPendingPayosPayment(paymentId: string) {
    const payment = await this.prisma.thanhToan.findUniqueOrThrow({ where: { id: paymentId }, include: { donHang: true } });
    if (payment.trangThai !== TrangThaiThanhToan.CHO_THANH_TOAN || payment.nhaCungCapThanhToan !== 'PAYOS') return;

    try {
      const paymentLink = await this.payosService.getPaymentLink(this.getPayosOrderCode(payment.donHang.maDonHang));
      if (paymentLink.status === 'PAID') await this.confirmPayment(payment.id);
    } catch (error) {
      this.logger.warn(`Cannot sync payOS payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processExpiredPendingPayments() {
    const candidates = await this.prisma.thanhToan.findMany({
      where: {
        trangThai: TrangThaiThanhToan.CHO_THANH_TOAN,
        taoLuc: { lt: new Date(Date.now() - PAYMENT_QR_TTL_MS) },
      },
      select: { id: true },
      orderBy: { taoLuc: 'asc' },
      take: 100,
    });
    for (const candidate of candidates) {
      await this.syncPendingPayosPayment(candidate.id);
      await this.expirePendingPayment(candidate.id);
    }
  }

  private async expirePendingPayment(paymentId: string) {
    const payment = await this.prisma.thanhToan.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.trangThai !== TrangThaiThanhToan.CHO_THANH_TOAN || !this.isExpiredPayment(payment.duLieuQr)) return;
    await this.expirePayment(payment.id);
  }

  private async expirePayment(paymentId: string) {
    const payment = await this.prisma.thanhToan.findUnique({ where: { id: paymentId } });
    if (!payment) return;

    const updated = await this.prisma.thanhToan.updateMany({
      where: { id: paymentId, trangThai: TrangThaiThanhToan.CHO_THANH_TOAN },
      data: { trangThai: TrangThaiThanhToan.THAT_BAI },
    });
    if (updated.count) {
      await this.prisma.donHang.updateMany({
        where: { id: payment.donHangId, trangThai: TrangThaiDonHang.CHO_THANH_TOAN },
        data: { trangThai: TrangThaiDonHang.DA_HUY, trangThaiThanhToan: TrangThaiThanhToan.THAT_BAI },
      });
    }
  }

  private async expirePaymentByOrderCode(orderCode: number) {
    if (!Number.isSafeInteger(orderCode)) return;
    const order = await this.prisma.donHang.findUnique({ where: { maDonHang: `AI${orderCode}` }, include: { thanhToan: true } });
    if (!order) return;
    await Promise.all(order.thanhToan.filter((payment) => payment.trangThai === TrangThaiThanhToan.CHO_THANH_TOAN).map((payment) => this.expirePayment(payment.id)));
  }

  private isExpiredPayment(duLieuQr: Prisma.JsonValue | null) {
    const expiresAt = this.getPaymentExpiresAt(duLieuQr);
    return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  }

  private getPaymentExpiresAt(duLieuQr: Prisma.JsonValue | null) {
    if (!duLieuQr || typeof duLieuQr !== 'object' || Array.isArray(duLieuQr)) return null;
    const expiresAt = (duLieuQr as Record<string, unknown>).expiresAt;
    return typeof expiresAt === 'string' ? expiresAt : null;
  }

  private createPaymentContent(orderNo: string) {
    const maxDescriptionLength = 25;
    const orderCode = orderNo.replace(/^AI/, '');
    const configuredPrefix = this.configService.get<string>('PAYOS_PAYMENT_DESCRIPTION_PREFIX') || 'AI Store';
    const prefix = configuredPrefix.trim() || 'AI Store';
    const suffix = orderCode.slice(-15);
    const maxPrefixLength = Math.max(maxDescriptionLength - suffix.length - 1, 1);
    return `${prefix.slice(0, maxPrefixLength)} ${suffix}`.slice(0, maxDescriptionLength);
  }

  private getPayosOrderCode(orderNo: string) {
    const orderCode = Number(orderNo.replace(/^AI/, ''));
    if (!Number.isSafeInteger(orderCode)) throw new BadRequestException('Invalid order code');
    return orderCode;
  }

  private toVndInteger(value: Prisma.Decimal) {
    const integer = value.toDecimalPlaces(0);
    if (!integer.equals(value)) throw new BadRequestException('Payment amount must be an integer VND amount');
    const amount = integer.toNumber();
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('Invalid payment amount');
    return amount;
  }

  private getMiniAppUrl(paymentStatus: string) {
    const miniAppUrl = this.configService.get<string>('TELEGRAM_MINIAPP_URL') || 'http://localhost:405';
    const separator = miniAppUrl.includes('?') ? '&' : '?';
    return `${miniAppUrl}${separator}${paymentStatus}`;
  }

  private renderDeliveryContent(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Thông tin giao hàng đã sẵn sàng.';
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${String(item ?? '')}`)
      .join('\n');
  }

  private mapPaymentStatus(status: TrangThaiThanhToan) {
    const map: Record<TrangThaiThanhToan, string> = {
      CHO_THANH_TOAN: 'PENDING',
      DA_THANH_TOAN: 'PAID',
      THAT_BAI: 'FAILED',
      DA_HOAN_TIEN: 'REFUNDED',
    };
    return map[status];
  }

  private mapOrderStatus(status: TrangThaiDonHang) {
    const map: Record<TrangThaiDonHang, string> = {
      CHO_THANH_TOAN: 'PENDING_PAYMENT',
      DA_THANH_TOAN: 'PAID',
      CHO_NHA_CUNG_CAP: 'WAITING_SUPPLIER',
      DANG_XU_LY: 'FULFILLING',
      DA_GIAO: 'DELIVERED',
      HOAN_THANH: 'COMPLETED',
      DA_HUY: 'CANCELLED',
    };
    return map[status];
  }

  private mapDeliveryStatus(status: TrangThaiGiaoHang) {
    const map: Record<TrangThaiGiaoHang, string> = {
      CHO_GIAO: 'PENDING',
      DA_GIAO: 'DELIVERED',
      THAT_BAI: 'FAILED',
    };
    return map[status];
  }
}
