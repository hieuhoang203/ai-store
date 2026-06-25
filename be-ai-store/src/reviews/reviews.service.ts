import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrangThaiDonHang, TrangThaiThanhToan } from '../../generated/prisma/client.js';
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
    const order = await this.prisma.donHang.findFirst({
      where: {
        id: dto.orderId,
        nguoiDungId: user.id,
        daXoa: false,
        trangThai: TrangThaiDonHang.DA_GIAO,
        trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN,
      },
      include: { chiTiet: { where: { daXoa: false } } },
    });
    if (!order) throw new BadRequestException('Chỉ có thể đánh giá đơn hàng đã hoàn thành.');

    const goiDichVuId = dto.productVariantId || order.chiTiet[0]?.goiDichVuId;
    if (!goiDichVuId || !order.chiTiet.some((item) => item.goiDichVuId === goiDichVuId)) {
      throw new BadRequestException('Sản phẩm đánh giá không thuộc đơn hàng này.');
    }

    const existing = await this.prisma.danhGia.findFirst({ where: { donHangId: order.id, goiDichVuId } });
    if (existing && !existing.daXoa) throw new BadRequestException('Sản phẩm này đã được đánh giá.');

    const review = existing
      ? await this.prisma.danhGia.update({
          where: { id: existing.id },
          data: { soSao: dto.rating, noiDung: this.normalizeComment(dto.comment), biAn: false, daXoa: false },
        })
      : await this.prisma.danhGia.create({
          data: {
            donHangId: order.id,
            nguoiDungId: user.id,
            goiDichVuId,
            soSao: dto.rating,
            noiDung: this.normalizeComment(dto.comment),
          },
        });

    return this.presentReview(review);
  }

  async update(id: string, dto: UpdateReviewDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const review = await this.prisma.danhGia.findFirst({ where: { id, nguoiDungId: user.id, daXoa: false } });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');

    const updated = await this.prisma.danhGia.update({
      where: { id },
      data: {
        ...(dto.rating ? { soSao: dto.rating } : {}),
        ...(dto.comment !== undefined ? { noiDung: this.normalizeComment(dto.comment) } : {}),
      },
    });
    return this.presentReview(updated);
  }

  async my(dto: MyReviewsDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const page = Math.max(Number(dto.page || 1), 1);
    const limit = Math.min(Math.max(Number(dto.limit || 10), 1), 20);
    const where = { nguoiDungId: user.id, daXoa: false } satisfies Prisma.DanhGiaWhereInput;
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.danhGia.count({ where }),
      this.prisma.danhGia.findMany({
        where,
        include: { goiDichVu: { include: { sanPham: true } }, donHang: true, nguoiDung: true },
        orderBy: { taoLuc: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data: reviews.map((review) => this.presentReview(review)), pagination: this.pagination(page, limit, total) };
  }

  async productReviews(productId: string, query: { page?: number; limit?: number }) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), 20);
    const where = {
      daXoa: false,
      biAn: false,
      goiDichVu: { sanPhamId: productId, daXoa: false },
    } satisfies Prisma.DanhGiaWhereInput;
    const [total, reviews, aggregate] = await this.prisma.$transaction([
      this.prisma.danhGia.count({ where }),
      this.prisma.danhGia.findMany({
        where,
        include: { nguoiDung: true, goiDichVu: { include: { sanPham: true } }, donHang: true },
        orderBy: { taoLuc: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.danhGia.aggregate({ where, _avg: { soSao: true }, _count: { id: true } }),
    ]);

    return {
      averageRating: aggregate._avg.soSao ? Number(aggregate._avg.soSao).toFixed(1) : '0.0',
      reviewCount: aggregate._count.id,
      data: reviews.map((review) => this.presentReview(review)),
      pagination: this.pagination(page, limit, total),
    };
  }

  async setHidden(id: string, hidden: boolean) {
    const review = await this.prisma.danhGia.findUnique({ where: { id } });
    if (!review || review.daXoa) throw new NotFoundException('Không tìm thấy đánh giá.');
    return this.presentReview(await this.prisma.danhGia.update({ where: { id }, data: { biAn: hidden } }));
  }

  private presentReview(review: {
    id: string;
    donHangId: string;
    nguoiDungId: string;
    goiDichVuId: string;
    soSao: number;
    noiDung: string | null;
    biAn: boolean;
    taoLuc: Date;
    capNhatLuc: Date;
    nguoiDung?: { username: string | null; hoTen: string | null } | null;
    goiDichVu?: { tenGoi: string; sanPham?: { tenSanPham: string } | null } | null;
    donHang?: { maDonHang: string } | null;
  }) {
    return {
      id: review.id,
      orderId: review.donHangId,
      orderNo: review.donHang?.maDonHang,
      userId: review.nguoiDungId,
      userName: review.nguoiDung?.hoTen || review.nguoiDung?.username || 'Khách hàng',
      productVariantId: review.goiDichVuId,
      productName: review.goiDichVu?.sanPham?.tenSanPham,
      variantName: review.goiDichVu?.tenGoi,
      rating: review.soSao,
      comment: review.noiDung,
      isHidden: review.biAn,
      createdAt: review.taoLuc,
      updatedAt: review.capNhatLuc,
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
