import { api } from "@/services/api";

export type SupplierConnectResult = {
  inviteLink: string;
  supplier: {
    id: string;
    telegramId?: string | null;
    username?: string | null;
    displayName: string;
    status: string;
  };
};

export type SupplierRequestDetail = {
  id: string;
  code: string;
  status: string;
  quantity: number;
  customerInput?: unknown;
  order: {
    id: string;
    orderNo: string;
  };
  product: {
    id: string;
    name: string;
    variantName: string;
    deliveryType: string;
  };
};

export async function connectSupplier(input: {
  initData: string;
  displayName?: string;
  phone?: string;
  email?: string;
  token?: string;
}) {
  const response = await api.post<SupplierConnectResult>("/suppliers/connect", input);
  return response.data;
}

export async function getSupplierRequest(token: string, initData: string) {
  const response = await api.get<SupplierRequestDetail>(`/suppliers/requests/${token}`, {
    params: { initData },
  });
  return response.data;
}

export async function fulfillSupplierRequest(token: string, input: { initData: string; payload: Record<string, unknown> }) {
  const response = await api.post(`/suppliers/requests/${token}/fulfill`, input);
  return response.data;
}
