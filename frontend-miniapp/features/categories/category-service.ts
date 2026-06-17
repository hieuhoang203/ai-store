import { api } from "@/services/api";
import type { Product } from "@/features/products/product-service";

export type Category = {
  id: string;
  name: string;
  icon?: string | null;
  productCount: number;
};

export async function getCategories() {
  const response = await api.get<Category[]>("/products/categories");
  return response.data;
}

export async function getProductsByCategory(categoryId: string) {
  const response = await api.get<Product[]>(`/products/categories/${categoryId}`);
  return response.data;
}
