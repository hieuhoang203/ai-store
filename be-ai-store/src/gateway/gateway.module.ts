import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { SupplierOnboardingController } from './supplier-onboarding.controller';
import { SupplierOnboardingService } from './supplier-onboarding.service';

@Module({
  imports: [AuthModule, DeliveriesModule, PrismaModule, RedisModule, InventoriesModule],
  controllers: [GatewayController, SupplierOnboardingController],
  providers: [GatewayService, SupplierOnboardingService],
})
export class GatewayModule {}
