-- Откат v1.11: глобальная уникальность кода места возвращается, только если коды не повторяются между объектами —
-- иначе индекс не встанет, и откат отказывает словами до любого изменения.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "inventory_units" GROUP BY "code" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Откат 20260926000024 невозможен: один код места есть в нескольких объектах — сначала переименуйте места';
  END IF;
END $$;

DROP INDEX IF EXISTS "inventory_units_property_id_code_key";
CREATE UNIQUE INDEX "inventory_units_code_key" ON "inventory_units"("code");
ALTER TABLE "inventory_units" DROP CONSTRAINT IF EXISTS "inventory_units_property_id_fkey";
ALTER TABLE "inventory_units" DROP COLUMN "property_id";
