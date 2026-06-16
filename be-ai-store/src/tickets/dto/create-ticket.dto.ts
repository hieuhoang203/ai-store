import { IsOptional, IsString, IsUUID } from 'class-validator';

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
