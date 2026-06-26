"use client";

import { useState } from "react";
import { Clock, ShieldCheck, PackageCheck, Star, Plus } from "lucide-react";
import type { Product, ProductVariant } from "@/features/products/product-service";
import type { CartItem } from "@/store/cart-store";

const text = {
  days: "ngày",
  warranty: "bảo hành",
  outOfStock: "Hết hàng",
  addPackage: "Thêm gói",
  instantDelivery: "Giao ngay",
  lowStock: "Sắp hết",
  stock: "Còn",
};

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("vi-VN");
}

function getStockLabel(availableStock?: number) {
  if (availableStock === undefined) return text.instantDelivery;
  if (availableStock <= 0) return text.outOfStock;
  if (availableStock <= 3) return `${text.lowStock}, còn ${availableStock}`;
  return `${text.stock} ${availableStock} - ${text.instantDelivery}`;
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[11px] font-bold text-zinc-300">
      <span className="text-emerald-300">{icon}</span>
      {label}
    </span>
  );
}

export function VariantCard({
  product,
  variant,
  index,
  onAdd,
}: {
  product: Product;
  variant: ProductVariant;
  index: number;
  onAdd: (item: CartItem) => void;
}) {
  const availableStock = variant.availableStock;
  const outOfStock = availableStock !== undefined && availableStock <= 0;

  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState("");

  const requiresInput = variant.requiresCustomerInput === true || variant.deliveryType === "GUI_EMAIL_CHO_DOI_TAC";

  const handleAdd = () => {
    if (outOfStock) return;

    if (requiresInput) {
      const emailTrimmed = email.trim();
      if (!emailTrimmed) {
        setError("Vui lòng nhập email nhận tài khoản");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        setError("Email không đúng định dạng");
        return;
      }
    }

    onAdd({
      variantId: variant.id,
      name: `${product.name} - ${variant.name}`,
      price: variant.sellPrice,
      quantity: 1,
      availableStock,
      customerInput: requiresInput
        ? {
            email: email.trim(),
            workspace: workspace.trim() || undefined,
          }
        : undefined,
    });

    // Clear form inputs after adding
    setEmail("");
    setWorkspace("");
    setError("");
  };

  return (
    <article
      className="mini-rise rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-lg shadow-black/20"
      style={{ animationDelay: `${index * 34}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-bold leading-5 text-white">{variant.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {variant.durationDays ? (
              <InfoPill icon={<Clock className="h-3 w-3" />} label={`${variant.durationDays} ${text.days}`} />
            ) : null}
            {variant.warrantyDays ? (
              <InfoPill icon={<ShieldCheck className="h-3 w-3" />} label={`${variant.warrantyDays} ${text.days} ${text.warranty}`} />
            ) : null}
            <InfoPill icon={<PackageCheck className="h-3 w-3" />} label={getStockLabel(availableStock)} />
            {variant.reviewCount ? (
              <InfoPill icon={<Star className="h-3 w-3 fill-current" />} label={`${Number(variant.averageRating || 0).toFixed(1)} (${variant.reviewCount})`} />
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-emerald-300">{formatMoney(variant.sellPrice)} đ</p>
          {!requiresInput && (
            <button
              disabled={outOfStock}
              onClick={handleAdd}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-300 px-3 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              <Plus className="h-4 w-4" />
              {outOfStock ? text.outOfStock : text.addPackage}
            </button>
          )}
        </div>
      </div>

      {requiresInput && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Email nhận tài khoản <span className="text-rose-400 font-bold">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="example@gmail.com"
                className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none transition focus:border-emerald-300/50 focus:ring-1 focus:ring-emerald-300/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Workspace / Tên miền (nếu có)
              </label>
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="my-workspace"
                className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none transition focus:border-emerald-300/50 focus:ring-1 focus:ring-emerald-300/30"
              />
            </div>
          </div>
          {error && (
            <p className="mt-1.5 text-[11px] font-medium text-rose-400">{error}</p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              disabled={outOfStock}
              onClick={handleAdd}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              {outOfStock ? text.outOfStock : text.addPackage}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
