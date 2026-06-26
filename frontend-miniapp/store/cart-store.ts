import { create } from "zustand";

export type CartItem = {
  variantId: string;
  name: string;
  price: string;
  quantity: number;
  availableStock?: number;
  customerInput?: Record<string, unknown>;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
};

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      if (item.availableStock !== undefined && item.availableStock <= 0) return state;
      const existing = state.items.find((cartItem) => cartItem.variantId === item.variantId);
      if (!existing) {
        return {
          items: [
            ...state.items,
            {
              ...item,
              quantity: item.availableStock ? Math.min(item.quantity, item.availableStock) : item.quantity,
            },
          ],
        };
      }
      const availableStock = item.availableStock ?? existing.availableStock;
      const nextQuantity = existing.quantity + item.quantity;
      return {
        items: state.items.map((cartItem) =>
          cartItem.variantId === item.variantId
            ? {
                ...cartItem,
                availableStock,
                quantity: availableStock ? Math.min(nextQuantity, availableStock) : nextQuantity,
              }
            : cartItem,
        ),
      };
    }),
  removeItem: (variantId) =>
    set((state) => ({ items: state.items.filter((item) => item.variantId !== variantId) })),
  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.variantId === variantId
          ? {
              ...item,
              quantity: Math.min(Math.max(quantity, 1), item.availableStock || Number.POSITIVE_INFINITY),
            }
          : item,
      ),
    })),
  clear: () => set({ items: [] }),
}));
