"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { type Product, type ProductVariant } from "@/features/products/product-service";
import type { CartItem } from "@/store/cart-store";
import { ProductDescription } from "./product-description";
import { SectionTitle } from "./section-title";
import { VariantCard } from "./variant-card";

const text = {
  featured: "S\u1ea3n ph\u1ea9m n\u1ed5i b\u1eadt",
  digitalFallback: "T\u00e0i kho\u1ea3n s\u1ed1 giao t\u1ef1 \u0111\u1ed9ng",
  priceRange: "Kho\u1ea3ng gi\u00e1",
  from: "T\u1eeb",
  packages: "g\u00f3i",
  choosePackage: "Ch\u1ecdn g\u00f3i",
  back: "Quay l\u1ea1i",
  noPackage: "Ch\u01b0a c\u00f3 g\u00f3i \u0111ang b\u00e1n",
  addPackage: "Th\u00eam g\u00f3i",
  outOfStock: "H\u1ebft h\u00e0ng",
  stock: "C\u00f2n",
  lowStock: "Sắp hết",
  instantDelivery: "Giao ngay",
  duration: "Th\u1eddi h\u1ea1n",
  warranty: "B\u1ea3o h\u00e0nh",
  days: "ng\u00e0y",
};

export function ProductGrid({
  products,
  loading,
  onAdd,
}: {
  products: Product[];
  loading: boolean;
  onAdd: (item: CartItem) => void;
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const featuredProducts = products.slice(0, 2);

  if (selectedProduct) {
    return (
      <ProductDetail
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
        onAdd={onAdd}
      />
    );
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <SectionTitle title={text.featured} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionTitle
        title={text.featured}
        action={<span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-emerald-300">{featuredProducts.length} items</span>}
      />
      <div className="grid grid-cols-2 gap-3">
        {featuredProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            onSelect={() => setSelectedProduct(product)}
          />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  index,
  onSelect,
}: {
  product: Product;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="mini-rise overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] text-left shadow-xl shadow-black/20 transition hover:border-emerald-300/30"
      style={{ animationDelay: `${index * 38}ms` }}
    >
      <div className="relative aspect-[1.55] overflow-hidden bg-gradient-to-br from-emerald-300/20 via-zinc-900 to-black">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill sizes="180px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <span className="text-2xl font-bold text-emerald-300/80">{product.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-emerald-200 backdrop-blur">
          {product.category || "Digital"}
        </div>
      </div>

      <div className="space-y-2 p-2.5">
        <div>
          <h3 className="line-clamp-1 text-sm font-bold leading-5 text-white">{product.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-zinc-500">{product.description || text.digitalFallback}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-zinc-500">{text.priceRange}</p>
          <p className="text-sm font-bold text-emerald-300">{formatPriceRange(product.variants)}</p>
        </div>
      </div>
    </button>
  );
}

function ProductDetail({
  product,
  onBack,
  onAdd,
}: {
  product: Product;
  onBack: () => void;
  onAdd: (item: CartItem) => void;
}) {
  return (
    <section className="mini-fade space-y-4">
      <div className="sticky top-0 z-10 -mx-4 border-b border-white/10 bg-[#050805]/95 px-4 pb-3 pt-1 backdrop-blur">
        <button
          onClick={onBack}
          className="mb-3 inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {text.back}
        </button>
        <div className="flex gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-300/20 via-zinc-900 to-black">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} fill sizes="80px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-xl font-bold text-emerald-300/80">{product.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">{product.category || "Digital"}</p>
            <h2 className="line-clamp-2 text-xl font-bold leading-6 text-white">{product.name}</h2>
            <p className="mt-1 text-sm font-bold text-emerald-300">{formatPriceRange(product.variants)}</p>
          </div>
        </div>
        <ProductDescription description={product.description} />
      </div>

      <div className="space-y-3">
        <SectionTitle
          title={text.choosePackage}
          action={<span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-emerald-300">{product.variants.length} {text.packages}</span>}
        />
        {product.variants.length ? (
          product.variants.map((variant, index) => (
            <VariantCard key={variant.id} product={product} variant={variant} index={index} onAdd={onAdd} />
          ))
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-4 text-sm font-semibold text-zinc-400">
            {text.noPackage}
          </div>
        )}
      </div>
    </section>
  );
}

function formatPriceRange(variants: ProductVariant[]) {
  const prices = variants.map((variant) => Number(variant.sellPrice)).filter((price) => Number.isFinite(price));
  if (!prices.length) return "-";

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `${formatMoney(min)} đ`;
  return `${formatMoney(min)} - ${formatMoney(max)} đ`;
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("vi-VN");
}
