import { Payment } from '../../../generated/prisma/client.js';

export interface PaymentProviderAdapter {
  createPaymentContent(orderNo: string, amount: string): string;
  createQrContent(payment: Payment): string;
}
