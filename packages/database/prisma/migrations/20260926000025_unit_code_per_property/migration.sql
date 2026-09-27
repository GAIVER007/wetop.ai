-- DATA_MODEL v1.11 (26.09.2026, ADR-096) — план plans/tenant-isolation-2026-09-26.md п. 2.
-- Код места уникален внутри объекта, а не во всей базе: вторая гостиница с кодами «101…» не падает на онбординге,
-- а поиск места по коду без объекта больше невозможен по построению (раньше вошедший из чужой организации находил
-- место Luxx по её коду). property_id дублирует объект категории и хранится, чтобы уникальность держала сама база.
ALTER TABLE "inventory_units" ADD COLUMN "property_id" UUID;

UPDATE "inventory_units" AS u
   SET "property_id" = t."property_id"
  FROM "accommodation_types" AS t
 WHERE t."id" = u."accommodation_type_id";

ALTER TABLE "inventory_units" ALTER COLUMN "property_id" SET NOT NULL;

ALTER TABLE "inventory_units"
  ADD CONSTRAINT "inventory_units_property_id_fkey" FOREIGN KEY ("property_id")
  REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "inventory_units_code_key";
CREATE UNIQUE INDEX "inventory_units_property_id_code_key" ON "inventory_units"("property_id", "code");
