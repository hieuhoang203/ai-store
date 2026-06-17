import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list() {
    return this.productsService.listPublicProducts();
  }

  @Get('categories')
  listCategories() {
    return this.productsService.listActiveCategories();
  }

  @Get('categories/:categoryId')
  listByCategory(@Param('categoryId') categoryId: string) {
    return this.productsService.listPublicProductsByCategory(categoryId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.productsService.detail(id);
  }
}
