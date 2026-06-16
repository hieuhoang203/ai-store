import Image from "next/image";
import { Plus } from "lucide-react";
import type { Product } from "@/features/products/product-service";
import type { CartItem } from "@/store/cart-store";
import { SectionTitle } from "./section-title";

export function ProductGrid({
  products,
  loading,
  onAdd,
}: {
  products: Product[];
  loading: boolean;
  onAdd: (item: CartItem) => void;
}) {
  if (loading) {
    return (
      <section className="space-y-3">
        <SectionTitle title="Sản phẩm nổi bật" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/[0.045]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Sản phẩm nổi bật"
        action={<span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-emerald-300">{products.length} items</span>}
      />
      <div className="grid grid-cols-2 gap-3">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} index={index} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  index,
  onAdd,
}: {
  product: Product;
  index: number;
  onAdd: (item: CartItem) => void;
}) {
  const variant = product.variants[0];
  const price = variant ? Number(variant.sellPrice).toLocaleString("vi-VN") : "-";

  return (
    <article
      className="mini-rise overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 transition hover:border-emerald-300/30"
      style={{ animationDelay: `${index * 38}ms` }}
    >
      <div className="relative aspect-[1.12] overflow-hidden bg-gradient-to-br from-emerald-300/20 via-zinc-900 to-black">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill sizes="180px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <span className="text-3xl font-black text-emerald-300/80">{product.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[11px] font-bold text-emerald-200 backdrop-blur">
          {product.category || "Digital"}
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-white">{product.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-zinc-500">{product.description || "Tài khoản số giao tự động"}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500">Giá bán</p>
            <p className="text-sm font-black text-emerald-300">{price} đ</p>
          </div>
          {variant ? (
            <button
              onClick={() => onAdd({ variantId: variant.id, name: product.name, price: variant.sellPrice, quantity: 1 })}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-300 text-black transition hover:bg-emerald-200"
              aria-label={`Thêm ${product.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
