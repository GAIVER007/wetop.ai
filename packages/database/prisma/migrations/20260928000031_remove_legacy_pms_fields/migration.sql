-- ADR-118 / DATA_MODEL v2.5: WETOP no longer stores vendor-specific identifiers
-- from the retired PMS. Operational data is backed up and reset before this migration.
DROP INDEX IF EXISTS "accommodation_types_property_id_exely_id_key";
DROP INDEX IF EXISTS "inventory_units_exely_room_number_key";
DROP INDEX IF EXISTS "reservation_items_exely_room_stay_id_key";
DROP INDEX IF EXISTS "guests_exely_person_id_key";
DROP INDEX IF EXISTS "rate_plans_property_id_exely_id_key";

ALTER TABLE "accommodation_types" DROP COLUMN IF EXISTS "exely_id";
ALTER TABLE "inventory_units" DROP COLUMN IF EXISTS "exely_room_number";
ALTER TABLE "reservation_items" DROP COLUMN IF EXISTS "exely_room_stay_id";
ALTER TABLE "guests" DROP COLUMN IF EXISTS "exely_person_id";
ALTER TABLE "rate_plans" DROP COLUMN IF EXISTS "exely_id";
