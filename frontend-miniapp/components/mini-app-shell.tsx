"use client";

import { useQuery } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkout,
  getPaymentStatus,
  type CheckoutResult,
} from "@/features/orders/order-service";
import { getProducts } from "@/features/products/product-service";
import { useTelegramUser, useTelegramViewport } from "@/hooks/use-telegram";
import { useCartStore, type CartItem } from "@/store/cart-store";
import { BottomNav } from "./bottom-nav";
import { CartView } from "./cart-view";
import { CategoryView } from "./category-view";
import { EmptyState } from "./empty-state";
import type { TabKey, ToastState } from "./mini-app-types";
import { OrdersView } from "./orders-view";
import { ProductGrid } from "./product-grid";
import { ToastBanner } from "./toast-banner";
import { TopSummary } from "./top-summary";

const text = {
  telegramRequired: "Vui l\u00f2ng m\u1edf Mini App t\u1eeb Telegram \u0111\u1ec3 thanh to\u00e1n",
  qrCreated: "\u0110\u00e3 t\u1ea1o m\u00e3 QR thanh to\u00e1n",
  checkoutFailed: "Thanh to\u00e1n th\u1ea5t b\u1ea1i",
  paymentSuccess: "Thanh to\u00e1n th\u00e0nh c\u00f4ng. T\u00e0i kho\u1ea3n \u0111ang \u0111\u01b0\u1ee3c giao.",
  addedToCart: "\u0110\u00e3 th\u00eam v\u00e0o gi\u1ecf h\u00e0ng",
  outOfStock: "S\u1ea3n ph\u1ea9m n\u00e0y \u0111\u00e3 h\u1ebft h\u00e0ng",
  stockLimitReached: "\u0110\u00e3 \u0111\u1ea1t s\u1ed1 l\u01b0\u1ee3ng t\u1ed1i \u0111a trong kho",
  profileTitle: "T\u00e0i kho\u1ea3n",
  profileText: "Th\u00f4ng tin Telegram, l\u1ecbch s\u1eed mua h\u00e0ng v\u00e0 quy\u1ec1n h\u1ed7 tr\u1ee3 s\u1ebd hi\u1ec3n th\u1ecb t\u1ea1i \u0111\u00e2y.",
};

const PAYMENT_RESULT_STORAGE_KEY = "ai-store-payment-result";

export function MiniAppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<CheckoutResult | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: getProducts });
  const { items, addItem, removeItem, updateQuantity, clear } = useCartStore();
  const { initData } = useTelegramUser();
  const notifiedPaymentIds = useRef(new Set<string>());
  useTelegramViewport();
  const { data: paymentStatus } = useQuery({
    queryKey: ["payment-status", paymentResult?.payment.id],
    queryFn: () => getPaymentStatus(paymentResult!.payment.id),
    enabled: Boolean(paymentResult?.payment.id),
    refetchInterval: (query) => {
      const orderStatus = query.state.data?.order.status;
      const paymentStatus = query.state.data?.payment.status;
      if (paymentStatus === "FAILED") return false;
      return orderStatus === "DELIVERED" ? false : 3000;
    },
  });

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [items],
  );

  useEffect(() => {
    const storedPaymentResult = window.sessionStorage.getItem(PAYMENT_RESULT_STORAGE_KEY);
    if (!storedPaymentResult) return;

    try {
      setPaymentResult(JSON.parse(storedPaymentResult) as CheckoutResult);
      setActiveTab("cart");
    } catch {
      window.sessionStorage.removeItem(PAYMENT_RESULT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const paymentId = paymentStatus?.payment.id;
    const paid =
      paymentStatus?.payment.status === "PAID" ||
      paymentStatus?.order.status === "DELIVERED";

    if (!paymentId || !paid || notifiedPaymentIds.current.has(paymentId)) {
      return;
    }

    notifiedPaymentIds.current.add(paymentId);
    showToast({ type: "success", message: text.paymentSuccess });
    window.sessionStorage.removeItem(PAYMENT_RESULT_STORAGE_KEY);
    clear();
  }, [clear, paymentStatus]);

  function showToast(nextToast: ToastState) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3000);
  }

  function selectTab(tab: TabKey) {
    flushSync(() => {
      setActiveTab(tab);
    });
  }

  function handleAddToCart(item: CartItem) {
    const currentQuantity = items.find((cartItem) => cartItem.variantId === item.variantId)?.quantity || 0;

    if (item.availableStock !== undefined && item.availableStock <= 0) {
      showToast({ type: "error", message: text.outOfStock });
      return;
    }

    if (item.availableStock !== undefined && currentQuantity + item.quantity > item.availableStock) {
      showToast({ type: "error", message: text.stockLimitReached });
      return;
    }

    addItem(item);
    showToast({ type: "success", message: text.addedToCart });
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
      window.sessionStorage.setItem(PAYMENT_RESULT_STORAGE_KEY, JSON.stringify(result));
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
              onAdd={handleAddToCart}
            />
          </>
        ) : null}

        {activeTab === "categories" ? (
          <CategoryView
            onAdd={handleAddToCart}
          />
        ) : null}

        {activeTab === "cart" ? (
          <CartView
            items={items}
            total={total}
            processing={processing}
            paymentResult={paymentResult}
            paymentStatus={paymentStatus || null}
            onRemove={removeItem}
            onQuantityChange={updateQuantity}
            onCheckout={submitCheckout}
          />
        ) : null}

        {activeTab === "orders" ? (
          <OrdersView initData={initData} />
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
