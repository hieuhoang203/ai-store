import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TrangThaiChung, TrangThaiDonHang, TrangThaiThanhToan } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { CouponsService } from '../coupons/coupons.service';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService, PAYMENT_QR_TTL_MS } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderHistoryDto } from './dto/order-history.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly couponsService: CouponsService,
  ) {}

  async checkout(dto: CheckoutDto) {
    const requestedItems = this.normalizeItems(dto);
    if (!requestedItems.length) throw new BadRequestException('Giỏ hàng đang trống.');

    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const expiresAt = new Date(Date.now() + PAYMENT_QR_TTL_MS);

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      const couponItems = await this.couponsService.getCheckoutItems(tx, requestedItems);
      const subtotal = this.couponsService.sumItems(couponItems);
      const couponValidation = await this.couponsService.validateCoupon(tx, {
        code: dto.couponCode,
        userId: user.id,
        items: couponItems,
        subtotal,
        lock: true,
      });
      const discount = couponValidation?.discountAmount || new Prisma.Decimal(0);

      const goiIds = requestedItems.map((item) => item.variantId);
      const goiDichVu = await tx.goiDichVu.findMany({
        where: {
          id: { in: goiIds },
          choPhepMua: true,
          daXoa: false,
          trangThai: TrangThaiChung.DANG_HOAT_DONG,
          sanPham: { daXoa: false, trangThai: TrangThaiChung.DANG_HOAT_DONG },
        },
        include: {
          phuongThuc: {
            where: { daXoa: false, trangThai: TrangThaiChung.DANG_HOAT_DONG },
            orderBy: [{ laMacDinh: 'desc' }, { uuTien: 'asc' }, { taoLuc: 'asc' }],
            take: 1,
          },
        },
      });
      const goiMap = new Map(goiDichVu.map((goi) => [goi.id, goi]));

      const createdOrder = await tx.donHang.create({
        data: {
          maDonHang: `AI${this.createPayosOrderCode()}`,
          nguoiDungId: user.id,
          tamTinh: subtotal,
          giamGia: discount,
          tongTien: Prisma.Decimal.max(subtotal.sub(discount), new Prisma.Decimal(0)),
          maGiamGiaId: couponValidation?.coupon.id,
          chiTiet: {
            create: requestedItems.map((item) => {
              const goi = goiMap.get(item.variantId);
              if (!goi) throw new BadRequestException('Gói sản phẩm không còn khả dụng.');
              const goiPhuongThuc = goi.phuongThuc[0];
              if (!goiPhuongThuc) {
                throw new BadRequestException(`Gói ${goi.tenGoi} chưa được cấu hình phương thức giao hàng.`);
              }
              return {
                goiDichVuId: goi.id,
                goiPhuongThucId: goiPhuongThuc.id,
                soLuong: item.quantity,
                donGia: goi.giaBan,
                thanhTien: goi.giaBan.mul(item.quantity),
                duLieuKhachNhap: item.customerInput,
              };
            }),
          },
        },
        include: { chiTiet: true },
      });

      if (couponValidation) {
        await this.couponsService.recordCouponUsage(tx, {
          couponId: couponValidation.coupon.id,
          userId: user.id,
          orderId: createdOrder.id,
          discountAmount: couponValidation.discountAmount,
        });
      }

      return createdOrder;
    });

    const payment = await this.paymentsService.createPayosPayment(order.id, expiresAt);
    return { order: this.presentOrder(order), payment: this.presentPayment(payment) };
  }

  async getHistory(dto: OrderHistoryDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 10, 10);
    const where = {
      nguoiDungId: user.id,
      daXoa: false,
      OR: [{ trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN }, { trangThai: TrangThaiDonHang.DA_GIAO }],
    } satisfies Prisma.DonHangWhereInput;
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.donHang.count({ where }),
      this.prisma.donHang.findMany({
        where,
        include: {
          chiTiet: {
            orderBy: { taoLuc: 'asc' },
            include: { goiDichVu: { include: { sanPham: true } } },
          },
        },
        orderBy: { taoLuc: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNo: order.maDonHang,
        status: this.mapOrderStatus(order.trangThai),
        paymentStatus: this.mapPaymentStatus(order.trangThaiThanhToan),
        totalAmount: order.tongTien.toString(),
        createdAt: order.taoLuc,
        quantity: order.chiTiet.reduce((sum, item) => sum + item.soLuong, 0),
        products: order.chiTiet.map((item) => ({
          productName: item.goiDichVu.sanPham.tenSanPham,
          variantName: item.goiDichVu.tenGoi,
          quantity: item.soLuong,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getDetail(orderId: string, initData: string) {
    const user = await this.authService.getOrCreateTelegramUser(initData);
    const order = await this.prisma.donHang.findFirst({
      where: { id: orderId, nguoiDungId: user.id, daXoa: false },
      include: {
        thanhToan: { where: { daXoa: false }, orderBy: { taoLuc: 'desc' } },
        danhGia: { where: { daXoa: false }, orderBy: { taoLuc: 'desc' } },
        chiTiet: {
          orderBy: { taoLuc: 'asc' },
          include: {
            goiDichVu: { include: { sanPham: true } },
            giaoHang: { where: { daXoa: false }, orderBy: { taoLuc: 'asc' } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payment = order.thanhToan[0];
    return {
      id: order.id,
      orderNo: order.maDonHang,
      status: this.mapOrderStatus(order.trangThai),
      paymentStatus: this.mapPaymentStatus(order.trangThaiThanhToan),
      totalAmount: order.tongTien.toString(),
      subtotal: order.tamTinh.toString(),
      discount: order.giamGia.toString(),
      createdAt: order.taoLuc,
      paidAt: payment?.thanhToanLuc,
      bankName: this.getBankName(payment?.duLieuQr),
      paymentContent: payment?.noiDungThanhToan,
      warrantyDays: this.getWarrantyDays(order.chiTiet),
      canReview: order.trangThai === TrangThaiDonHang.DA_GIAO && order.trangThaiThanhToan === TrangThaiThanhToan.DA_THANH_TOAN,
      review: order.danhGia[0]
        ? {
            id: order.danhGia[0].id,
            rating: order.danhGia[0].soSao,
            comment: order.danhGia[0].noiDung,
            isHidden: order.danhGia[0].biAn,
          }
        : null,
      products: order.chiTiet.map((item) => ({
        variantId: item.goiDichVuId,
        productName: item.goiDichVu.sanPham.tenSanPham,
        variantName: item.goiDichVu.tenGoi,
        quantity: item.soLuong,
        warrantyDays: item.goiDichVu.baoHanhNgay,
        canReview: true,
        review: null,
        accounts: item.giaoHang
          .filter((delivery) => delivery.trangThai === 'DA_GIAO')
          .map((delivery) => ({
            email: null,
            username: null,
            password: null,
            gatewayUrl: this.extractGatewayUrl(delivery.duLieuGiao),
            twoFactor: null,
            deliveredAt: delivery.giaoLuc,
          })),
      })),
    };
  }

  async getProfileSummary(initData: string) {
    const user = await this.authService.getOrCreateTelegramUser(initData);
    const orders = await this.prisma.donHang.findMany({
      where: { nguoiDungId: user.id, daXoa: false, trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN },
      include: { chiTiet: { include: { goiDichVu: { include: { sanPham: true } } } } },
    });

    const serviceMap = new Map<string, { productId: string; serviceName: string; accountCount: number; totalSpent: Prisma.Decimal }>();
    for (const order of orders) {
      for (const item of order.chiTiet) {
        const product = item.goiDichVu.sanPham;
        const current =
          serviceMap.get(product.id) ||
          { productId: product.id, serviceName: product.tenSanPham, accountCount: 0, totalSpent: new Prisma.Decimal(0) };
        current.accountCount += item.soLuong;
        current.totalSpent = current.totalSpent.add(item.thanhTien);
        serviceMap.set(product.id, current);
      }
    }

    const serviceStats = Array.from(serviceMap.values()).map((item) => ({
      ...item,
      totalSpent: item.totalSpent.toString(),
    }));

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId?.toString(),
        username: user.username,
        fullName: user.hoTen,
      },
      stats: {
        orderCount: orders.length,
        totalSpent: orders.reduce((sum, order) => sum.add(order.tongTien), new Prisma.Decimal(0)).toString(),
        accountCount: serviceStats.reduce((sum, item) => sum + item.accountCount, 0),
      },
      serviceStats,
      support: {
        telegram: this.configService.get<string>('SUPPORT_TELEGRAM') || '@hieuhv203',
      },
    };
  }

  private normalizeItems(dto: CheckoutDto) {
    const itemMap = new Map<string, { variantId: string; quantity: number; customerInput?: Prisma.InputJsonValue }>();
    for (const item of dto.items) {
      const current = itemMap.get(item.variantId);
      const customerInput = this.normalizeCustomerInput(item.customerInput);
      itemMap.set(item.variantId, {
        variantId: item.variantId,
        quantity: (current?.quantity || 0) + item.quantity,
        customerInput: current?.customerInput || customerInput,
      });
    }
    return Array.from(itemMap.values());
  }

  private normalizeCustomerInput(value?: Record<string, unknown>) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '');
    return entries.length ? Object.fromEntries(entries) as Prisma.InputJsonValue : undefined;
  }

  private createPayosOrderCode() {
    return Date.now() * 100 + Math.floor(Math.random() * 100);
  }

  private presentOrder(order: { id: string; maDonHang: string; tamTinh: Prisma.Decimal; giamGia: Prisma.Decimal; tongTien: Prisma.Decimal }) {
    return {
      id: order.id,
      orderNo: order.maDonHang,
      subtotal: order.tamTinh.toString(),
      discount: order.giamGia.toString(),
      totalAmount: order.tongTien.toString(),
    };
  }

  private presentPayment(payment: { duLieuQr: Prisma.JsonValue | null } & Record<string, unknown>) {
    const { duLieuQr, ...rest } = payment;
    return {
      ...rest,
      id: rest.id,
      amount: rest.soTien,
      paymentContent: rest.noiDungThanhToan,
      status: this.mapPaymentStatus(rest.trangThai as TrangThaiThanhToan),
      qrContent: duLieuQr,
    };
  }

  private getWarrantyDays(items: Array<{ goiDichVu: { baoHanhNgay: number | null } }>) {
    const days = items
      .map((item) => item.goiDichVu.baoHanhNgay)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    return days.length ? Math.max(...days) : null;
  }

  private getBankName(duLieuQr?: Prisma.JsonValue | null) {
    if (!duLieuQr || typeof duLieuQr !== 'object' || Array.isArray(duLieuQr)) return null;
    const record = duLieuQr as Record<string, unknown>;
    if (typeof record.bankName === 'string') return record.bankName;
    if (record.bin === '970422') return 'MB';
    return typeof record.bin === 'string' ? record.bin : null;
  }

  private extractGatewayUrl(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    return typeof record.gatewayUrl === 'string' ? record.gatewayUrl : null;
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
}
