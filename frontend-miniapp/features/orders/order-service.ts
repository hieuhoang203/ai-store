import { api } from "@/services/api";
import type { CartItem } from "@/store/cart-store";

export type CheckoutPaymentQr = {
  provider: string;
  amount: number;
  currency: string;
  content: string;
  orderCode: number;
  paymentLinkId: string;
  checkoutUrl: string;
  qrCode: string;
  accountNumber: string;
  accountName: string;
  bin: string;
};

export type CheckoutResult = {
  order: {
    id: string;
    orderNo: string;
    totalAmount: string;
  };
  payment: {
    id: string;
    amount: string;
    paymentContent: string;
    status: string;
    qrContent: CheckoutPaymentQr | null;
  };
};

export type PaymentStatusResult = {
  payment: {
    id: string;
    status: string;
    paidAt?: string | null;
  };
  order: {
    id: string;
    orderNo: string;
    status: string;
    paymentStatus: string;
  };
  deliveries: Array<{
    id: string;
    status: string;
    deliveredAt?: string | null;
    content?: string | null;
    productName: string;
    variantName: string;
  }>;
};

export async function checkout(initData: string, items: CartItem[]) {
  const response = await api.post<CheckoutResult>("/orders/checkout", {
    initData,
    items: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  });
  return response.data;
}

export async function getPaymentStatus(paymentId: string) {
  const response = await api.get<PaymentStatusResult>(`/payments/${paymentId}/status`);
  return response.data;
}
