-- Откат 155 (заготовки). Перед откатом партии заготовок и движения PRODUCTION_* должны быть сняты владельцем:
-- перечисление пересоздаётся без новых значений. Страж склада возвращается к виду 135 (без гостиницы).
BEGIN;

DROP TABLE "kitchen_prep_recipe_lines";
DROP TABLE "kitchen_prep_recipes";
DROP FUNCTION kitchen_prep_guard();

ALTER TABLE "kitchen_stock_movements" DROP CONSTRAINT "kitchen_stock_movements_production_lot_id_fkey";
DROP INDEX "kitchen_stock_movements_production_lot_id_idx";
ALTER TABLE "kitchen_stock_movements" DROP COLUMN "production_lot_id";

CREATE OR REPLACE FUNCTION kitchen_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'kitchen_products' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical IN ('FOOD_SERVICE','BEAUTY')) THEN RAISE EXCEPTION 'Food or Beauty business required'; END IF;
 WHEN 'kitchen_stock_lots', 'kitchen_stock_movements' THEN
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.product_id <> OLD.product_id) THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  SELECT p.business_id INTO biz FROM kitchen_products p WHERE p.id = NEW.product_id;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND business_id = biz) THEN RAISE EXCEPTION 'Kitchen product belongs to another business'; END IF;
  IF TG_TABLE_NAME = 'kitchen_stock_movements' THEN
   IF NEW.lot_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM kitchen_stock_lots WHERE id = NEW.lot_id AND location_id = NEW.location_id AND product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'Kitchen lot belongs to another location or product';
   END IF;
  END IF;
 END CASE;
 RETURN NEW;
END $$;

ALTER TABLE "kitchen_products" DROP COLUMN "kind";
DROP TYPE "KitchenProductKind";

-- CHECK из 135 сравнивает kind со значением перечисления: снимаем на время пересоздания типа и ставим как было
ALTER TABLE "kitchen_stock_movements" DROP CONSTRAINT "kitchen_stock_movements_service_source_check";
ALTER TYPE "KitchenMovementKind" RENAME TO "KitchenMovementKind_old";
CREATE TYPE "KitchenMovementKind" AS ENUM ('RECEIPT', 'WRITE_OFF', 'INVENTORY', 'REVERSAL', 'CONSUMPTION', 'SHORTAGE', 'CONSUMPTION_RETURN');
ALTER TABLE "kitchen_stock_movements" ALTER COLUMN "kind" TYPE "KitchenMovementKind" USING ("kind"::text::"KitchenMovementKind");
DROP TYPE "KitchenMovementKind_old";
ALTER TABLE "kitchen_stock_movements"
  ADD CONSTRAINT "kitchen_stock_movements_service_source_check" CHECK (
    ("appointment_line_id" IS NULL OR ("kind" = 'CONSUMPTION' AND "order_id" IS NULL))
    AND ("kind" <> 'CONSUMPTION' OR (("order_id" IS NOT NULL) <> ("appointment_line_id" IS NOT NULL)))
  );

-- CREATE OR REPLACE сбрасывает search_path функции: возвращаем как в 089/135
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.kitchen_stock_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
