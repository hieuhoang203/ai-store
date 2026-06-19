import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryStatus,
  InventoryStatus,
  OrderStatus,
  Payment,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { CouponsService } from '../coupons/coupons.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryPasswordService } from '../inventories/inventory-password.service';
import { InventoriesService } from '../inventories/inventories.service';
import { PAYMENT_QR_TTL_MS } from '../payments/payments.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderHistoryDto } from './dto/order-history.dto';

type NormalizedCheckoutItem = {
  variantId: string;
  quantity: number;
};

type PendingCheckoutOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payments: true;
  };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
    private readonly inventoriesService: InventoriesService,
    private readonly inventoryPasswordService: InventoryPasswordService,
    private readonly configService: ConfigService,
    private readonly couponsService: CouponsService,
  ) {}

  async checkout(dto: CheckoutDto) {
    const requestedItems = this.normalizeItems(dto);
    if (!requestedItems.length) {
      throw new BadRequestException('Giỏ hàng đang trống.');
    }
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const expiresAt = new Date(Date.now() + PAYMENT_QR_TTL_MS);

    const checkout = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      const couponItems = await this.couponsService.getCheckoutItems(tx, requestedItems);
      const couponSubtotal = this.couponsService.sumItems(couponItems);
      const couponValidation = await this.couponsService.validateCoupon(tx, {
        code: dto.couponCode,
        userId: user.id,
        items: couponItems,
        subtotal: couponSubtotal,
        lock: true,
      });
      const couponDiscount = couponValidation?.discountAmount || new Prisma.Decimal(0);

      const reusableCheckout = await this.findReusablePendingCheckout(
        tx,
        user.id,
        requestedItems,
        couponValidation?.coupon.id || null,
      );
      if (reusableCheckout?.status === 'ready') {
        return reusableCheckout;
      }

      if (reusableCheckout?.status === 'creating') {
        throw new BadRequestException('Đơn thanh toán đang được tạo. Vui lòng thử lại sau vài giây.');
      }

      for (const staleOrder of reusableCheckout?.staleOrders || []) {
        await this.expirePendingOrderInTransaction(tx, staleOrder.id);
      }

      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: requestedItems.map((item) => item.variantId) },
          active: true,
          isDeleted: false,
          product: { isDeleted: false, isActive: true },
        },
        include: { product: true },
      });

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      const items = requestedItems.map((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          throw new BadRequestException('Gói sản phẩm không còn khả dụng.');
        }

        const unitPrice = variant.sellPrice;
        const totalPrice = unitPrice.mul(item.quantity);
        return { ...item, unitPrice, totalPrice };
      });

      const subtotal = items.reduce(
        (sum, item) => sum.add(item.totalPrice),
        new Prisma.Decimal(0),
      );
      const createdOrder = await tx.order.create({
        data: {
          orderNo: `AI${this.createPayosOrderCode()}`,
          userId: user.id,
          subtotal,
          discount: couponDiscount,
          totalAmount: Prisma.Decimal.max(subtotal.sub(couponDiscount), new Prisma.Decimal(0)),
          couponId: couponValidation?.coupon.id,
          items: {
            create: items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: { items: true },
      });

      if (couponValidation) {
        await this.couponsService.recordCouponUsage(tx, {
          couponId: couponValidation.coupon.id,
          userId: user.id,
          orderId: createdOrder.id,
          discountAmount: couponValidation.discountAmount,
        });
      }

      const orderItemMap = new Map(createdOrder.items.map((item) => [item.variantId, item]));
      for (const item of items) {
        const reservedInventoryIds = await this.inventoriesService.reserveAvailableInventories(tx, {
          variantId: item.variantId,
          quantity: item.quantity,
          userId: user.id,
          orderId: createdOrder.id,
          reservedUntil: expiresAt,
        });
        const orderItem = orderItemMap.get(item.variantId);
        if (orderItem) {
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { inventoryId: reservedInventoryIds[0] },
          });
        }
      }

      return { status: 'created' as const, order: createdOrder };
    });

    if (checkout.status === 'ready') {
      return {
        order: checkout.order,
        payment: this.presentPayment(checkout.payment),
        reused: true,
      };
    }

    const order = checkout.order;
    let payment: Awaited<ReturnType<PaymentsService['createPayosPayment']>>;
    try {
      payment = await this.paymentsService.createPayosPayment(order.id, expiresAt);
    } catch (error) {
      await this.inventoriesService.releaseReservationForOrder(order.id);
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        },
      });
      throw error;
    }

    return { order, payment: this.presentPayment(payment) };
  }

  async getHistory(dto: OrderHistoryDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 10, 10);
    const where = {
      userId: user.id,
      isDeleted: false,
      OR: [
        { paymentStatus: PaymentStatus.PAID },
        { status: OrderStatus.DELIVERED },
      ],
    } satisfies Prisma.OrderWhereInput;
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
            include: {
              variant: { include: { product: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount.toString(),
        createdAt: order.createdAt,
        quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        products: order.items.map((item) => ({
          productName: item.variant.product.name,
          variantName: item.variant.name,
          quantity: item.quantity,
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
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
        isDeleted: false,
        OR: [
          { paymentStatus: PaymentStatus.PAID },
          { status: OrderStatus.DELIVERED },
        ],
      },
      include: {
        payments: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: { include: { product: true } },
            deliveries: {
              where: { isDeleted: false },
              orderBy: { createdAt: 'asc' },
              include: { inventory: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const payment = order.payments[0];
    const reviewByVariantId = new Map(
      order.reviews.map((review) => [review.productVariantId, review]),
    );
    const canReviewOrder =
      order.status === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.PAID;

    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      createdAt: order.createdAt,
      paidAt: payment?.paidAt,
      bankName: this.getBankName(payment?.qrContent),
      paymentContent: payment?.paymentContent,
      warrantyDays: this.getWarrantyDays(order.items),
      canReview:
        canReviewOrder &&
        order.items.some((item) => !reviewByVariantId.has(item.variantId)),
      review: order.reviews[0]
        ? {
            id: order.reviews[0].id,
            rating: order.reviews[0].rating,
            comment: order.reviews[0].comment,
            isHidden: order.reviews[0].isHidden,
          }
        : null,
      products: order.items.map((item) => {
        const review = reviewByVariantId.get(item.variantId);

        return {
          variantId: item.variantId,
          productName: item.variant.product.name,
          variantName: item.variant.name,
          quantity: item.quantity,
          warrantyDays: item.variant.warrantyDays,
          canReview: canReviewOrder && !review,
          review: review
            ? {
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                isHidden: review.isHidden,
              }
            : null,
          accounts: item.deliveries
            .filter((delivery) => delivery.status === DeliveryStatus.DELIVERED)
            .map((delivery) => {
              const metadata = this.normalizeMetadata(delivery.inventory.metadata);
              return {
                email: delivery.inventory.accountEmail,
                username: metadata.username || delivery.inventory.accountEmail,
                password: this.inventoryPasswordService.decrypt(delivery.inventory.encryptedPassword),
                twoFactor:
                  metadata.twoFactor ||
                  metadata.twoFa ||
                  metadata['2fa'] ||
                  metadata.pass2fa ||
                  null,
                deliveredAt: delivery.deliveredAt,
              };
            }),
        };
      }),
    };
  }

  async getProfileSummary(initData: string) {
    const user = await this.authService.getOrCreateTelegramUser(initData);
    const where = {
      userId: user.id,
      isDeleted: false,
      OR: [
        { paymentStatus: PaymentStatus.PAID },
        { status: OrderStatus.DELIVERED },
      ],
    } satisfies Prisma.OrderWhereInput;
    const [aggregate, orders] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.findMany({
        where,
        select: {
          items: {
            where: { isDeleted: false },
            select: {
              quantity: true,
              totalPrice: true,
              variant: {
                select: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const serviceMap = new Map<
      string,
      { productId: string; serviceName: string; accountCount: number; totalSpent: Prisma.Decimal }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const product = item.variant.product;
        const current =
          serviceMap.get(product.id) ||
          {
            productId: product.id,
            serviceName: product.name,
            accountCount: 0,
            totalSpent: new Prisma.Decimal(0),
          };

        current.accountCount += item.quantity;
        current.totalSpent = current.totalSpent.add(item.totalPrice);
        serviceMap.set(product.id, current);
      }
    }

    const serviceStats = Array.from(serviceMap.values())
      .sort((left, right) => right.accountCount - left.accountCount)
      .map((item) => ({
        ...item,
        totalSpent: item.totalSpent.toString(),
      }));

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId?.toString(),
        username: user.username,
        fullName: user.fullName,
      },
      stats: {
        orderCount: aggregate._count.id,
        totalSpent: aggregate._sum.totalAmount?.toString() || '0',
        accountCount: serviceStats.reduce((sum, item) => sum + item.accountCount, 0),
      },
      serviceStats,
      support: {
        telegram: this.configService.get<string>('SUPPORT_TELEGRAM') || '@hieuhv203',
      },
    };
  }

  private normalizeItems(dto: CheckoutDto) {
    const itemMap = new Map<string, number>();
    for (const item of dto.items) {
      itemMap.set(item.variantId, (itemMap.get(item.variantId) || 0) + item.quantity);
    }

    return Array.from(itemMap.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  private async findReusablePendingCheckout(
    tx: Prisma.TransactionClient,
    userId: string,
    requestedItems: NormalizedCheckoutItem[],
    couponId: string | null,
  ) {
    const candidates = await tx.order.findMany({
      where: {
        userId,
        couponId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        isDeleted: false,
        createdAt: { gt: new Date(Date.now() - PAYMENT_QR_TTL_MS * 2) },
      },
      include: {
        items: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          where: { status: PaymentStatus.PENDING, isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const matchingOrders = candidates.filter((order) => this.isSameCart(order.items, requestedItems));
    const staleOrders: PendingCheckoutOrder[] = [];

    for (const order of matchingOrders) {
      const payment = order.payments[0];
      if (!payment) {
        if (Date.now() - order.createdAt.getTime() < 30_000) {
          return { status: 'creating' as const };
        }

        staleOrders.push(order);
        continue;
      }

      if (this.isPaymentStillUsable(payment)) {
        return { status: 'ready' as const, order, payment };
      }

      staleOrders.push(order);
    }

    return { status: 'none' as const, staleOrders };
  }

  private isSameCart(
    orderItems: Array<{ variantId: string; quantity: number }>,
    requestedItems: NormalizedCheckoutItem[],
  ) {
    if (orderItems.length !== requestedItems.length) return false;

    const requestedMap = new Map(requestedItems.map((item) => [item.variantId, item.quantity]));
    return orderItems.every((item) => requestedMap.get(item.variantId) === item.quantity);
  }

  private isPaymentStillUsable(payment: Payment) {
    if (payment.status !== PaymentStatus.PENDING) return false;
    const expiresAt = this.getPaymentExpiresAt(payment.qrContent);
    return Boolean(expiresAt && expiresAt.getTime() > Date.now());
  }

  private getPaymentExpiresAt(qrContent?: string | null) {
    if (!qrContent) return null;

    try {
      const parsed = JSON.parse(qrContent) as { expiresAt?: unknown };
      if (typeof parsed.expiresAt !== 'string') return null;
      const expiresAt = new Date(parsed.expiresAt);
      return Number.isNaN(expiresAt.getTime()) ? null : expiresAt;
    } catch {
      return null;
    }
  }

  private async expirePendingOrderInTransaction(tx: Prisma.TransactionClient, orderId: string) {
    await tx.payment.updateMany({
      where: {
        orderId,
        status: PaymentStatus.PENDING,
      },
      data: { status: PaymentStatus.FAILED },
    });

    await tx.inventory.updateMany({
      where: {
        reservedOrderId: orderId,
      },
      data: {
        status: InventoryStatus.AVAILABLE,
        reservedBy: null,
        reservedAt: null,
        reservedUntil: null,
        reservedOrderId: null,
      },
    });

    await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  }

  private createPayosOrderCode() {
    return Date.now() * 100 + Math.floor(Math.random() * 100);
  }

  private presentPayment(payment: { qrContent: string | null } & Record<string, unknown>) {
    const qrContent = this.parseQrContent(payment.qrContent);
    return {
      ...payment,
      qrContent,
    };
  }

  private getWarrantyDays(
    items: Array<{ variant: { warrantyDays: number | null } }>,
  ) {
    const days = items
      .map((item) => item.variant.warrantyDays)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    return days.length ? Math.max(...days) : null;
  }

  private normalizeMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, value == null ? '' : String(value)]),
    );
  }

  private getBankName(qrContent?: string | null) {
    if (!qrContent) return null;

    try {
      const parsed = JSON.parse(qrContent) as { bin?: string; bankName?: string };
      if (parsed.bankName) return parsed.bankName;
      if (parsed.bin === '970422') return 'MB';
      return parsed.bin || null;
    } catch {
      return null;
    }
  }

  private parseQrContent(qrContent: string | null) {
    if (!qrContent) return null;
    try {
      return JSON.parse(qrContent) as unknown;
    } catch {
      return qrContent;
    }
  }
}
