import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderHistoryDto } from './dto/order-history.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.ordersService.checkout(dto);
  }

  @Post('history')
  history(@Body() dto: OrderHistoryDto) {
    return this.ordersService.getHistory(dto);
  }

  @Post('profile-summary')
  profileSummary(@Body() dto: OrderHistoryDto) {
    return this.ordersService.getProfileSummary(dto.initData);
  }

  @Post(':id/detail')
  detail(@Param('id') id: string, @Body() dto: OrderHistoryDto) {
    return this.ordersService.getDetail(id, dto.initData);
  }
}
