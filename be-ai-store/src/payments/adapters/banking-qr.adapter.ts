import { Injectable } from '@nestjs/common';
import { Payment } from '../../../generated/prisma/client.js';
import { PaymentProviderAdapter } from '../interfaces/payment-provider.interface';

@Injectable()
export class BankingQrAdapter implements PaymentProviderAdapter {
  createPaymentContent(orderNo: string, amount: string): string {
    return `AI_STORE ${orderNo} ${amount}`;
  }

  createQrContent(payment: Payment): string {
    return JSON.stringify({
      provider: payment.provider,
      amount: payment.amount.toString(),
      content: payment.paymentContent,
    });
  }
}
