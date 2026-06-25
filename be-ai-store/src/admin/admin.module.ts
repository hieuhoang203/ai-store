import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedisModule } from '../redis/redis.module';
import { AdminController } from './controllers/admin.controller';
import { AdminRepository } from './repositories/admin.repository';
import { AdminService } from './services/admin.service';

@Module({
  imports: [PrismaModule, DeliveriesModule, InventoriesModule, NotificationsModule, RedisModule],
  controllers: [AdminController],
  providers: [AdminRepository, AdminService],
})
export class AdminModule {}
