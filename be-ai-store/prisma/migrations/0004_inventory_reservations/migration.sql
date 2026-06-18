ALTER TABLE "inventories"
ADD COLUMN "reserved_until" TIMESTAMPTZ,
ADD COLUMN "reserved_order_id" UUID;

CREATE INDEX "idx_inventory_reserved_order" ON "inventories"("reserved_order_id");
CREATE INDEX "idx_inventory_status_reserved_until" ON "inventories"("status", "reserved_until");
