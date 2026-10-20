BEGIN;
LOCK TABLE beauty_service_materials, beauty_service_material_revisions, kitchen_products, kitchen_stock_lots, kitchen_stock_movements IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM beauty_service_materials) OR EXISTS (SELECT 1 FROM beauty_service_material_revisions) THEN
    RAISE EXCEPTION 'Rollback blocked: Beauty material cards exist';
  END IF;
  IF EXISTS (SELECT 1 FROM kitchen_stock_movements WHERE appointment_line_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback blocked: Beauty material consumption exists';
  END IF;
  IF EXISTS (SELECT 1 FROM kitchen_products product JOIN businesses business ON business.id = product.business_id WHERE business.vertical = 'BEAUTY') THEN
    RAISE EXCEPTION 'Rollback blocked: Beauty stock products exist';
  END IF;
END $$;

ALTER TABLE kitchen_stock_movements DROP CONSTRAINT kitchen_stock_movements_service_source_check;
ALTER TABLE kitchen_stock_movements DROP CONSTRAINT kitchen_stock_movements_appointment_line_fkey;
DROP INDEX kitchen_stock_movements_appointment_line_product_lot_key;
DROP INDEX kitchen_stock_movements_appointment_line_idx;
ALTER TABLE kitchen_stock_movements DROP COLUMN appointment_line_id;
DROP TRIGGER beauty_service_materials_guard ON beauty_service_materials;
DROP TRIGGER beauty_service_material_revisions_guard ON beauty_service_material_revisions;
DROP FUNCTION beauty_service_material_guard();
DROP TABLE beauty_service_materials;
DROP TABLE beauty_service_material_revisions;

CREATE OR REPLACE FUNCTION kitchen_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'kitchen_products' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical = 'FOOD_SERVICE') THEN RAISE EXCEPTION 'Food business required'; END IF;
 WHEN 'kitchen_stock_lots', 'kitchen_stock_movements' THEN
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.product_id <> OLD.product_id) THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  SELECT p.business_id INTO biz FROM kitchen_products p WHERE p.id = NEW.product_id;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND business_id = biz) THEN RAISE EXCEPTION 'Kitchen product belongs to another business'; END IF;
  -- вложенный IF: PL/pgSQL не обещает короткое замыкание AND, а у партий поля lot_id нет
  IF TG_TABLE_NAME = 'kitchen_stock_movements' THEN
   IF NEW.lot_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM kitchen_stock_lots WHERE id = NEW.lot_id AND location_id = NEW.location_id AND product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'Kitchen lot belongs to another location or product';
   END IF;
  END IF;
 END CASE;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION kitchen_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'menu_item_ingredients' THEN
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM kitchen_products p JOIN menu_items m ON m.business_id = p.business_id
    WHERE p.id = NEW.product_id AND m.id = NEW.menu_item_id AND p.unit = NEW.unit) THEN
   RAISE EXCEPTION 'Tech card product belongs to another business or unit';
  END IF;
 ELSE
  IF NEW.order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM restaurant_orders o WHERE o.id = NEW.order_id AND o.location_id = NEW.location_id) THEN
   RAISE EXCEPTION 'Stock movement order belongs to another location';
  END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.kitchen_stock_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.kitchen_link_guard() SET search_path = %s',s,path);
END $$;
COMMIT;
