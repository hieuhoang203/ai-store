import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MyReviewsDto {
  @ApiProperty({ description: 'Telegram Mini App initData string' })
  @IsString()
  initData!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  limit?: number;
}
