-- Заготовки для всех направлений (DATA_MODEL §62, срез K1; план plans/2026-10-24-kitchen-for-all-verticals.md,
-- утверждён владельцем 24.10.2026). Аддитивно, backfill нет: у существующих продуктов вид RAW.
-- Заодно склад кухни открывается гостинице и в базе (ADR-STOCK-ALL 21.10.2026 открыл его в API и экране,
-- а страж kitchen_stock_guard из 135 пускал только FOOD_SERVICE и BEAUTY: продукт гостиницы не создавался).

BEGIN;

CREATE TYPE "KitchenProductKind" AS ENUM ('RAW', 'PREP');
ALTER TABLE "kitchen_products" ADD COLUMN "kind" "KitchenProductKind" NOT NULL DEFAULT 'RAW';

ALTER TYPE "KitchenMovementKind" ADD VALUE 'PRODUCTION_OUT';
ALTER TYPE "KitchenMovementKind" ADD VALUE 'PRODUCTION_IN';

-- движение ингредиента (расход, недостача, возврат) указывает на партию заготовки, ради которой списано
ALTER TABLE "kitchen_stock_movements" ADD COLUMN "production_lot_id" UUID;
CREATE INDEX "kitchen_stock_movements_production_lot_id_idx" ON "kitchen_stock_movements"("production_lot_id");
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_production_lot_id_fkey"
  FOREIGN KEY ("production_lot_id") REFERENCES "kitchen_stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "kitchen_prep_recipes" (
    "product_id" UUID NOT NULL,
    "yield_qty" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "kitchen_prep_recipes_pkey" PRIMARY KEY ("product_id"),
    CONSTRAINT "kitchen_prep_recipes_values" CHECK ("yield_qty" > 0)
);
ALTER TABLE "kitchen_prep_recipes" ADD CONSTRAINT "kitchen_prep_recipes_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "kitchen_prep_recipe_lines" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "norm_qty" DECIMAL(14,3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kitchen_prep_recipe_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kitchen_prep_recipe_lines_values" CHECK ("norm_qty" > 0 AND "product_id" <> "ingredient_id")
);
CREATE UNIQUE INDEX "kitchen_prep_recipe_lines_product_id_ingredient_id_key"
  ON "kitchen_prep_recipe_lines"("product_id", "ingredient_id");
CREATE INDEX "kitchen_prep_recipe_lines_ingredient_id_idx" ON "kitchen_prep_recipe_lines"("ingredient_id");
ALTER TABLE "kitchen_prep_recipe_lines" ADD CONSTRAINT "kitchen_prep_recipe_lines_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "kitchen_prep_recipes"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kitchen_prep_recipe_lines" ADD CONSTRAINT "kitchen_prep_recipe_lines_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Склад кухни у трёх направлений (продолжение 135); вид продукта неизменен, пока по нему есть партии или техкарта
CREATE OR REPLACE FUNCTION kitchen_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'kitchen_products' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical IN ('FOOD_SERVICE','BEAUTY','HOSPITALITY')) THEN RAISE EXCEPTION 'Food, Beauty or Hospitality business required'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.kind <> OLD.kind AND (
       EXISTS (SELECT 1 FROM kitchen_stock_lots WHERE product_id = NEW.id)
    OR EXISTS (SELECT 1 FROM kitchen_prep_recipes WHERE product_id = NEW.id)) THEN
   RAISE EXCEPTION 'Kitchen product kind is fixed after receipts or recipe';
  END IF;
 WHEN 'kitchen_stock_lots', 'kitchen_stock_movements' THEN
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.product_id <> OLD.product_id) THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  SELECT p.business_id INTO biz FROM kitchen_products p WHERE p.id = NEW.product_id;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND business_id = biz) THEN RAISE EXCEPTION 'Kitchen product belongs to another business'; END IF;
  IF TG_TABLE_NAME = 'kitchen_stock_movements' THEN
   IF NEW.lot_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM kitchen_stock_lots WHERE id = NEW.lot_id AND location_id = NEW.location_id AND product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'Kitchen lot belongs to another location or product';
   END IF;
   IF NEW.production_lot_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM kitchen_stock_lots l JOIN kitchen_products p ON p.id = l.product_id
                      WHERE l.id = NEW.production_lot_id AND l.location_id = NEW.location_id AND p.kind = 'PREP') THEN
    RAISE EXCEPTION 'Production lot belongs to another location or is not a prep';
   END IF;
  END IF;
 END CASE;
 RETURN NEW;
END $$;

-- Техкарта заготовки: продукт вида PREP; ингредиент того же бизнеса; без циклов (прямых и через другие заготовки)
CREATE FUNCTION kitchen_prep_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'kitchen_prep_recipes' THEN
  IF TG_OP = 'UPDATE' AND NEW.product_id <> OLD.product_id THEN RAISE EXCEPTION 'Prep recipe parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM kitchen_products WHERE id = NEW.product_id AND kind = 'PREP') THEN
   RAISE EXCEPTION 'Prep recipe requires a PREP product';
  END IF;
 ELSE
  IF TG_OP = 'UPDATE' AND (NEW.product_id <> OLD.product_id OR NEW.ingredient_id <> OLD.ingredient_id) THEN
   RAISE EXCEPTION 'Prep recipe line parent is immutable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM kitchen_products p JOIN kitchen_products i ON i.business_id = p.business_id
                 WHERE p.id = NEW.product_id AND i.id = NEW.ingredient_id) THEN
   RAISE EXCEPTION 'Prep ingredient belongs to another business';
  END IF;
  IF EXISTS (
    WITH RECURSIVE down(id) AS (
      SELECT NEW.ingredient_id
      UNION
      SELECT l.ingredient_id FROM kitchen_prep_recipe_lines l JOIN down d ON l.product_id = d.id
    ) SELECT 1 FROM down WHERE id = NEW.product_id) THEN
   RAISE EXCEPTION 'Prep recipe cycle';
  END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.kitchen_stock_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.kitchen_prep_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['kitchen_prep_recipes','kitchen_prep_recipe_lines'] LOOP
  EXECUTE format('CREATE TRIGGER kitchen_prep_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION kitchen_prep_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;

CREATE POLICY rls_tenant ON kitchen_prep_recipes TO wetop_app USING (EXISTS (
  SELECT 1 FROM kitchen_products p JOIN businesses b ON b.id = p.business_id
  WHERE p.id = product_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON kitchen_prep_recipe_lines TO wetop_app USING (EXISTS (
  SELECT 1 FROM kitchen_products p JOIN businesses b ON b.id = p.business_id
  WHERE p.id = product_id AND b.organization_id = app_current_org()));

GRANT SELECT, INSERT, UPDATE, DELETE ON kitchen_prep_recipes, kitchen_prep_recipe_lines TO wetop_app, wetop_service;

COMMIT;
