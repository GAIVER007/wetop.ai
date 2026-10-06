-- TECHNICAL REHEARSAL ONLY: restores the exact pre-55 body, including its known
-- missing RECORD field defect. NOT a safe or recommended production rollback.
-- Operational application rollback must retain migration 55 and the correct guard.
-- Do not run this down on an active BAR database. See reports/bar-repair-2/README.md.
CREATE OR REPLACE FUNCTION bar_property_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'bar_products' AND NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bar_categories c WHERE c.id = NEW.category_id AND c.property_id = NEW.property_id) THEN RAISE EXCEPTION 'Category belongs to another property'; END IF;
  IF TG_TABLE_NAME = 'bar_receipts' AND NOT EXISTS (SELECT 1 FROM bar_suppliers s WHERE s.id = NEW.supplier_id AND s.property_id = NEW.property_id) THEN RAISE EXCEPTION 'Supplier belongs to another property'; END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE
  s text := current_schema();
  path text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.bar_property_guard() SET search_path = %s', s, path);
END $$;
