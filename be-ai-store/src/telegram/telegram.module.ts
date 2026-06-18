import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../database/prisma.module';
import { InventoryPasswordService } from '../inventories/inventory-password.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [TelegramService, InventoryPasswordService],
  exports: [TelegramService],
})
export class TelegramModule {}
