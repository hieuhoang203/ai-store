import { Module } from '@nestjs/common';
import { InventoriesModule } from '../inventories/inventories.module';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

@Module({
  imports: [PrismaModule, RedisModule, InventoriesModule],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
