-- Structural rollback only. Restore the pre-reset database backup to recover removed values.
ALTER TABLE "accommodation_types" ADD COLUMN IF NOT EXISTS "exely_id" TEXT;
ALTER TABLE "inventory_units" ADD COLUMN IF NOT EXISTS "exely_room_number" TEXT;
ALTER TABLE "reservation_items" ADD COLUMN IF NOT EXISTS "exely_room_stay_id" TEXT;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "exely_person_id" TEXT;
ALTER TABLE "rate_plans" ADD COLUMN IF NOT EXISTS "exely_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "accommodation_types_property_id_exely_id_key"
  ON "accommodation_types"("property_id", "exely_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_units_exely_room_number_key"
  ON "inventory_units"("exely_room_number");
CREATE UNIQUE INDEX IF NOT EXISTS "reservation_items_exely_room_stay_id_key"
  ON "reservation_items"("exely_room_stay_id");
CREATE UNIQUE INDEX IF NOT EXISTS "guests_exely_person_id_key"
  ON "guests"("exely_person_id");
CREATE UNIQUE INDEX IF NOT EXISTS "rate_plans_property_id_exely_id_key"
  ON "rate_plans"("property_id", "exely_id");
