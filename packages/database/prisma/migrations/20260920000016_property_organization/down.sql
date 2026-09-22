-- Откат привязки объекта к организации (миграция 20260920000016_property_organization; в её шапке
-- решение названо ADR-059, в DECISIONS.md оно записано как ADR-061).
-- После отката резолвер объекта (`apps/api/src/database/property-ref.ts`) не найдёт колонку —
-- откатывать только вместе с кодом до ADR-061. Данные броней, гостей и денег не затрагиваются.

DROP INDEX IF EXISTS "properties_organization_id_idx";

ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_organization_id_fkey";

ALTER TABLE "properties" DROP COLUMN IF EXISTS "organization_id";
