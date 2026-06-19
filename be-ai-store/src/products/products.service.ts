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
    const CACHE_KEY = 'ai-store:active-categories';

    const cached = await this.redisService.client.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const categories = await this.productsRepository.findActiveCategories();
    const result = categories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      productCount: category._count.products,
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
    const { categoryRef, ...rest } = product;

    return {
      ...rest,
      variants: product.variants.map(({ _count, ...variant }) => ({
        ...variant,
        availableStock: _count.inventories,
      })),
      category: categoryRef?.name || null,
      categoryIcon: categoryRef?.icon || null,
    };
  }
}
