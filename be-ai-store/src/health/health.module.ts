import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
