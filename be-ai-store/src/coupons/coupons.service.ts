import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivityLogType, DiscountType, Prisma } from '../../generated/prisma/client.js';
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
    discountType: DiscountType;
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
      await tx.$queryRaw`SELECT "id" FROM "coupons" WHERE "code" = ${normalizedCode} FOR UPDATE`;
    }

    const coupon = await tx.coupon.findFirst({
      where: { code: normalizedCode, isDeleted: false },
      include: {
        products: { where: { isDeleted: false } },
        users: { where: { isDeleted: false } },
      },
    });

    if (!coupon) {
      throw new BadRequestException('Mã giảm giá không tồn tại.');
    }

    const now = new Date();
    if (!coupon.isActive) throw new BadRequestException('Mã giảm giá chưa được kích hoạt.');
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('Mã giảm giá chưa đến thời gian sử dụng.');
    if (coupon.endsAt && coupon.endsAt < now) throw new BadRequestException('Mã giảm giá đã hết hạn.');
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng.');
    }
    if (coupon.users.length && !coupon.users.some((item) => item.userId === userId)) {
      throw new BadRequestException('Mã giảm giá không áp dụng cho tài khoản của bạn.');
    }
    if (coupon.minOrderAmount && subtotal.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Đơn hàng cần tối thiểu ${this.formatMoney(coupon.minOrderAmount)}đ để dùng mã này.`,
      );
    }

    const allowedVariantIds = new Set(coupon.products.map((item) => item.productVariantId));
    const eligibleItems = allowedVariantIds.size
      ? items.filter((item) => allowedVariantIds.has(item.variantId))
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
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue.toString(),
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
    await tx.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
    await tx.couponUsage.create({
      data: { couponId, userId, orderId, discountAmount },
    });
    await tx.activityLog.create({
      data: {
        userId,
        type: ActivityLogType.COUPON_APPLIED,
        entityName: 'coupon',
        entityId: couponId,
        metadata: { orderId, discountAmount: discountAmount.toString() },
      },
    });
  }

  async getCheckoutItems(tx: Prisma.TransactionClient, requestedItems: Array<{ variantId: string; quantity: number }>) {
    const variants = await tx.productVariant.findMany({
      where: {
        id: { in: requestedItems.map((item) => item.variantId) },
        active: true,
        isDeleted: false,
        product: { isDeleted: false, isActive: true },
      },
    });
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    return requestedItems.map((item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw new BadRequestException('Gói sản phẩm không còn khả dụng.');
      const unitPrice = variant.sellPrice;
      const totalPrice = unitPrice.mul(item.quantity);
      return { variantId: item.variantId, quantity: item.quantity, unitPrice, totalPrice };
    });
  }

  presentValidation(result: CouponValidationResult) {
    return {
      success: true,
      coupon: result.coupon,
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
      discountType: DiscountType;
      discountValue: Prisma.Decimal;
      maxDiscount: Prisma.Decimal | null;
    },
    eligibleSubtotal: Prisma.Decimal,
  ) {
    const raw =
      coupon.discountType === DiscountType.PERCENT
        ? eligibleSubtotal.mul(coupon.discountValue).div(100)
        : coupon.discountValue;
    const capped = coupon.maxDiscount ? Prisma.Decimal.min(raw, coupon.maxDiscount) : raw;
    return Prisma.Decimal.min(capped, eligibleSubtotal).toDecimalPlaces(0);
  }

  private normalizeCode(code?: string | null) {
    return code?.trim().toUpperCase() || null;
  }

  private formatMoney(value: Prisma.Decimal) {
    return Number(value).toLocaleString('vi-VN');
  }
}
