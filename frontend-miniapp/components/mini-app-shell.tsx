"use client";

import { useQuery } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { useMemo, useState } from "react";
import { checkout, type CheckoutResult } from "@/features/orders/order-service";
import { getProducts } from "@/features/products/product-service";
import { useTelegramUser, useTelegramViewport } from "@/hooks/use-telegram";
import { useCartStore } from "@/store/cart-store";
import { BottomNav } from "./bottom-nav";
import { CartView } from "./cart-view";
import { CategoryView } from "./category-view";
import { EmptyState } from "./empty-state";
import type { TabKey, ToastState } from "./mini-app-types";
import { ProductGrid } from "./product-grid";
import { ToastBanner } from "./toast-banner";
import { TopSummary } from "./top-summary";

const text = {
  telegramRequired: "Vui l\u00f2ng m\u1edf Mini App t\u1eeb Telegram \u0111\u1ec3 thanh to\u00e1n",
  qrCreated: "\u0110\u00e3 t\u1ea1o m\u00e3 QR thanh to\u00e1n",
  checkoutFailed: "Thanh to\u00e1n th\u1ea5t b\u1ea1i",
  addedToCart: "\u0110\u00e3 th\u00eam v\u00e0o gi\u1ecf h\u00e0ng",
  ordersTitle: "\u0110\u01a1n h\u00e0ng",
  ordersText: "C\u00e1c \u0111\u01a1n \u0111\u00e3 thanh to\u00e1n v\u00e0 tr\u1ea1ng th\u00e1i giao h\u00e0ng s\u1ebd \u0111\u01b0\u1ee3c \u0111\u1ed3ng b\u1ed9 t\u1ea1i \u0111\u00e2y.",
  profileTitle: "T\u00e0i kho\u1ea3n",
  profileText: "Th\u00f4ng tin Telegram, l\u1ecbch s\u1eed mua h\u00e0ng v\u00e0 quy\u1ec1n h\u1ed7 tr\u1ee3 s\u1ebd hi\u1ec3n th\u1ecb t\u1ea1i \u0111\u00e2y.",
};

export function MiniAppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<CheckoutResult | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: getProducts });
  const { items, addItem, removeItem, updateQuantity } = useCartStore();
  const { initData } = useTelegramUser();
  useTelegramViewport();

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [items],
  );

  function showToast(nextToast: ToastState) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3000);
  }

  function selectTab(tab: TabKey) {
    flushSync(() => {
      setActiveTab(tab);
    });
  }

  async function submitCheckout() {
    if (!initData) {
      showToast({ type: "error", message: text.telegramRequired });
      return;
    }

    setProcessing(true);
    try {
      const result = await checkout(initData, items);
      setPaymentResult(result);
      showToast({ type: "success", message: text.qrCreated });
    } catch (error) {
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : text.checkoutFailed,
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen min-h-[100dvh] max-w-md flex-col overflow-hidden border-x border-white/10 bg-[#050805]/72 pb-[calc(72px+env(safe-area-inset-bottom))] shadow-2xl shadow-black/50">
      <ToastBanner toast={toast} />

      <section className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-4">
        {activeTab === "home" ? (
          <>
            <TopSummary cartCount={cartCount} />
            <ProductGrid
              products={products}
              loading={isLoading}
              onAdd={(item) => {
                addItem(item);
                showToast({ type: "success", message: text.addedToCart });
              }}
            />
          </>
        ) : null}

        {activeTab === "categories" ? (
          <CategoryView
            onAdd={(item) => {
              addItem(item);
              showToast({ type: "success", message: text.addedToCart });
            }}
          />
        ) : null}

        {activeTab === "cart" ? (
          <CartView
            items={items}
            total={total}
            processing={processing}
            paymentResult={paymentResult}
            onRemove={removeItem}
            onQuantityChange={updateQuantity}
            onCheckout={submitCheckout}
          />
        ) : null}

        {activeTab === "orders" ? (
          <EmptyState title={text.ordersTitle} text={text.ordersText} />
        ) : null}
        {activeTab === "profile" ? (
          <EmptyState title={text.profileTitle} text={text.profileText} />
        ) : null}
      </section>

      <BottomNav
        activeTab={activeTab}
        cartCount={cartCount}
        onSelect={selectTab}
      />
    </main>
  );
}
