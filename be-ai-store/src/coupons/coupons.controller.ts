import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CouponsService } from './coupons.service';

@ApiTags('checkout')
@Controller('checkout')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate-coupon')
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validateCouponForTelegramUser(dto);
  }
}
