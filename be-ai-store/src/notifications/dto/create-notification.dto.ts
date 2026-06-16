import { IsEnum, IsString, IsUUID } from 'class-validator';
import { NotificationType } from '../../../generated/prisma/client.js';

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  title!: string;

  @IsString()
  content!: string;
}
