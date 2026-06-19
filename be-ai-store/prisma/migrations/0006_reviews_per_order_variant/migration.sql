ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_order_id_key";

ALTER TABLE "reviews"
  ADD CONSTRAINT "uq_reviews_order_variant" UNIQUE ("order_id", "product_variant_id");
