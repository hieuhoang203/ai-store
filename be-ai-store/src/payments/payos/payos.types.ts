export type PayosPaymentItem = {
  name: string;
  quantity: number;
  price: number;
};

export type CreatePayosPaymentLinkInput = {
  orderCode: number;
  amount: number;
  description: string;
  items: PayosPaymentItem[];
  returnUrl: string;
  cancelUrl: string;
  expiredAt?: number;
};

export type PayosPaymentLinkData = {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
};

export type PayosPaymentLinkStatusData = {
  id?: string;
  orderCode: number;
  amount: number;
  amountPaid?: number;
  amountRemaining?: number;
  status: string;
  transactions?: Array<Record<string, unknown>>;
};

export type PayosWebhookBody = {
  code: string;
  desc: string;
  success: boolean;
  data: Record<string, unknown> & {
    orderCode?: number;
    amount?: number;
    description?: string;
    reference?: string;
    paymentLinkId?: string;
    code?: string;
  };
  signature: string;
};
