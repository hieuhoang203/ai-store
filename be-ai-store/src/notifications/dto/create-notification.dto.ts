import { IsEnum, IsString, IsUUID } from 'class-validator';
import { LoaiThongBao } from '../../../generated/prisma/client.js';

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(LoaiThongBao)
  type!: LoaiThongBao;

  @IsString()
  title!: string;

  @IsString()
  content!: string;
}
