import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly redisService: RedisService,
  ) {}

  async listPublicProducts() {
    const products = await this.productsRepository.findActiveProducts();
    return products.map((product) => this.presentProduct(product));
  }

  async listActiveCategories() {
    const CACHE_KEY = 'ai-store:active-categories:v2';
    const cached = await this.redisService.client.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const categories = await this.productsRepository.findActiveCategories();
    const result = categories.map((category) => ({
      id: category.id,
      name: category.tenLoai,
      icon: category.icon,
      productCount: category._count.sanPham,
    }));

    await this.redisService.client.set(CACHE_KEY, JSON.stringify(result), 'EX', 3600);
    return result;
  }

  async listPublicProductsByCategory(categoryId: string) {
    const products = await this.productsRepository.findActiveProductsByCategory(categoryId);
    return products.map((product) => this.presentProduct(product));
  }

  async detail(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return this.presentProduct(product);
  }

  private presentProduct(product: Awaited<ReturnType<ProductsRepository['findActiveProducts']>>[number]) {
    return {
      id: product.id,
      code: product.maSanPham,
      name: product.tenSanPham,
      description: product.moTa,
      categoryId: product.loaiId,
      category: product.loai?.tenLoai || null,
      categoryIcon: product.loai?.icon || null,
      imageUrl: product.anhDaiDien,
      variants: product.goiDichVu.map((goi) => ({
        id: goi.id,
        name: goi.tenGoi,
        sellPrice: goi.giaBan.toString(),
        durationDays: goi.thoiHanNgay,
        warrantyDays: goi.baoHanhNgay,
        availableStock: goi.tonHienThi,
        deliveryType: goi.phuongThuc[0]?.phuongThuc.kieu || null,
        deliveryConfig: goi.phuongThuc[0]?.cauHinh || goi.phuongThuc[0]?.phuongThuc.cauHinhMacDinh || null,
        requiresCustomerInput: goi.phuongThuc[0]?.phuongThuc.kieu === 'GUI_EMAIL_CHO_DOI_TAC',
        averageRating: '0',
        reviewCount: 0,
      })),
    };
  }
}
