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
      variants: product.variants.map(({ inventories, ...variant }) => ({
        ...variant,
        availableStock: inventories.reduce(
          (sum, inventory) => sum + this.getInventoryAvailableStock(inventory.metadata),
          0,
        ),
      })),
      category: categoryRef?.name || null,
      categoryIcon: categoryRef?.icon || null,
    };
  }

  private getInventoryAvailableStock(metadata: unknown) {
    const normalized = this.normalizeMetadata(metadata);
    if (normalized.inventoryType !== 'INVITE_LINK') return 1;

    const maxUses = this.toSafeInteger(normalized.maxUses);
    const usedSlots = this.toSafeInteger(normalized.usedSlots);
    const reservedSlots = Array.isArray(normalized.reservedSlots)
      ? normalized.reservedSlots.reduce((sum, item) => sum + this.toSafeInteger((item as Record<string, unknown>).quantity), 0)
      : 0;

    return Math.max(maxUses - usedSlots - reservedSlots, 0);
  }

  private normalizeMetadata(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, unknown>;
    }

    return metadata as Record<string, unknown>;
  }

  private toSafeInteger(value: unknown) {
    const number = Number(value || 0);
    return Number.isSafeInteger(number) && number > 0 ? number : 0;
  }
}
