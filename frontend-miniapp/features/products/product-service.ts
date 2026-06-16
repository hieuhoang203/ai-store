import { api } from "@/services/api";

export type ProductVariant = {
  id: string;
  name: string;
  sellPrice: string;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  variants: ProductVariant[];
};

export async function getProducts() {
  const response = await api.get<Product[]>("/products");
  return response.data;
}
