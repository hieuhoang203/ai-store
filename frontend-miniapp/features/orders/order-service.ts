import { api } from "@/services/api";
import type { CartItem } from "@/store/cart-store";

export async function checkout(userId: string, items: CartItem[]) {
  const response = await api.post("/orders/checkout", {
    userId,
    items: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  });
  return response.data;
}
