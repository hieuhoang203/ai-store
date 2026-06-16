import { create } from "zustand";

export type CartItem = {
  variantId: string;
  name: string;
  price: string;
  quantity: number;
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
      const existing = state.items.find((cartItem) => cartItem.variantId === item.variantId);
      if (!existing) return { items: [...state.items, item] };
      return {
        items: state.items.map((cartItem) =>
          cartItem.variantId === item.variantId
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem,
        ),
      };
    }),
  removeItem: (variantId) =>
    set((state) => ({ items: state.items.filter((item) => item.variantId !== variantId) })),
  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.variantId === variantId ? { ...item, quantity: Math.max(quantity, 1) } : item,
      ),
    })),
  clear: () => set({ items: [] }),
}));
