import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLogType, AuditAction, OrderStatus, PaymentStatus, Prisma } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { MyReviewsDto } from './dto/my-reviews.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(dto: CreateReviewDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: dto.orderId,
          userId: user.id,
          isDeleted: false,
          status: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
        },
        include: { items: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } } },
      });

      if (!order) throw new BadRequestException('Chỉ có thể đánh giá đơn hàng đã hoàn thành.');
      const productVariantId = dto.productVariantId || order.items[0]?.variantId;
      if (!productVariantId || !order.items.some((item) => item.variantId === productVariantId)) {
        throw new BadRequestException('Sản phẩm đánh giá không thuộc đơn hàng này.');
      }

      const existing = await tx.review.findUnique({ where: { orderId: order.id } });
      if (existing && !existing.isDeleted) {
        throw new BadRequestException('Đơn hàng này đã được đánh giá.');
      }

      const review = existing
        ? await tx.review.update({
            where: { id: existing.id },
            data: {
              productVariantId,
              rating: dto.rating,
              comment: this.normalizeComment(dto.comment),
              isHidden: false,
              isDeleted: false,
            },
          })
        : await tx.review.create({
            data: {
              orderId: order.id,
              userId: user.id,
              productVariantId,
              rating: dto.rating,
              comment: this.normalizeComment(dto.comment),
            },
          });

      await this.updateVariantAggregate(tx, productVariantId);
      await tx.activityLog.create({
        data: {
          userId: user.id,
          type: ActivityLogType.REVIEW_CREATED,
          entityName: 'review',
          entityId: review.id,
          metadata: { orderId: order.id, rating: dto.rating },
        },
      });

      return this.presentReview(review);
    });
  }

  async update(id: string, dto: UpdateReviewDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findFirst({
        where: { id, userId: user.id, isDeleted: false },
      });
      if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');

      const updated = await tx.review.update({
        where: { id },
        data: {
          ...(dto.rating ? { rating: dto.rating } : {}),
          ...(dto.comment !== undefined ? { comment: this.normalizeComment(dto.comment) } : {}),
        },
      });

      await this.updateVariantAggregate(tx, updated.productVariantId);
      await tx.activityLog.create({
        data: {
          userId: user.id,
          type: ActivityLogType.REVIEW_UPDATED,
          entityName: 'review',
          entityId: updated.id,
          metadata: { rating: updated.rating },
        },
      });

      return this.presentReview(updated);
    });
  }

  async my(dto: MyReviewsDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const page = Math.max(Number(dto.page || 1), 1);
    const limit = Math.min(Math.max(Number(dto.limit || 10), 1), 20);
    const where = { userId: user.id, isDeleted: false } satisfies Prisma.ReviewWhereInput;
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { productVariant: { include: { product: true } }, order: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: reviews.map((review) => this.presentReview(review)),
      pagination: this.pagination(page, limit, total),
    };
  }

  async productReviews(productId: string, query: { page?: number; limit?: number }) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), 20);
    const where = {
      isDeleted: false,
      isHidden: false,
      productVariant: { productId, isDeleted: false },
    } satisfies Prisma.ReviewWhereInput;
    const [total, reviews, aggregate] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { user: true, productVariant: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.aggregate({ where, _avg: { rating: true }, _count: { id: true } }),
    ]);

    return {
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating).toFixed(1) : '0.0',
      reviewCount: aggregate._count.id,
      data: reviews.map((review) => this.presentReview(review)),
      pagination: this.pagination(page, limit, total),
    };
  }

  async setHidden(id: string, hidden: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review || review.isDeleted) throw new NotFoundException('Không tìm thấy đánh giá.');

      const updated = await tx.review.update({ where: { id }, data: { isHidden: hidden } });
      await this.updateVariantAggregate(tx, updated.productVariantId);
      await tx.auditLog.create({
        data: {
          entityName: 'review',
          entityId: updated.id,
          action: hidden ? AuditAction.REVIEW_HIDE : AuditAction.REVIEW_SHOW,
          oldData: { isHidden: review.isHidden },
          newData: { isHidden: hidden },
        },
      });

      return this.presentReview(updated);
    });
  }

  private async updateVariantAggregate(tx: Prisma.TransactionClient, productVariantId: string) {
    const aggregate = await tx.review.aggregate({
      where: { productVariantId, isDeleted: false, isHidden: false },
      _avg: { rating: true },
      _count: { id: true },
    });
    await tx.productVariant.update({
      where: { id: productVariantId },
      data: {
        averageRating: new Prisma.Decimal(aggregate._avg.rating || 0).toDecimalPlaces(2),
        reviewCount: aggregate._count.id,
      },
    });
  }

  private presentReview(review: {
    id: string;
    orderId: string;
    userId: string;
    productVariantId: string;
    rating: number;
    comment: string | null;
    isHidden: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: { username: string | null; fullName: string | null } | null;
    productVariant?: { name: string; product?: { name: string } } | null;
    order?: { orderNo: string } | null;
  }) {
    return {
      id: review.id,
      orderId: review.orderId,
      orderNo: review.order?.orderNo,
      userId: review.userId,
      userName: review.user?.fullName || review.user?.username || 'Khách hàng',
      productVariantId: review.productVariantId,
      productName: review.productVariant?.product?.name,
      variantName: review.productVariant?.name,
      rating: review.rating,
      comment: review.comment,
      isHidden: review.isHidden,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  private normalizeComment(comment?: string) {
    const normalized = comment?.trim();
    return normalized || null;
  }

  private pagination(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    };
  }
}
