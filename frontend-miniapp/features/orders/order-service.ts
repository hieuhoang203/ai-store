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
