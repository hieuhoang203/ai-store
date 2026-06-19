CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "ActivityLogType" AS ENUM ('COUPON_APPLIED', 'REVIEW_CREATED', 'REVIEW_UPDATED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COUPON_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COUPON_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COUPON_DELETE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COUPON_DISABLE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REVIEW_HIDE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REVIEW_SHOW';

ALTER TABLE "product_variants"
  ADD COLUMN "average_rating" DECIMAL(3, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "coupons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "discount_type" "DiscountType" NOT NULL,
  "discount_value" DECIMAL(18, 2) NOT NULL,
  "max_discount" DECIMAL(18, 2),
  "min_order_amount" DECIMAL(18, 2),
  "usage_limit" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupons_code_key" UNIQUE ("code")
);

CREATE TABLE "coupon_products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "product_variant_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "coupon_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_coupon_products_coupon_variant" UNIQUE ("coupon_id", "product_variant_id")
);

CREATE TABLE "coupon_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "coupon_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_coupon_users_coupon_user" UNIQUE ("coupon_id", "user_id")
);

CREATE TABLE "coupon_usages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "discount_amount" DECIMAL(18, 2) NOT NULL,
  "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_coupon_usages_coupon_order" UNIQUE ("coupon_id", "order_id")
);

ALTER TABLE "orders" ADD COLUMN "coupon_id" UUID;

CREATE TABLE "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "product_variant_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "activity_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "type" "ActivityLogType" NOT NULL,
  "entity_name" VARCHAR(100) NOT NULL,
  "entity_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_coupons_code" ON "coupons" ("code");
CREATE INDEX "idx_coupons_active" ON "coupons" ("is_active");
CREATE INDEX "idx_coupons_starts" ON "coupons" ("starts_at");
CREATE INDEX "idx_coupons_ends" ON "coupons" ("ends_at");
CREATE INDEX "idx_coupon_products_coupon" ON "coupon_products" ("coupon_id");
CREATE INDEX "idx_coupon_products_variant" ON "coupon_products" ("product_variant_id");
CREATE INDEX "idx_coupon_users_coupon" ON "coupon_users" ("coupon_id");
CREATE INDEX "idx_coupon_users_user" ON "coupon_users" ("user_id");
CREATE INDEX "idx_coupon_usages_coupon" ON "coupon_usages" ("coupon_id");
CREATE INDEX "idx_coupon_usages_user" ON "coupon_usages" ("user_id");
CREATE INDEX "idx_coupon_usages_order" ON "coupon_usages" ("order_id");
CREATE INDEX "idx_orders_coupon" ON "orders" ("coupon_id");
CREATE INDEX "idx_reviews_user" ON "reviews" ("user_id");
CREATE INDEX "idx_reviews_variant" ON "reviews" ("product_variant_id");
CREATE INDEX "idx_reviews_rating" ON "reviews" ("rating");
CREATE INDEX "idx_reviews_hidden" ON "reviews" ("is_hidden");
CREATE INDEX "idx_activity_logs_user" ON "activity_logs" ("user_id");
CREATE INDEX "idx_activity_logs_type" ON "activity_logs" ("type");
CREATE INDEX "idx_activity_logs_entity" ON "activity_logs" ("entity_name", "entity_id");
CREATE INDEX "idx_activity_logs_created" ON "activity_logs" ("created_at" DESC);

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_users" ADD CONSTRAINT "coupon_users_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_users" ADD CONSTRAINT "coupon_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
