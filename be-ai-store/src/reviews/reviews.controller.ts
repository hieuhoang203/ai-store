import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateReviewDto } from './dto/create-review.dto';
import { MyReviewsDto } from './dto/my-reviews.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.create(dto);
  }

  @Put('reviews/:id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, dto);
  }

  @Post('reviews/my')
  my(@Body() dto: MyReviewsDto) {
    return this.reviewsService.my(dto);
  }

  @Get('products/:id/reviews')
  productReviews(
    @Param('id') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.productReviews(productId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('admin/reviews/:id/hide')
  hide(@Param('id') id: string) {
    return this.reviewsService.setHidden(id, true);
  }

  @Patch('admin/reviews/:id/show')
  show(@Param('id') id: string) {
    return this.reviewsService.setHidden(id, false);
  }
}
