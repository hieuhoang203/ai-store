import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './controllers/admin.controller';
import { AdminRepository } from './repositories/admin.repository';
import { AdminService } from './services/admin.service';

@Module({
  imports: [PrismaModule, InventoriesModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminRepository, AdminService],
})
export class AdminModule {}
