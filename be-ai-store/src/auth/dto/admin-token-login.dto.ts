import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AdminTokenLoginDto {
  @ApiProperty({ description: 'One-time token sent by Telegram Bot' })
  @IsString()
  token!: string;
}
