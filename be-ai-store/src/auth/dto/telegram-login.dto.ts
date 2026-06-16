import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TelegramLoginDto {
  @ApiProperty({ description: 'Telegram Mini App initData string' })
  @IsString()
  initData!: string;
}
