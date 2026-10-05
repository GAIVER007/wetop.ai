-- BAR-REPAIR-2: dispatch before referencing fields of distinct trigger row types.
-- Existing function identity, trigger names and business rules stay intact.
CREATE OR REPLACE FUNCTION bar_property_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'bar_products' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM bar_categories c
      WHERE c.id = NEW.category_id AND c.property_id = NEW.property_id
    ) THEN
      RAISE EXCEPTION 'Category belongs to another property';
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_receipts' THEN
    IF NEW.supplier_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM bar_suppliers s
      WHERE s.id = NEW.supplier_id AND s.property_id = NEW.property_id
    ) THEN
      RAISE EXCEPTION 'Supplier belongs to another property';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported table for bar_property_guard: %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

-- Guarantee the pinned path independently of CREATE OR REPLACE preservation.
DO $$
DECLARE
  s text := current_schema();
  path text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.bar_property_guard() SET search_path = %s', s, path);
END $$;
