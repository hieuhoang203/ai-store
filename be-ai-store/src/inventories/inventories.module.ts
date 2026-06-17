import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { InventoryPasswordService } from './inventory-password.service';
import { InventoriesService } from './inventories.service';

@Module({
  imports: [PrismaModule],
  providers: [InventoriesService, InventoryPasswordService],
  exports: [InventoriesService, InventoryPasswordService],
})
export class InventoriesModule {}
