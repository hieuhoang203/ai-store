"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clipboard, Package, ReceiptText, ShieldCheck } from "lucide-react";
import {
  getOrderDetail,
  getOrderHistory,
  type OrderDetail,
  type OrderHistoryItem,
} from "@/features/orders/order-service";
import { EmptyState } from "./empty-state";

const PAGE_SIZE = 10;

const text = {
  title: "Lịch sử mua hàng",
  subtitle: "Chọn đơn để xem chi tiết tài khoản đã giao.",
  telegramRequired: "Vui lòng mở Mini App từ Telegram để xem đơn hàng.",
  emptyTitle: "Chưa có đơn hàng",
  emptyText: "Các đơn đã thanh toán sẽ hiển thị tại đây.",
  back: "Quay lại danh sách đơn",
  copied: "Đã copy",
};

export function OrdersView({ initData }: { initData?: string }) {
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const ordersQuery = useQuery({
    queryKey: ["order-history", initData, page],
    queryFn: () => getOrderHistory(initData!, page, PAGE_SIZE),
    enabled: Boolean(initData),
  });
  const detailQuery = useQuery({
    queryKey: ["order-detail", initData, selectedOrderId],
    queryFn: () => getOrderDetail(initData!, selectedOrderId!),
    enabled: Boolean(initData && selectedOrderId),
  });

  async function copyValue(key: string, value?: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1200);
  }

  if (!initData) {
    return <EmptyState title={text.title} text={text.telegramRequired} />;
  }

  if (selectedOrderId) {
    return (
      <OrderDetailPanel
        order={detailQuery.data}
        loading={detailQuery.isLoading}
        copiedKey={copiedKey}
        onCopy={copyValue}
        onBack={() => setSelectedOrderId(null)}
      />
    );
  }

  if (ordersQuery.isLoading) {
    return (
      <section className="mini-fade space-y-3">
        <OrdersHeader />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
        ))}
      </section>
    );
  }

  const result = ordersQuery.data;
  const orders = result?.data || [];
  const pagination = result?.pagination;
  if (!orders.length) {
    return <EmptyState title={text.emptyTitle} text={text.emptyText} />;
  }

  return (
    <section className="mini-fade space-y-3">
      <OrdersHeader />
      {orders.map((order, index) => (
        <OrderCard key={order.id} order={order} index={index} onSelect={() => setSelectedOrderId(order.id)} />
      ))}
      {pagination ? (
        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          hasPreviousPage={pagination.hasPreviousPage}
          hasNextPage={pagination.hasNextPage}
          onPrevious={() => setPage((value) => Math.max(value - 1, 1))}
          onNext={() => setPage((value) => Math.min(value + 1, pagination.totalPages))}
        />
      ) : null}
    </section>
  );
}

function OrdersHeader() {
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Đơn hàng</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{text.title}</h2>
      <p className="mt-1 text-sm leading-5 text-zinc-400">{text.subtitle}</p>
    </div>
  );
}

function OrderCard({ order, index, onSelect }: { order: OrderHistoryItem; index: number; onSelect: () => void }) {
  const firstProduct = order.products[0];
  const productText = firstProduct
    ? `${firstProduct.productName} ${firstProduct.variantName}${order.products.length > 1 ? ` +${order.products.length - 1}` : ""}`
    : "Đơn hàng AI Store";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="mini-rise w-full rounded-xl border border-white/10 bg-white/[0.045] p-3 text-left shadow-lg shadow-black/20 transition hover:border-emerald-300/30"
      style={{ animationDelay: `${index * 34}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-300">
          <Package className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-white">{order.orderNo}</p>
            <span className="shrink-0 text-sm font-bold text-emerald-300">{formatMoney(order.totalAmount)} đ</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-zinc-300">{productText}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-zinc-400">
            <span className="rounded-full bg-black/35 px-2 py-1">{formatStatus(order.status, order.paymentStatus)}</span>
            <span className="rounded-full bg-black/35 px-2 py-1">{order.quantity} tài khoản</span>
            <span className="rounded-full bg-black/35 px-2 py-1">{formatDateTime(order.createdAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  hasPreviousPage,
  hasNextPage,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPreviousPage}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Trang trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 text-center">
        <p className="text-sm font-bold text-white">Trang {page}/{totalPages}</p>
        <p className="text-xs font-semibold text-zinc-500">{total} đơn hàng</p>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNextPage}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Trang sau"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function OrderDetailPanel({
  order,
  loading,
  copiedKey,
  onCopy,
  onBack,
}: {
  order?: OrderDetail;
  loading: boolean;
  copiedKey: string | null;
  onCopy: (key: string, value?: string | null) => void;
  onBack: () => void;
}) {
  if (loading || !order) {
    return (
      <section className="mini-fade space-y-3">
        <BackButton onBack={onBack} />
        <div className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
      </section>
    );
  }

  return (
    <section className="mini-fade space-y-3">
      <BackButton onBack={onBack} />

      <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 shadow-xl shadow-black/20">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/30 text-emerald-300">
            <ReceiptText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Chi tiết đơn</p>
            <h2 className="mt-1 break-words text-xl font-bold text-white">{order.orderNo}</h2>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <InfoRow label="Trạng thái" value={formatStatus(order.status, order.paymentStatus)} important />
          <InfoRow label="Tổng tiền" value={`${formatMoney(order.totalAmount)} đ`} important />
          <InfoRow label="Ngân hàng" value={order.bankName || "-"} />
          <InfoRow label="Mã CK" value={order.paymentContent || "-"} />
          <InfoRow label="Thời gian" value={formatDateTime(order.createdAt)} />
        </dl>
      </div>

      {order.products.map((product, productIndex) => (
        <article key={`${product.productName}-${product.variantName}-${productIndex}`} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-base font-bold text-white">
                {product.productName} ({product.variantName})
              </h3>
              <p className="mt-1 text-xs font-semibold text-zinc-500">{product.quantity} tài khoản</p>
            </div>
            {product.warrantyDays ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[11px] font-bold text-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                {product.warrantyDays} ngày
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {product.accounts.length ? (
              product.accounts.map((account, accountIndex) => (
                <div key={`${productIndex}-${accountIndex}`} className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Tài khoản {product.accounts.length > 1 ? `#${accountIndex + 1}` : ""}
                  </p>
                  <CopyRow
                    label="Username"
                    value={account.username || account.email || "-"}
                    copied={copiedKey === `${productIndex}-${accountIndex}-username`}
                    onCopy={() => onCopy(`${productIndex}-${accountIndex}-username`, account.username || account.email)}
                  />
                  <CopyRow
                    label="Password"
                    value={account.password || "-"}
                    copied={copiedKey === `${productIndex}-${accountIndex}-password`}
                    onCopy={() => onCopy(`${productIndex}-${accountIndex}-password`, account.password)}
                  />
                  {account.twoFactor ? (
                    <CopyRow
                      label="2FA"
                      value={account.twoFactor}
                      copied={copiedKey === `${productIndex}-${accountIndex}-2fa`}
                      onCopy={() => onCopy(`${productIndex}-${accountIndex}-2fa`, account.twoFactor)}
                    />
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-semibold text-zinc-400">
                Đơn hàng chưa có thông tin tài khoản được giao.
              </p>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-zinc-200"
    >
      <ArrowLeft className="h-4 w-4" />
      {text.back}
    </button>
  );
}

function InfoRow({ label, value, important }: { label: string; value: string; important?: boolean }) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
      <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words font-bold ${important ? "text-emerald-200" : "text-white"}`}>{value}</dd>
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="mt-2 flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/35 p-2 text-left transition hover:border-emerald-300/30"
    >
      <span className="w-20 shrink-0 text-xs font-semibold text-zinc-500">{label}</span>
      <code className="min-w-0 flex-1 break-all font-sans text-sm font-bold text-emerald-200">{value}</code>
      <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-white/5 px-2 text-[11px] font-bold text-zinc-300">
        {copied ? text.copied : <Clipboard className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function formatStatus(status: string, paymentStatus: string) {
  if (status === "DELIVERED") return "Hoàn thành";
  if (paymentStatus === "PAID") return "Đã thanh toán";
  if (paymentStatus === "FAILED" || status === "CANCELLED") return "Đã hủy";
  return "Chờ thanh toán";
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("vi-VN");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
