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
    subtotal?: string;
    discount?: string;
    totalAmount: string;
  };
  payment: {
    id: string;
    amount: string;
    paymentContent: string;
    status: string;
    qrContent: CheckoutPaymentQr | null;
  };
  reused?: boolean;
};

export type CouponValidationResult = {
  success: boolean;
  coupon: {
    id: string;
    code: string;
    name: string;
    discountType: string;
    discountValue: string;
  };
  subtotal: string;
  eligibleSubtotal: string;
  discountAmount: string;
  finalAmount: string;
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
  subtotal?: string;
  discount?: string;
  totalAmount: string;
  createdAt: string;
  paidAt?: string | null;
  bankName?: string | null;
  paymentContent?: string | null;
  warrantyDays?: number | null;
  canReview?: boolean;
  review?: {
    id: string;
    rating: number;
    comment?: string | null;
    isHidden: boolean;
  } | null;
  products: Array<{
    variantId: string;
    productName: string;
    variantName: string;
    quantity: number;
    warrantyDays?: number | null;
    canReview?: boolean;
    review?: {
      id: string;
      rating: number;
      comment?: string | null;
      isHidden: boolean;
    } | null;
    accounts: Array<{
      email?: string | null;
      username?: string | null;
      password?: string | null;
      gatewayUrl?: string | null;
      twoFactor?: string | null;
      deliveredAt?: string | null;
    }>;
  }>;
};

export type ReviewResult = {
  id: string;
  orderId: string;
  productVariantId: string;
  rating: number;
  comment?: string | null;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
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

export type MyTicket = {
  id: string;
  code: string;
  subject: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNo: string;
  } | null;
};

export async function checkout(initData: string, items: CartItem[], couponCode?: string | null) {
  try {
    const response = await api.post<CheckoutResult>("/orders/checkout", {
      initData,
      couponCode: couponCode || undefined,
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function validateCoupon(initData: string, code: string, items: CartItem[]) {
  try {
    const response = await api.post<CouponValidationResult>("/checkout/validate-coupon", {
      initData,
      code,
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
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

export async function createWarrantyTicket(input: {
  initData: string;
  orderId: string;
  reason: string;
  productName?: string;
  variantName?: string;
  accountLabel?: string;
}) {
  const response = await api.post("/tickets/warranty", input);
  return response.data;
}

export async function getMyTickets(initData: string) {
  const response = await api.post<MyTicket[]>("/tickets/my", { initData });
  return response.data;
}

export async function createReview(input: {
  initData: string;
  orderId: string;
  productVariantId: string;
  rating: number;
  comment?: string;
}) {
  const response = await api.post<ReviewResult>("/reviews", input);
  return response.data;
}

export async function updateReview(
  reviewId: string,
  input: {
    initData: string;
    rating?: number;
    comment?: string;
  },
) {
  const response = await api.put<ReviewResult>(`/reviews/${reviewId}`, input);
  return response.data;
}

function getApiErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: unknown };
    if (Array.isArray(data.message)) return data.message.join("\n");
    if (typeof data.message === "string") return data.message;
  }

  return "Không thể tạo mã QR thanh toán. Vui lòng thử lại.";
}
