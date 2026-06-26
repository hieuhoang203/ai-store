import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BankingQrAdapter } from './adapters/banking-qr.adapter';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayosService } from './payos/payos.service';

@Module({
  imports: [PrismaModule, InventoriesModule, DeliveriesModule, TelegramModule],
  controllers: [PaymentsController],
  providers: [BankingQrAdapter, PayosService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
