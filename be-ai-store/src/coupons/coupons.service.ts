import { BadRequestException, Injectable } from '@nestjs/common';
import { LoaiGiamGia, Prisma, TrangThaiChung } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { ValidateCouponDto, ValidateCouponItemDto } from './dto/validate-coupon.dto';

export type CouponCheckoutItem = {
  variantId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
};

export type CouponValidationResult = {
  coupon: {
    id: string;
    code: string;
    name: string;
    discountType: LoaiGiamGia;
    discountValue: string;
  };
  subtotal: Prisma.Decimal;
  eligibleSubtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
};

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async validateCouponForTelegramUser(dto: ValidateCouponDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const requestedItems = this.normalizeItems(dto.items);
    const items = await this.getCheckoutItems(this.prisma, requestedItems);
    const subtotal = this.sumItems(items);
    const result = await this.validateCoupon(this.prisma, {
      code: dto.code,
      userId: user.id,
      items,
      subtotal,
    });
    if (!result) throw new BadRequestException('Vui lòng nhập mã giảm giá.');

    return this.presentValidation(result);
  }

  async validateCoupon(
    tx: Prisma.TransactionClient,
    {
      code,
      userId,
      items,
      subtotal,
      lock = false,
    }: {
      code?: string | null;
      userId: string;
      items: CouponCheckoutItem[];
      subtotal: Prisma.Decimal;
      lock?: boolean;
    },
  ) {
    const normalizedCode = this.normalizeCode(code);
    if (!normalizedCode) return null;

    if (lock) {
      await tx.$queryRaw`SELECT "id" FROM "ma_giam_gia" WHERE "ma" = ${normalizedCode} FOR UPDATE`;
    }

    const coupon = await tx.maGiamGia.findFirst({
      where: { ma: normalizedCode, daXoa: false },
      include: {
        goiDichVu: true,
        nguoiDung: true,
      },
    });

    if (!coupon) throw new BadRequestException('Mã giảm giá không tồn tại.');

    const now = new Date();
    if (coupon.trangThai !== TrangThaiChung.DANG_HOAT_DONG) {
      throw new BadRequestException('Mã giảm giá chưa được kích hoạt.');
    }
    if (coupon.batDauLuc && coupon.batDauLuc > now) {
      throw new BadRequestException('Mã giảm giá chưa đến thời gian sử dụng.');
    }
    if (coupon.ketThucLuc && coupon.ketThucLuc < now) {
      throw new BadRequestException('Mã giảm giá đã hết hạn.');
    }
    if (coupon.gioiHanLuotDung !== null && coupon.soLuotDaDung >= coupon.gioiHanLuotDung) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng.');
    }
    if (coupon.nguoiDung.length && !coupon.nguoiDung.some((item) => item.nguoiDungId === userId)) {
      throw new BadRequestException('Mã giảm giá không áp dụng cho tài khoản của bạn.');
    }
    if (coupon.donToiThieu && subtotal.lessThan(coupon.donToiThieu)) {
      throw new BadRequestException(`Đơn hàng cần tối thiểu ${this.formatMoney(coupon.donToiThieu)}đ để dùng mã này.`);
    }

    const allowedGoiIds = new Set(coupon.goiDichVu.map((item) => item.goiDichVuId));
    const eligibleItems = allowedGoiIds.size
      ? items.filter((item) => allowedGoiIds.has(item.variantId))
      : items;
    const eligibleSubtotal = this.sumItems(eligibleItems);

    if (eligibleSubtotal.lte(0)) {
      throw new BadRequestException('Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng.');
    }

    const discountAmount = this.calculateDiscount(coupon, eligibleSubtotal);
    if (discountAmount.lte(0)) throw new BadRequestException('Mã giảm giá không tạo ra giá trị giảm hợp lệ.');

    return {
      coupon: {
        id: coupon.id,
        code: coupon.ma,
        name: coupon.ten,
        discountType: coupon.loaiGiamGia,
        discountValue: coupon.giaTriGiam.toString(),
      },
      subtotal,
      eligibleSubtotal,
      discountAmount,
      finalAmount: Prisma.Decimal.max(subtotal.sub(discountAmount), new Prisma.Decimal(0)),
    };
  }

  async recordCouponUsage(
    tx: Prisma.TransactionClient,
    {
      couponId,
      userId,
      orderId,
      discountAmount,
    }: {
      couponId: string;
      userId: string;
      orderId: string;
      discountAmount: Prisma.Decimal;
    },
  ) {
    await tx.maGiamGia.update({
      where: { id: couponId },
      data: { soLuotDaDung: { increment: 1 } },
    });
    await tx.luotDungMaGiamGia.create({
      data: {
        maGiamGiaId: couponId,
        nguoiDungId: userId,
        donHangId: orderId,
        soTienGiam: discountAmount,
      },
    });
  }

  async getCheckoutItems(tx: Prisma.TransactionClient, requestedItems: Array<{ variantId: string; quantity: number }>) {
    const goiDichVu = await tx.goiDichVu.findMany({
      where: {
        id: { in: requestedItems.map((item) => item.variantId) },
        choPhepMua: true,
        daXoa: false,
        trangThai: TrangThaiChung.DANG_HOAT_DONG,
        sanPham: { daXoa: false, trangThai: TrangThaiChung.DANG_HOAT_DONG },
      },
    });
    const goiMap = new Map(goiDichVu.map((goi) => [goi.id, goi]));

    return requestedItems.map((item) => {
      const goi = goiMap.get(item.variantId);
      if (!goi) throw new BadRequestException('Gói sản phẩm không còn khả dụng.');
      const unitPrice = goi.giaBan;
      const totalPrice = unitPrice.mul(item.quantity);
      return { variantId: item.variantId, quantity: item.quantity, unitPrice, totalPrice };
    });
  }

  presentValidation(result: CouponValidationResult) {
    return {
      success: true,
      coupon: {
        id: result.coupon.id,
        code: result.coupon.code,
        name: result.coupon.name,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
      },
      subtotal: result.subtotal.toString(),
      eligibleSubtotal: result.eligibleSubtotal.toString(),
      discountAmount: result.discountAmount.toString(),
      finalAmount: result.finalAmount.toString(),
    };
  }

  normalizeItems(items: ValidateCouponItemDto[]) {
    const itemMap = new Map<string, number>();
    for (const item of items) {
      itemMap.set(item.variantId, (itemMap.get(item.variantId) || 0) + item.quantity);
    }
    return Array.from(itemMap.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  sumItems(items: Array<{ totalPrice: Prisma.Decimal }>) {
    return items.reduce((sum, item) => sum.add(item.totalPrice), new Prisma.Decimal(0));
  }

  private calculateDiscount(
    coupon: {
      loaiGiamGia: LoaiGiamGia;
      giaTriGiam: Prisma.Decimal;
      giamToiDa: Prisma.Decimal | null;
    },
    eligibleSubtotal: Prisma.Decimal,
  ) {
    const raw =
      coupon.loaiGiamGia === LoaiGiamGia.PHAN_TRAM
        ? eligibleSubtotal.mul(coupon.giaTriGiam).div(100)
        : coupon.giaTriGiam;
    const capped = coupon.giamToiDa ? Prisma.Decimal.min(raw, coupon.giamToiDa) : raw;
    return Prisma.Decimal.min(capped, eligibleSubtotal).toDecimalPlaces(0);
  }

  private normalizeCode(code?: string | null) {
    return code?.trim().toUpperCase() || null;
  }

  private formatMoney(value: Prisma.Decimal) {
    return Number(value).toLocaleString('vi-VN');
  }
}
