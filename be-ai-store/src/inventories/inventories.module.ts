import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { InventoriesService } from './inventories.service';

@Module({
  imports: [PrismaModule],
  providers: [InventoriesService],
  exports: [InventoriesService],
})
export class InventoriesModule {}
