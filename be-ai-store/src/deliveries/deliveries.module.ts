import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { TelegramModule } from '../telegram/telegram.module';
import { DeliveriesService } from './deliveries.service';

@Module({
  imports: [PrismaModule, TelegramModule, InventoriesModule],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
