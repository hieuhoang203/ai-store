import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1 AS ok`,
      this.redis.ping(),
    ]);

    return {
      status: 'ok',
      database,
      redis,
      checkedAt: new Date().toISOString(),
    };
  }
}
