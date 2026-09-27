-- Откат 20260927000029_phase2_location: снять политику, колонку, таблицу и тип. Данные Hospitality не меняются
-- (backfill только создавал строки locations и заполнял properties.location_id).
DROP POLICY IF EXISTS rls_tenant ON "locations";
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_location_id_fkey";
DROP INDEX IF EXISTS "properties_location_id_key";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "location_id";
DROP TABLE IF EXISTS "locations";
DROP TYPE IF EXISTS "LocationVertical";
