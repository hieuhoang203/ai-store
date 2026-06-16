import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { BankingQrAdapter } from './adapters/banking-qr.adapter';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, InventoriesModule, DeliveriesModule],
  controllers: [PaymentsController],
  providers: [BankingQrAdapter, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
