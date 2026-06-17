import { api } from "@/services/api";

export type ProductVariant = {
  id: string;
  name: string;
  sellPrice: string;
  durationDays?: number | null;
  warrantyDays?: number | null;
  availableStock?: number;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  category?: string;
  categoryIcon?: string | null;
  imageUrl?: string;
  variants: ProductVariant[];
};

export async function getProducts() {
  const response = await api.get<Product[]>("/products");
  return response.data;
}
