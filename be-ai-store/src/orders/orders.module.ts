import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PrismaModule } from '../database/prisma.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, PaymentsModule, AuthModule, InventoriesModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
