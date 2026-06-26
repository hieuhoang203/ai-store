import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ required: false, description: 'Customer input required by delivery method, such as email/workspace' })
  @IsOptional()
  @IsObject()
  customerInput?: Record<string, unknown>;
}

export class CheckoutDto {
  @ApiProperty({ description: 'Telegram Mini App initData string' })
  @IsString()
  initData!: string;

  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
