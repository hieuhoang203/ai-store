import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import type { PayosWebhookBody } from './payos/payos.types';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payos/webhook')
  handlePayosWebhook(@Body() body: PayosWebhookBody) {
    return this.paymentsService.handlePayosWebhook(body);
  }
}
