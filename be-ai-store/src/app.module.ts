import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CouponsModule } from './coupons/coupons.module';
import { PrismaModule } from './database/prisma.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';
import { InventoriesModule } from './inventories/inventories.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { ReviewsModule } from './reviews/reviews.module';
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
        APP_PUBLIC_URL: Joi.string().uri().default('https://ai-store-lnin.onrender.com'),
        JWT_ACCESS_SECRET: Joi.string().default('dev-access-secret'),
        JWT_REFRESH_SECRET: Joi.string().default('dev-refresh-secret'),
        INVENTORY_PASSWORD_SECRET: Joi.string().default('local-inventory-password-secret'),
        TELEGRAM_BOT_TOKEN: Joi.string().allow('').default(''),
        TELEGRAM_MINIAPP_URL: Joi.string().uri().default('https://ai-store-o29h.vercel.app'),
        ADMIN_APP_URL: Joi.string().uri().default('https://ai-store-kappa-beige.vercel.app'),
        PAYOS_CLIENT_ID: Joi.string().allow('').default(''),
        PAYOS_API_KEY: Joi.string().allow('').default(''),
        PAYOS_CHECKSUM_KEY: Joi.string().allow('').default(''),
        PAYOS_API_BASE_URL: Joi.string().uri().default('https://api-merchant.payos.vn'),
        PAYOS_PAYMENT_DESCRIPTION_PREFIX: Joi.string().max(60).default('AI Store'),
        CLOUDINARY_URL: Joi.string().allow('').default(''),
        SUPPORT_NAME: Joi.string().allow('').default('AI Store Support'),
        SUPPORT_PHONE: Joi.string().allow('').default('0966628527'),
        SUPPORT_TELEGRAM: Joi.string().allow('').default('@hieuhv203'),
        SUPPORT_ZALO: Joi.string().allow('').default('0966628527'),
        SUPPORT_EMAIL: Joi.string().allow('').default('hieuhv203@gmail.com'),
        SUPPORT_WORKING_TIME: Joi.string().allow('').default('08:00 - 22:00 hằng ngày'),
      }),
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    TelegramModule,
    CouponsModule,
    ProductsModule,
    InventoriesModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    DeliveriesModule,
    GatewayModule,
    NotificationsModule,
    TicketsModule,
    JobsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
