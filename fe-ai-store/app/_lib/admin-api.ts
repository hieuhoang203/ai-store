import type { Dashboard, EntityConfig, ListResponse } from "./admin-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ai-store-lnin.onrender.com";

export const AUTH_TOKEN_KEY = "ai-store-admin-token";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getAdminEntities() {
  return adminRequest<EntityConfig[]>("/admin/entities");
}

export function getDashboard() {
  return adminRequest<Dashboard>("/admin/dashboard");
}

export function getEntityList(entityKey: string, page: number, search: string) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "10",
    search,
  });

  return adminRequest<ListResponse>(`/admin/${entityKey}?${params.toString()}`);
}

export function getEntityDetail(entityKey: string, recordId: unknown) {
  return adminRequest<Record<string, unknown>>(
    `/admin/${entityKey}/${encodeURIComponent(String(recordId))}`,
  );
}

export function createEntity(entityKey: string, payload: Record<string, unknown>) {
  return adminRequest(`/admin/${entityKey}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEntity(
  entityKey: string,
  recordId: unknown,
  payload: Record<string, unknown>,
) {
  return adminRequest(`/admin/${entityKey}/${encodeURIComponent(String(recordId))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteEntity(entityKey: string, recordId: unknown) {
  return adminRequest(`/admin/${entityKey}/${encodeURIComponent(String(recordId))}`, {
    method: "DELETE",
  });
}
