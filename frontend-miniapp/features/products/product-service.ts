import { api } from "@/services/api";

export type ProductVariant = {
  id: string;
  name: string;
  sellPrice: string;
  durationDays?: number | null;
  warrantyDays?: number | null;
  availableStock?: number;
  averageRating?: string;
  reviewCount?: number;
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

export type ProductReview = {
  id: string;
  productVariantId: string;
  variantName?: string;
  userName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

export type ProductReviewsResult = {
  averageRating: string;
  reviewCount: number;
  data: ProductReview[];
};

export async function getProducts() {
  const response = await api.get<Product[]>("/products");
  return response.data;
}

export async function getProductReviews(productId: string) {
  const response = await api.get<ProductReviewsResult>(`/products/${productId}/reviews`, {
    params: { limit: 20 },
  });
  return response.data;
}
