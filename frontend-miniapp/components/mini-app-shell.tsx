"use client";

import { useQuery } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkout,
  getPaymentStatus,
  validateCoupon,
  type CouponValidationResult,
  type CheckoutResult,
} from "@/features/orders/order-service";
import { getProducts } from "@/features/products/product-service";
import { useTelegramUser, useTelegramViewport } from "@/hooks/use-telegram";
import { useCartStore, type CartItem } from "@/store/cart-store";
import { BottomNav } from "./bottom-nav";
import { CartView } from "./cart-view";
import { CategoryView } from "./category-view";
import type { TabKey, ToastState } from "./mini-app-types";
import { OrdersView } from "./orders-view";
import { ProductGrid } from "./product-grid";
import { ProfileView } from "./profile-view";
import { SupplierWorkspace } from "./supplier-workspace";
import { ToastBanner } from "./toast-banner";
import { TopSummary } from "./top-summary";

const text = {
  telegramRequired: "Vui l\u00f2ng m\u1edf Mini App t\u1eeb Telegram \u0111\u1ec3 thanh to\u00e1n",
  qrCreated: "\u0110\u00e3 t\u1ea1o m\u00e3 QR thanh to\u00e1n",
  qrReused: "Mã QR thanh toán còn hiệu lực, bạn có thể tiếp tục thanh toán.",
  checkoutFailed: "Thanh to\u00e1n th\u1ea5t b\u1ea1i",
  paymentSuccess: "Thanh to\u00e1n th\u00e0nh c\u00f4ng. T\u00e0i kho\u1ea3n \u0111ang \u0111\u01b0\u1ee3c giao.",
  addedToCart: "\u0110\u00e3 th\u00eam v\u00e0o gi\u1ecf h\u00e0ng",
  outOfStock: "S\u1ea3n ph\u1ea9m n\u00e0y \u0111\u00e3 h\u1ebft h\u00e0ng",
  stockLimitReached: "\u0110\u00e3 \u0111\u1ea1t s\u1ed1 l\u01b0\u1ee3ng t\u1ed1i \u0111a trong kho",
};

const PAYMENT_RESULT_STORAGE_KEY = "ai-store-payment-result";

export function MiniAppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<CheckoutResult | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [couponProcessing, setCouponProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [supplierMode, setSupplierMode] = useState<{
    connect: boolean;
    requestToken: string | null;
    inviteToken: string | null;
  }>({
    connect: false,
    requestToken: null,
    inviteToken: null,
  });
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
    const params = new URLSearchParams(window.location.search);
    const supplier = params.get("supplier") === "connect";
    const requestToken = params.get("supplierRequest");
    const inviteToken = params.get("token");
    if (supplier || requestToken) {
      setSupplierMode({ connect: supplier, requestToken, inviteToken });
      return;
    }

    const storedPaymentResult = window.sessionStorage.getItem(PAYMENT_RESULT_STORAGE_KEY);
    if (!storedPaymentResult) return;

    try {
      setPaymentResult(JSON.parse(storedPaymentResult) as CheckoutResult);
      setActiveTab("cart");
    } catch {
      window.sessionStorage.removeItem(PAYMENT_RESULT_STORAGE_KEY);
    }
  }, []);

  if (supplierMode.connect || supplierMode.requestToken) {
    return (
      <SupplierWorkspace
        initData={initData}
        requestToken={supplierMode.requestToken}
        inviteToken={supplierMode.inviteToken}
      />
    );
  }

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
    setCouponResult(null);
    showToast({ type: "success", message: text.addedToCart });
  }

  function handleRemoveItem(variantId: string) {
    removeItem(variantId);
    setCouponResult(null);
  }

  function handleQuantityChange(variantId: string, quantity: number) {
    updateQuantity(variantId, quantity);
    setCouponResult(null);
  }

  async function applyCoupon() {
    if (!initData) {
      showToast({ type: "error", message: text.telegramRequired });
      return;
    }
    if (!couponCode.trim()) {
      showToast({ type: "error", message: "Vui lòng nhập mã giảm giá" });
      return;
    }

    setCouponProcessing(true);
    try {
      const result = await validateCoupon(initData, couponCode, items);
      setCouponCode(result.coupon.code);
      setCouponResult(result);
      showToast({ type: "success", message: `Đã áp dụng ${result.coupon.code}` });
    } catch (error) {
      setCouponResult(null);
      showToast({ type: "error", message: error instanceof Error ? error.message : text.checkoutFailed });
    } finally {
      setCouponProcessing(false);
    }
  }

  async function submitCheckout() {
    if (!initData) {
      showToast({ type: "error", message: text.telegramRequired });
      return;
    }

    setProcessing(true);
    try {
      const result = await checkout(initData, items, couponResult?.coupon.code);
      setPaymentResult(result);
      window.sessionStorage.setItem(PAYMENT_RESULT_STORAGE_KEY, JSON.stringify(result));
      showToast({ type: "success", message: result.reused ? text.qrReused : text.qrCreated });
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
            couponCode={couponCode}
            couponResult={couponResult}
            couponProcessing={couponProcessing}
            onRemove={handleRemoveItem}
            onQuantityChange={handleQuantityChange}
            onCheckout={submitCheckout}
            onRenewPayment={submitCheckout}
            onCouponCodeChange={setCouponCode}
            onApplyCoupon={applyCoupon}
            onClearCoupon={() => {
              setCouponCode("");
              setCouponResult(null);
            }}
          />
        ) : null}

        {activeTab === "orders" ? (
          <OrdersView initData={initData} />
        ) : null}
        {activeTab === "profile" ? (
          <ProfileView initData={initData} />
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
