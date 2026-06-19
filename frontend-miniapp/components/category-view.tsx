"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Clock, ImageIcon, PackageCheck, Plus, Search, ShieldCheck, Star } from "lucide-react";
import {
  getCategories,
  getProductsByCategory,
  type Category,
} from "@/features/categories/category-service";
import { getProductReviews, type Product, type ProductReview, type ProductVariant } from "@/features/products/product-service";
import type { CartItem } from "@/store/cart-store";
import { EmptyState } from "./empty-state";
import { ProductDescription } from "./product-description";
import { SectionTitle } from "./section-title";

const text = {
  categoryTitle: "Lo\u1ea1i s\u1ea3n ph\u1ea9m",
  emptyCategoryTitle: "Ch\u01b0a c\u00f3 lo\u1ea1i s\u1ea3n ph\u1ea9m",
  emptyCategoryText: "C\u00e1c lo\u1ea1i s\u1ea3n ph\u1ea9m \u0111ang ho\u1ea1t \u0111\u1ed9ng s\u1ebd hi\u1ec3n th\u1ecb t\u1ea1i \u0111\u00e2y.",
  categoryLabel: "Danh m\u1ee5c",
  productLabel: "s\u1ea3n ph\u1ea9m",
  activeSelling: "\u0111ang b\u00e1n",
  back: "Quay l\u1ea1i",
  productsByCategory: "S\u1ea3n ph\u1ea9m theo lo\u1ea1i",
  noProductTitle: "Ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m",
  noProductText: "Lo\u1ea1i n\u00e0y hi\u1ec7n ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m \u0111ang ho\u1ea1t \u0111\u1ed9ng.",
  digitalFallback: "T\u00e0i kho\u1ea3n s\u1ed1 giao t\u1ef1 \u0111\u1ed9ng",
  packages: "g\u00f3i",
  priceRange: "Kho\u1ea3ng gi\u00e1",
  choosePackage: "Ch\u1ecdn g\u00f3i",
  noPackage: "Ch\u01b0a c\u00f3 g\u00f3i \u0111ang b\u00e1n",
  addPackage: "Th\u00eam g\u00f3i",
  outOfStock: "H\u1ebft h\u00e0ng",
  stock: "C\u00f2n",
  lowStock: "Sắp hết",
  instantDelivery: "Giao ngay",
  days: "ng\u00e0y",
  warranty: "B\u1ea3o h\u00e0nh",
};

export function CategoryView({ onAdd }: { onAdd: (item: CartItem) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const {
    data: categories = [],
    isLoading: loadingCategories,
  } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const {
    data: products = [],
    isLoading: loadingProducts,
  } = useQuery({
    queryKey: ["category-products", selectedCategory?.id],
    queryFn: () => getProductsByCategory(selectedCategory!.id),
    enabled: Boolean(selectedCategory),
  });

  const totalProducts = useMemo(
    () => categories.reduce((sum, category) => sum + category.productCount, 0),
    [categories],
  );

  if (selectedCategory && selectedProduct) {
    return (
      <ProductDetail
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
        onAdd={onAdd}
      />
    );
  }

  if (selectedCategory) {
    return (
      <CategoryProductsView
        category={selectedCategory}
        products={products}
        loading={loadingProducts}
        onBack={() => {
          setSelectedProduct(null);
          setSelectedCategory(null);
        }}
        onSelectProduct={setSelectedProduct}
      />
    );
  }

  if (loadingCategories) {
    return (
      <section className="mini-fade space-y-3">
        <SectionTitle title={text.categoryTitle} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
          ))}
        </div>
      </section>
    );
  }

  if (!categories.length) {
    return <EmptyState title={text.emptyCategoryTitle} text={text.emptyCategoryText} />;
  }

  return (
    <section className="mini-fade space-y-4">
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">{text.categoryLabel}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">{text.categoryTitle}</h2>
            <p className="mt-1 text-sm text-zinc-400">{categories.length} loại, {totalProducts} {text.productLabel} {text.activeSelling}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/35 text-emerald-300">
            <Boxes className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.map((category, index) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category)}
            className="mini-rise min-h-32 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-left shadow-lg shadow-black/20 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
            style={{ animationDelay: `${index * 36}ms` }}
          >
            <CategoryIcon icon={category.icon} name={category.name} />
            <span className="mt-3 line-clamp-2 block text-base font-bold leading-5 text-white">{category.name}</span>
            <span className="mt-2 inline-flex rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-emerald-200">
              {category.productCount} {text.productLabel}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CategoryProductsView({
  category,
  products,
  loading,
  onBack,
  onSelectProduct,
}: {
  category: Category;
  products: Product[];
  loading: boolean;
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
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
        <div className="flex items-center gap-3">
          <CategoryIcon icon={category.icon} name={category.name} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">{text.productsByCategory}</p>
            <h2 className="truncate text-xl font-bold text-white">{category.name}</h2>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.045]" />
          ))}
        </div>
      ) : null}

      {!loading && !products.length ? (
        <EmptyState title={text.noProductTitle} text={text.noProductText} />
      ) : null}

      {!loading && products.length ? (
        <div className="space-y-3">
          {products.map((product, index) => (
            <CategoryProductCard key={product.id} product={product} index={index} onSelect={() => onSelectProduct(product)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CategoryProductCard({
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
      className="mini-rise flex w-full gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-left shadow-lg shadow-black/20 transition hover:border-emerald-300/30"
      style={{ animationDelay: `${index * 34}ms` }}
    >
      <div className="relative flex h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-emerald-300/20 via-zinc-900 to-black">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="m-auto text-xl font-bold text-emerald-300/80">{product.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white">{product.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{product.description || text.digitalFallback}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[11px] font-bold text-zinc-300">
            <Search className="h-3 w-3 text-emerald-300" />
            {product.variants.length} {text.packages}
          </span>
          <span className="text-sm font-bold text-emerald-300">{formatPriceRange(product.variants)}</span>
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
  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", product.id],
    queryFn: () => getProductReviews(product.id),
  });

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
          <div className="relative flex h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-300/20 via-zinc-900 to-black">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span className="m-auto text-xl font-bold text-emerald-300/80">{product.name.slice(0, 2).toUpperCase()}</span>
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
      <ProductReviewsPanel
        averageRating={reviewsQuery.data?.averageRating || "0.0"}
        reviewCount={reviewsQuery.data?.reviewCount || 0}
        reviews={reviewsQuery.data?.data || []}
        loading={reviewsQuery.isLoading}
      />
    </section>
  );
}

function VariantCard({
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

  return (
    <article
      className="mini-rise rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-lg shadow-black/20"
      style={{ animationDelay: `${index * 34}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-bold leading-5 text-white">{variant.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {variant.durationDays ? (
              <InfoPill icon={<Clock className="h-3 w-3" />} label={`${variant.durationDays} ${text.days}`} />
            ) : null}
            {variant.warrantyDays ? (
              <InfoPill icon={<ShieldCheck className="h-3 w-3" />} label={`${variant.warrantyDays} ${text.days} ${text.warranty.toLowerCase()}`} />
            ) : null}
            <InfoPill icon={<PackageCheck className="h-3 w-3" />} label={getStockLabel(availableStock)} />
            {variant.reviewCount ? (
              <InfoPill icon={<Star className="h-3 w-3 fill-current" />} label={`${Number(variant.averageRating || 0).toFixed(1)} (${variant.reviewCount})`} />
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-emerald-300">{formatMoney(variant.sellPrice)} đ</p>
          <button
            disabled={outOfStock}
            onClick={() => onAdd({
              variantId: variant.id,
              name: `${product.name} - ${variant.name}`,
              price: variant.sellPrice,
              quantity: 1,
              availableStock,
            })}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-300 px-3 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            <Plus className="h-4 w-4" />
            {outOfStock ? text.outOfStock : text.addPackage}
          </button>
        </div>
      </div>
    </article>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[11px] font-bold text-zinc-300">
      <span className="text-emerald-300">{icon}</span>
      {label}
    </span>
  );
}

function CategoryIcon({ icon, name }: { icon?: string | null; name: string }) {
  const isImage = Boolean(icon && /^https?:\/\//i.test(icon));

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-lg font-bold text-emerald-200">
      {isImage ? <img src={icon!} alt={name} className="h-full w-full object-cover" /> : icon || <ImageIcon className="h-5 w-5" />}
    </span>
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

function ProductReviewsPanel({
  averageRating,
  reviewCount,
  reviews,
  loading,
}: {
  averageRating: string;
  reviewCount: number;
  reviews: ProductReview[];
  loading: boolean;
}) {
  const groups = groupReviewsByVariant(reviews);

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Đánh giá khách hàng</p>
          <p className="mt-1 text-xs font-semibold text-zinc-500">{reviewCount} lượt đánh giá</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/12 px-2.5 py-1 text-sm font-bold text-amber-200">
          <Star className="h-4 w-4 fill-current" />
          {averageRating}
        </span>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-black/25" />
      ) : reviews.length ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.variantId} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{group.variantName}</p>
                  <p className="text-xs font-semibold text-zinc-500">{group.reviews.length} lượt đánh giá</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-300/12 px-2 py-1 text-xs font-bold text-amber-200">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {group.averageRating}
                </span>
              </div>
              <div className="space-y-2">
                {group.reviews.map((review) => (
                  <article key={review.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-white">{review.userName}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-200">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {review.rating}/5
                      </span>
                    </div>
                    {review.comment ? <p className="mt-2 text-sm leading-5 text-zinc-300">{review.comment}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-semibold text-zinc-400">
          Chưa có đánh giá cho sản phẩm này.
        </p>
      )}
    </section>
  );
}

function groupReviewsByVariant(reviews: ProductReview[]) {
  const groups = new Map<string, { variantId: string; variantName: string; reviews: ProductReview[] }>();

  for (const review of reviews) {
    const variantId = review.productVariantId || "unknown";
    const group = groups.get(variantId) || {
      variantId,
      variantName: review.variantName || "Gói sản phẩm",
      reviews: [],
    };

    group.reviews.push(review);
    groups.set(variantId, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    averageRating: (
      group.reviews.reduce((sum, review) => sum + review.rating, 0) / group.reviews.length
    ).toFixed(1),
  }));
}

function getStockLabel(availableStock?: number) {
  if (availableStock === undefined) return text.instantDelivery;
  if (availableStock <= 0) return text.outOfStock;
  if (availableStock <= 3) return `${text.lowStock}, còn ${availableStock}`;
  return `${text.stock} ${availableStock} - ${text.instantDelivery}`;
}
