import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async listPublicProducts() {
    const products = await this.productsRepository.findActiveProducts();
    return products.map((product) => this.presentProduct(product));
  }

  async listActiveCategories() {
    const categories = await this.productsRepository.findActiveCategories();
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      productCount: category._count.products,
    }));
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
      category: categoryRef?.name || null,
      categoryIcon: categoryRef?.icon || null,
    };
  }
}
