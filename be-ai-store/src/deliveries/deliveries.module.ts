import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { DeliveriesService } from './deliveries.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
