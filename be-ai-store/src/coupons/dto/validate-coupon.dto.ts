import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ValidateCouponItemDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ValidateCouponDto {
  @ApiProperty({ description: 'Telegram Mini App initData string' })
  @IsString()
  initData!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ type: [ValidateCouponItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateCouponItemDto)
  items!: ValidateCouponItemDto[];
}
