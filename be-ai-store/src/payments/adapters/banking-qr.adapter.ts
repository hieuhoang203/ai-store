import { Injectable } from '@nestjs/common';
import { ThanhToan } from '../../../generated/prisma/client.js';
import { PaymentProviderAdapter } from '../interfaces/payment-provider.interface';

@Injectable()
export class BankingQrAdapter implements PaymentProviderAdapter {
  createPaymentContent(orderNo: string, amount: string): string {
    return `AI_STORE ${orderNo} ${amount}`;
  }

  createQrContent(payment: ThanhToan): string {
    return JSON.stringify({
      provider: payment.nhaCungCapThanhToan,
      amount: payment.soTien.toString(),
      content: payment.noiDungThanhToan,
    });
  }
}
