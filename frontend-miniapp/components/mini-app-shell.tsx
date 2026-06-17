"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getProducts } from "@/features/products/product-service";
import { checkout } from "@/features/orders/order-service";
import { useTelegramViewport } from "@/hooks/use-telegram";
import { useCartStore } from "@/store/cart-store";
import { BottomNav } from "./bottom-nav";
import { CartView } from "./cart-view";
import { CategoryView } from "./category-view";
import { EmptyState } from "./empty-state";
import type { TabKey, ToastState } from "./mini-app-types";
import { ProductGrid } from "./product-grid";
import { ToastBanner } from "./toast-banner";
import { TopSummary } from "./top-summary";

export function MiniAppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: getProducts });
  const { items, addItem, removeItem, updateQuantity, clear } = useCartStore();
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

  async function submitCheckout() {
    const demoUserId = window.prompt("Nhập User ID để checkout");
    if (!demoUserId) return;

    setProcessing(true);
    try {
      await checkout(demoUserId, items);
      clear();
      setActiveTab("orders");
      showToast({ type: "success", message: "Đã tạo đơn hàng và QR payment" });
    } catch (error) {
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "Checkout thất bại",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen min-h-[100dvh] max-w-md flex-col overflow-hidden border-x border-white/10 bg-[#050805]/72 shadow-2xl shadow-black/50">
      <ToastBanner toast={toast} />

      <section className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-4">
        {activeTab === "home" ? (
          <>
            <TopSummary cartCount={cartCount} />
            <ProductGrid products={products} loading={isLoading} onAdd={(item) => {
              addItem(item);
              showToast({ type: "success", message: "Đã thêm vào giỏ hàng" });
            }} />
          </>
        ) : null}

        {activeTab === "categories" ? <CategoryView /> : null}

        {activeTab === "cart" ? (
          <CartView
            items={items}
            total={total}
            processing={processing}
            onRemove={removeItem}
            onQuantityChange={updateQuantity}
            onCheckout={submitCheckout}
          />
        ) : null}

        {activeTab === "orders" ? (
          <EmptyState title="Đơn hàng" text="Các đơn đã thanh toán và trạng thái giao hàng sẽ được đồng bộ tại đây." />
        ) : null}
        {activeTab === "profile" ? (
          <EmptyState title="Tài khoản" text="Thông tin Telegram, lịch sử mua hàng và quyền hỗ trợ sẽ hiển thị tại đây." />
        ) : null}
      </section>

      <BottomNav activeTab={activeTab} cartCount={cartCount} onSelect={setActiveTab} />
    </main>
  );
}
