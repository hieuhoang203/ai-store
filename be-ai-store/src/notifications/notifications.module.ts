import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
