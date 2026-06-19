"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import type { CheckoutResult, CouponValidationResult, PaymentStatusResult } from "@/features/orders/order-service";
import type { CartItem } from "@/store/cart-store";
import { EmptyState } from "./empty-state";
import { SectionTitle } from "./section-title";

export function CartView({
  items,
  total,
  processing,
  paymentResult,
  paymentStatus,
  couponCode,
  couponResult,
  couponProcessing,
  onRemove,
  onQuantityChange,
  onCheckout,
  onRenewPayment,
  onCouponCodeChange,
  onApplyCoupon,
  onClearCoupon,
}: {
  items: CartItem[];
  total: number;
  processing: boolean;
  paymentResult: CheckoutResult | null;
  paymentStatus: PaymentStatusResult | null;
  couponCode: string;
  couponResult: CouponValidationResult | null;
  couponProcessing: boolean;
  onRemove: (variantId: string) => void;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onCheckout: () => void;
  onRenewPayment: () => void;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onClearCoupon: () => void;
}) {
  const locked = processing || Boolean(paymentResult);

  if (!items.length && !paymentResult) {
    return <EmptyState title="Giỏ hàng trống" text="Thêm gói sản phẩm để bắt đầu tạo đơn thanh toán." />;
  }

  return (
    <section className="mini-fade space-y-3">
      <SectionTitle title="Giỏ hàng" />

      {paymentStatus?.payment.status === "PAID" ? (
        <PaymentSuccessPanel status={paymentStatus} />
      ) : paymentStatus?.payment.status === "FAILED" ? (
        <PaymentExpiredPanel orderNo={paymentResult?.order.orderNo} processing={processing} onRenewPayment={onRenewPayment} />
      ) : paymentResult ? (
        <PaymentPanel result={paymentResult} processing={processing} onRenewPayment={onRenewPayment} />
      ) : null}

      {!paymentResult ? (
        <>
          {items.map((item, index) => (
            <article
              key={item.variantId}
              className="mini-rise rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/20"
              style={{ animationDelay: `${index * 44}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-bold text-white">{item.name}</h3>
                  <p className="mt-1 text-sm font-bold text-emerald-300">{Number(item.price).toLocaleString("vi-VN")} đ</p>
                  {item.availableStock !== undefined ? (
                    <p className={`mt-1 text-xs font-semibold ${getStockTextClass(item.availableStock)}`}>
                      {getStockLabel(item.availableStock)}
                    </p>
                  ) : null}
                </div>
                <button
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-300"
                  onClick={() => onRemove(item.variantId)}
                  aria-label={`Xóa ${item.name}`}
                  disabled={locked}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-lg border border-white/10 bg-black/25 p-1">
                  <button
                    onClick={() => onQuantityChange(item.variantId, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
                    aria-label="Giảm số lượng"
                    disabled={locked}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-9 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button
                    onClick={() => onQuantityChange(item.variantId, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Tăng số lượng"
                    disabled={locked || (item.availableStock !== undefined && item.quantity >= item.availableStock)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm font-bold text-white">{(Number(item.price) * item.quantity).toLocaleString("vi-VN")} đ</span>
              </div>
            </article>
          ))}

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-xl shadow-black/20">
            <p className="text-sm font-bold text-white">Mã giảm giá</p>
            <div className="mt-3 flex gap-2">
              <input
                value={couponCode}
                onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
                disabled={locked || couponProcessing}
                placeholder="WELCOME50"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold uppercase text-white outline-none placeholder:text-zinc-600 focus:border-emerald-300/50 disabled:opacity-60"
              />
              {couponResult ? (
                <button
                  type="button"
                  onClick={onClearCoupon}
                  disabled={locked}
                  className="h-10 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-zinc-200 disabled:opacity-50"
                >
                  Xóa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onApplyCoupon}
                  disabled={locked || couponProcessing || !couponCode.trim()}
                  className="h-10 rounded-lg bg-emerald-300 px-3 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {couponProcessing ? "Đang áp dụng" : "Áp dụng"}
                </button>
              )}
            </div>
            {couponResult ? (
              <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm">
                <p className="font-bold text-emerald-100">
                  {couponResult.coupon.code} - {couponResult.coupon.name}
                </p>
                <p className="mt-1 text-zinc-300">Giảm {formatMoney(couponResult.discountAmount)} đ</p>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-3 rounded-2xl border border-emerald-300/25 bg-[#071008]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="mb-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-400">Tạm tính</span>
                <span className="text-sm font-bold text-white">{formatMoney(total)} đ</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-400">Giảm giá</span>
                <span className="text-sm font-bold text-emerald-200">-{formatMoney(couponResult?.discountAmount || 0)} đ</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-sm font-semibold text-zinc-400">Tổng thanh toán</span>
                <span className="text-lg font-bold text-emerald-300">{formatMoney(couponResult?.finalAmount || total)} đ</span>
              </div>
            </div>
            <button
              disabled={locked || !items.length}
              onClick={onCheckout}
              className="h-12 w-full rounded-lg bg-emerald-300 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? "Đang tạo mã QR..." : paymentResult ? "Đã tạo mã QR" : "Thanh toán"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function PaymentPanel({
  result,
  processing,
  onRenewPayment,
}: {
  result: CheckoutResult;
  processing: boolean;
  onRenewPayment: () => void;
}) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(result.payment.qrContent?.expiresAt),
  );
  const qr = result.payment.qrContent;
  const expired = remainingSeconds <= 0;

  useEffect(() => {
    let mounted = true;
    if (!qr?.qrCode) {
      setQrImage(null);
      return;
    }

    QRCode.toDataURL(qr.qrCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280,
      color: {
        dark: "#020302",
        light: "#ffffff",
      },
    }).then((url) => {
      if (mounted) setQrImage(url);
    });

    return () => {
      mounted = false;
    };
  }, [qr?.qrCode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(qr?.expiresAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [qr?.expiresAt]);

  if (!qr) return null;

  return (
    <section className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Mã thanh toán</p>
          <h2 className="mt-1 text-xl font-bold text-white">{Number(qr.amount).toLocaleString("vi-VN")} đ</h2>
        </div>
        <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-emerald-200">{result.order.orderNo}</span>
      </div>

      <div className="relative mt-4 rounded-xl bg-white p-3">
        {qrImage ? (
          <img
            src={qrImage}
            alt="Mã QR thanh toán"
            className={`mx-auto h-64 w-64 ${expired ? "opacity-20 grayscale" : ""}`}
          />
        ) : null}
        {expired ? (
          <div className="absolute inset-3 flex items-center justify-center rounded-lg bg-black/65 text-sm font-bold text-white">
            QR đã hết hạn
          </div>
        ) : null}
      </div>

      <div className={`mt-3 flex items-center justify-between gap-3 rounded-lg border p-3 ${
        expired
          ? "border-red-400/25 bg-red-400/10 text-red-100"
          : "border-emerald-300/20 bg-black/25 text-emerald-100"
      }`}>
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          {expired ? <AlertCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
          {expired ? "QR đã hết hạn" : "QR hết hạn sau"}
        </span>
        <span className="text-lg font-bold tabular-nums">
          {formatRemainingTime(remainingSeconds)}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <PaymentInfo label="Ngân hàng" value={qr.bin} />
        <PaymentInfo label="Tài khoản nhận" value={qr.accountNumber} />
        <PaymentInfo label="Tên tài khoản" value={qr.accountName} />
        <PaymentInfo label="Nội dung CK" value={qr.content} important />
      </dl>

      {expired ? (
        <button
          type="button"
          onClick={onRenewPayment}
          disabled={processing}
          className="mt-4 h-11 w-full rounded-lg bg-emerald-300 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? "Đang tạo QR mới..." : "Tạo QR mới"}
        </button>
      ) : (
        <a
          href={qr.checkoutUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 text-sm font-bold text-black"
        >
          Mở trang thanh toán
          <ExternalLink className="h-4 w-4" />
        </a>
      )}

      <p className="mt-3 text-xs leading-5 text-zinc-400">
        Hệ thống chỉ xác nhận đơn sau khi nhận webhook hợp lệ từ payOS. Vui lòng không tự sửa số tiền hoặc nội dung chuyển khoản.
      </p>
    </section>
  );
}

function PaymentSuccessPanel({ status }: { status: PaymentStatusResult }) {
  return (
    <section className="rounded-2xl border border-emerald-300/30 bg-emerald-300/12 p-4 shadow-xl shadow-black/20">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-300 text-black">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Thanh toán thành công</p>
          <h2 className="mt-1 text-xl font-bold text-white">{status.order.orderNo}</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-400">
            Tài khoản đã được gửi qua Telegram. Bạn cũng có thể xem lại thông tin giao hàng bên dưới.
          </p>
        </div>
      </div>

      {status.deliveryMessage ? (
        <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-black/35 p-3 text-sm leading-6 text-emerald-100">
          {status.deliveryMessage}
        </pre>
      ) : status.deliveries.length ? (
        <div className="mt-4 space-y-3">
          {status.deliveries.map((delivery) => (
            <article key={delivery.id} className="rounded-xl border border-white/10 bg-black/28 p-3">
              <p className="text-sm font-bold text-white">
                {delivery.productName} - {delivery.variantName}
              </p>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-black/35 p-3 text-sm leading-6 text-emerald-100">
                {delivery.content || "Đang chuẩn bị thông tin giao hàng..."}
              </pre>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/28 p-3 text-sm font-semibold text-zinc-300">
          Thanh toán đã được ghi nhận. Hệ thống đang chuẩn bị tài khoản và mật khẩu.
        </div>
      )}
    </section>
  );
}

function PaymentExpiredPanel({
  orderNo,
  processing,
  onRenewPayment,
}: {
  orderNo?: string;
  processing: boolean;
  onRenewPayment: () => void;
}) {
  return (
    <section className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 shadow-xl shadow-black/20">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-400/20 text-red-100">
          <AlertCircle className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-200">QR đã hết hạn</p>
          <h2 className="mt-1 text-xl font-bold text-white">{orderNo || "Đơn thanh toán"}</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-300">
            Mã QR chỉ có hiệu lực trong 3 phút. Bạn có thể tạo QR mới từ giỏ hàng hiện tại.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRenewPayment}
        disabled={processing}
        className="mt-4 h-11 w-full rounded-lg bg-emerald-300 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? "Đang tạo QR mới..." : "Tạo QR mới"}
      </button>
    </section>
  );
}

function getRemainingSeconds(expiresAt?: string | null) {
  if (!expiresAt) return 0;
  return Math.max(Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000), 0);
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStockLabel(availableStock: number) {
  if (availableStock <= 0) return "Hết hàng";
  if (availableStock <= 3) return `Sắp hết, còn ${availableStock} tài khoản`;
  return `Còn ${availableStock} tài khoản, giao ngay`;
}

function getStockTextClass(availableStock: number) {
  if (availableStock <= 0) return "text-red-300";
  if (availableStock <= 3) return "text-amber-300";
  return "text-emerald-300";
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("vi-VN");
}

function PaymentInfo({ label, value, important }: { label: string; value?: string | number | null; important?: boolean }) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
      <dt className="w-28 shrink-0 text-zinc-500">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words font-bold ${important ? "text-emerald-200" : "text-white"}`}>{value || "-"}</dd>
    </div>
  );
}
