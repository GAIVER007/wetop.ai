-- Добавки списывают продукты склада (DATA_MODEL §62.2, срез K2; план plans/2026-10-24-kitchen-for-all-verticals.md,
-- утверждён владельцем 24.10.2026). Аддитивно, backfill нет: у существующих добавок продуктов нет, ничего не меняется.

BEGIN;

CREATE TABLE "menu_modifier_ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modifier_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "norm_qty" DECIMAL(14,3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "menu_modifier_ingredients_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_modifier_ingredients_values" CHECK ("norm_qty" > 0)
);
CREATE UNIQUE INDEX "menu_modifier_ingredients_modifier_id_product_id_key"
  ON "menu_modifier_ingredients"("modifier_id", "product_id");
CREATE INDEX "menu_modifier_ingredients_product_id_idx" ON "menu_modifier_ingredients"("product_id");
ALTER TABLE "menu_modifier_ingredients" ADD CONSTRAINT "menu_modifier_ingredients_modifier_id_fkey"
  FOREIGN KEY ("modifier_id") REFERENCES "menu_modifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_modifier_ingredients" ADD CONSTRAINT "menu_modifier_ingredients_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Продукт добавки того же бизнеса, что группа добавки; родитель строки неизменен
CREATE FUNCTION menu_modifier_ingredient_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.modifier_id <> OLD.modifier_id OR NEW.product_id <> OLD.product_id) THEN
  RAISE EXCEPTION 'Modifier ingredient parent is immutable';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM menu_modifiers m
   JOIN menu_modifier_groups g ON g.id = m.group_id
   JOIN kitchen_products p ON p.business_id = g.business_id
   WHERE m.id = NEW.modifier_id AND p.id = NEW.product_id) THEN
  RAISE EXCEPTION 'Modifier ingredient belongs to another business';
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.menu_modifier_ingredient_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER menu_modifier_ingredient_guard BEFORE INSERT OR UPDATE ON menu_modifier_ingredients
  FOR EACH ROW EXECUTE FUNCTION menu_modifier_ingredient_guard();

ALTER TABLE "menu_modifier_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menu_modifier_ingredients" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON menu_modifier_ingredients TO wetop_app USING (EXISTS (
  SELECT 1 FROM menu_modifiers m
  JOIN menu_modifier_groups g ON g.id = m.group_id
  JOIN businesses b ON b.id = g.business_id
  WHERE m.id = modifier_id AND b.organization_id = app_current_org()));

GRANT SELECT, INSERT, UPDATE, DELETE ON menu_modifier_ingredients TO wetop_app, wetop_service;

COMMIT;
