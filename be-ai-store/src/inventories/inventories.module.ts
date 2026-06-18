import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryPasswordService } from './inventory-password.service';
import { InventoriesService } from './inventories.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [InventoriesService, InventoryPasswordService],
  exports: [InventoriesService, InventoryPasswordService],
})
export class InventoriesModule {}
