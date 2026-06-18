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
  expiresAt: string;
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
    expiresAt?: string | null;
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
  deliveryMessage?: string | null;
};

export type OrderHistoryItem = {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
  quantity: number;
  products: Array<{
    productName: string;
    variantName: string;
    quantity: number;
  }>;
};

export type OrderHistoryResult = {
  data: OrderHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type OrderDetail = {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
  paidAt?: string | null;
  bankName?: string | null;
  paymentContent?: string | null;
  warrantyDays?: number | null;
  products: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    warrantyDays?: number | null;
    accounts: Array<{
      email?: string | null;
      username?: string | null;
      password?: string | null;
      twoFactor?: string | null;
      deliveredAt?: string | null;
    }>;
  }>;
};

export type ProfileSummary = {
  user: {
    id: string;
    telegramId?: string | null;
    username?: string | null;
    fullName?: string | null;
  };
  stats: {
    orderCount: number;
    totalSpent: string;
    accountCount: number;
  };
  serviceStats: Array<{
    productId: string;
    serviceName: string;
    accountCount: number;
    totalSpent: string;
  }>;
  support: {
    telegram: string;
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

export async function getPaymentStatus(paymentId: string) {
  const response = await api.get<PaymentStatusResult>(`/payments/${paymentId}/status`);
  return response.data;
}

export async function getOrderHistory(initData: string, page = 1, limit = 10) {
  const response = await api.post<OrderHistoryResult>("/orders/history", { initData, page, limit });
  return response.data;
}

export async function getOrderDetail(initData: string, orderId: string) {
  const response = await api.post<OrderDetail>(`/orders/${orderId}/detail`, { initData });
  return response.data;
}

export async function getProfileSummary(initData: string) {
  const response = await api.post<ProfileSummary>("/orders/profile-summary", { initData });
  return response.data;
}
