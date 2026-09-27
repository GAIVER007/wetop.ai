-- Откат 20260927000030_platform_p1_business_location: снять политики, связку, таблицы, типы и колонку валюты.
-- Hospitality-данные не меняются (backfill только создавал строки businesses/locations и заполнял
-- properties.location_id / organizations.reporting_currency).
DROP POLICY IF EXISTS rls_tenant ON "locations";
DROP POLICY IF EXISTS rls_tenant ON "businesses";
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_location_id_fkey";
DROP INDEX IF EXISTS "properties_location_id_key";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "location_id";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "reporting_currency";
DROP TABLE IF EXISTS "locations";
DROP TABLE IF EXISTS "businesses";
DROP TYPE IF EXISTS "LocationStatus";
DROP TYPE IF EXISTS "BusinessStatus";
DROP TYPE IF EXISTS "BusinessVertical";
