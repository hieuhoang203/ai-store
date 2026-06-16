import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "@/store/cart-store";
import { EmptyState } from "./empty-state";
import { SectionTitle } from "./section-title";

export function CartView({
  items,
  total,
  processing,
  onRemove,
  onQuantityChange,
  onCheckout,
}: {
  items: CartItem[];
  total: number;
  processing: boolean;
  onRemove: (variantId: string) => void;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  if (!items.length) {
    return <EmptyState title="Giỏ hàng trống" text="Thêm sản phẩm từ trang Home để bắt đầu tạo đơn." />;
  }

  return (
    <section className="mini-fade space-y-3">
      <SectionTitle title="Giỏ hàng" />
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
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-9 text-center text-sm font-black text-white">{item.quantity}</span>
              <button
                onClick={() => onQuantityChange(item.variantId, item.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
                aria-label="Tăng số lượng"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm font-black text-white">{(Number(item.price) * item.quantity).toLocaleString("vi-VN")} đ</span>
          </div>
        </article>
      ))}

      <div className="sticky bottom-20 rounded-2xl border border-emerald-300/25 bg-[#071008]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-400">Tổng thanh toán</span>
          <span className="text-lg font-black text-emerald-300">{total.toLocaleString("vi-VN")} đ</span>
        </div>
        <button
          disabled={processing}
          onClick={onCheckout}
          className="h-12 w-full rounded-lg bg-emerald-300 text-sm font-black text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? "Đang tạo đơn..." : "Checkout"}
        </button>
      </div>
    </section>
  );
}
