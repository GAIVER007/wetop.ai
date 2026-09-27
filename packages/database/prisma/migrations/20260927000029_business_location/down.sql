-- Откат 20260927000029_business_location — к состоянию после 20260927000028_rls_policies.
-- Порядок из плана §5: политики новых таблиц → properties.location_id → organizations.reporting_currency →
-- locations → businesses → типы. Hospitality не затронут: ни одна существующая таблица не меняется,
-- удаляются только добавленные этой миграцией объекты (данные backfill — вместе с таблицами).

DROP POLICY IF EXISTS rls_tenant ON "locations";
DROP POLICY IF EXISTS rls_tenant ON "businesses";

ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_location_id_fkey";
DROP INDEX IF EXISTS "properties_location_id_idx";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "location_id";

ALTER TABLE "organizations" DROP COLUMN IF EXISTS "reporting_currency";

DROP TABLE IF EXISTS "locations";
DROP TABLE IF EXISTS "businesses";

DROP TYPE IF EXISTS "LocationStatus";
DROP TYPE IF EXISTS "BusinessStatus";
DROP TYPE IF EXISTS "BusinessVertical";
