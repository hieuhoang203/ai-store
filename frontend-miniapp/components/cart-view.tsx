"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import type { CheckoutResult } from "@/features/orders/order-service";
import type { CartItem } from "@/store/cart-store";
import { EmptyState } from "./empty-state";
import { SectionTitle } from "./section-title";

export function CartView({
  items,
  total,
  processing,
  paymentResult,
  onRemove,
  onQuantityChange,
  onCheckout,
}: {
  items: CartItem[];
  total: number;
  processing: boolean;
  paymentResult: CheckoutResult | null;
  onRemove: (variantId: string) => void;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  const locked = processing || Boolean(paymentResult);

  if (!items.length && !paymentResult) {
    return <EmptyState title="Giỏ hàng trống" text="Thêm gói sản phẩm để bắt đầu tạo đơn thanh toán." />;
  }

  return (
    <section className="mini-fade space-y-3">
      <SectionTitle title="Giỏ hàng" />

      {paymentResult ? <PaymentPanel result={paymentResult} /> : null}

      {items.map((item, index) => (
        <article
          key={item.variantId}
          className="mini-rise rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/20"
          style={{ animationDelay: `${index * 44}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-black text-white">{item.name}</h3>
              <p className="mt-1 text-sm font-bold text-emerald-300">{Number(item.price).toLocaleString("vi-VN")} đ</p>
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
              <span className="w-9 text-center text-sm font-black text-white">{item.quantity}</span>
              <button
                onClick={() => onQuantityChange(item.variantId, item.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
                aria-label="Tăng số lượng"
                disabled={locked}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm font-black text-white">{(Number(item.price) * item.quantity).toLocaleString("vi-VN")} đ</span>
          </div>
        </article>
      ))}

      <div className="sticky bottom-3 rounded-2xl border border-emerald-300/25 bg-[#071008]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-400">Tổng thanh toán</span>
          <span className="text-lg font-black text-emerald-300">{total.toLocaleString("vi-VN")} đ</span>
        </div>
        <button
          disabled={locked || !items.length}
          onClick={onCheckout}
          className="h-12 w-full rounded-lg bg-emerald-300 text-sm font-black text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? "Đang tạo mã QR..." : paymentResult ? "Đã tạo mã QR" : "Thanh toán"}
        </button>
      </div>
    </section>
  );
}

function PaymentPanel({ result }: { result: CheckoutResult }) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const qr = result.payment.qrContent;

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

  if (!qr) return null;

  return (
    <section className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Mã thanh toán</p>
          <h2 className="mt-1 text-xl font-black text-white">{Number(qr.amount).toLocaleString("vi-VN")} đ</h2>
        </div>
        <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-black text-emerald-200">{result.order.orderNo}</span>
      </div>

      <div className="mt-4 rounded-xl bg-white p-3">
        {qrImage ? <img src={qrImage} alt="Mã QR thanh toán" className="mx-auto h-64 w-64" /> : null}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <PaymentInfo label="Ngân hàng" value={qr.bin} />
        <PaymentInfo label="Tài khoản nhận" value={qr.accountNumber} />
        <PaymentInfo label="Tên tài khoản" value={qr.accountName} />
        <PaymentInfo label="Nội dung CK" value={qr.content} important />
      </dl>

      <a
        href={qr.checkoutUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 text-sm font-black text-black"
      >
        Mở trang thanh toán
        <ExternalLink className="h-4 w-4" />
      </a>

      <p className="mt-3 text-xs leading-5 text-zinc-400">
        Hệ thống chỉ xác nhận đơn sau khi nhận webhook hợp lệ từ payOS. Vui lòng không tự sửa số tiền hoặc nội dung chuyển khoản.
      </p>
    </section>
  );
}

function PaymentInfo({ label, value, important }: { label: string; value?: string | number | null; important?: boolean }) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
      <dt className="w-28 shrink-0 text-zinc-500">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words font-bold ${important ? "text-emerald-200" : "text-white"}`}>{value || "-"}</dd>
    </div>
  );
}
