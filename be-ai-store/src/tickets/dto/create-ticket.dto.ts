import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsString()
  subject!: string;

  @IsString()
  content!: string;
}

export class CreateWarrantyTicketDto {
  @IsString()
  initData!: string;

  @IsUUID()
  orderId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  variantName?: string;

  @IsOptional()
  @IsString()
  accountLabel?: string;
}
