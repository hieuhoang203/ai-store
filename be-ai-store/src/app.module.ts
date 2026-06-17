import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './database/prisma.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { HealthModule } from './health/health.module';
import { InventoriesModule } from './inventories/inventories.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { RolesModule } from './roles/roles.module';
import { TelegramModule } from './telegram/telegram.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(8903),
        DATABASE_URL: Joi.string().uri().required(),
        REDIS_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().default('dev-access-secret'),
        JWT_REFRESH_SECRET: Joi.string().default('dev-refresh-secret'),
        INVENTORY_PASSWORD_SECRET: Joi.string().default('local-inventory-password-secret'),
        TELEGRAM_BOT_TOKEN: Joi.string().allow('').default(''),
        TELEGRAM_MINIAPP_URL: Joi.string().uri().default('https://2731-2402-800-61c5-9c30-2090-8aa1-d4e2-64cd.ngrok-free.app'),
        ADMIN_APP_URL: Joi.string().uri().default('http://localhost:2110'),
        PAYOS_CLIENT_ID: Joi.string().allow('').default(''),
        PAYOS_API_KEY: Joi.string().allow('').default(''),
        PAYOS_CHECKSUM_KEY: Joi.string().allow('').default(''),
        PAYOS_API_BASE_URL: Joi.string().uri().default('https://api-merchant.payos.vn'),
        PAYOS_PAYMENT_DESCRIPTION_PREFIX: Joi.string().max(60).default('AI Store'),
      }),
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    TelegramModule,
    ProductsModule,
    InventoriesModule,
    OrdersModule,
    PaymentsModule,
    DeliveriesModule,
    NotificationsModule,
    TicketsModule,
    JobsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
