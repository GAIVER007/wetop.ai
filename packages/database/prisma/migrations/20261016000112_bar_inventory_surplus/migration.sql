-- Излишек при инвентаризации бара (DATA_MODEL §47, v2.31, ADR-175): партия без строки прихода
ALTER TABLE "bar_stock_lots" ALTER COLUMN "receipt_line_id" DROP NOT NULL;

CREATE OR REPLACE FUNCTION bar_child_ownership_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  parent_location uuid;
  product_location uuid;
  line_product uuid;
  lot_location uuid;
  lot_product uuid;
  receipt_property uuid;
  cash_property uuid;
BEGIN
  IF TG_TABLE_NAME = 'bar_receipt_lines' THEN
    SELECT r.location_id INTO parent_location FROM bar_receipts r WHERE r.id=NEW.receipt_id FOR SHARE;
    SELECT p.location_id INTO product_location FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF parent_location IS NULL OR product_location IS NULL OR parent_location<>product_location THEN
      RAISE EXCEPTION 'BAR receipt line ownership mismatch';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF EXISTS (SELECT 1 FROM bar_stock_lots l WHERE l.receipt_line_id=OLD.id AND (l.location_id<>parent_location OR l.product_id<>NEW.product_id)) THEN
        RAISE EXCEPTION 'BAR receipt line ownership would invalidate an existing lot';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_stock_lots' THEN
    SELECT p.location_id INTO product_location FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF NEW.receipt_line_id IS NULL THEN
      -- излишек инвентаризации (§47): партия без прихода, только товар своего филиала
      IF product_location IS NULL OR NEW.location_id<>product_location THEN
        RAISE EXCEPTION 'BAR stock lot ownership mismatch';
      END IF;
    ELSE
      SELECT r.location_id, l.product_id INTO parent_location, line_product
        FROM bar_receipt_lines l JOIN bar_receipts r ON r.id=l.receipt_id
        WHERE l.id=NEW.receipt_line_id FOR SHARE OF l,r;
      IF product_location IS NULL OR parent_location IS NULL OR NEW.location_id<>product_location OR NEW.location_id<>parent_location OR NEW.product_id<>line_product THEN
        RAISE EXCEPTION 'BAR stock lot ownership mismatch';
      END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF EXISTS (SELECT 1 FROM bar_stock_movements m WHERE m.lot_id=OLD.id AND (m.location_id<>NEW.location_id OR m.product_id<>NEW.product_id)) THEN
        RAISE EXCEPTION 'BAR stock lot ownership would invalidate an existing movement';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_stock_movements' THEN
    SELECT p.location_id INTO product_location FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF product_location IS NULL OR NEW.location_id<>product_location THEN
      RAISE EXCEPTION 'BAR stock movement product ownership mismatch';
    END IF;
    IF NEW.lot_id IS NOT NULL THEN
      SELECT l.location_id,l.product_id INTO lot_location,lot_product FROM bar_stock_lots l WHERE l.id=NEW.lot_id FOR SHARE;
      IF lot_location IS NULL OR NEW.location_id<>lot_location OR NEW.product_id<>lot_product THEN
        RAISE EXCEPTION 'BAR stock movement lot ownership mismatch';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_sale_lines' THEN
    SELECT s.location_id INTO parent_location FROM bar_sales s WHERE s.id=NEW.sale_id FOR SHARE;
    SELECT p.location_id INTO product_location FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF parent_location IS NULL OR product_location IS NULL OR parent_location<>product_location THEN
      RAISE EXCEPTION 'BAR sale line ownership mismatch';
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_supplier_payments' THEN
    IF NEW.restaurant_cash_operation_id IS NOT NULL THEN
      -- касса ресторана (§45): того же филиала, что и приход
      SELECT r.location_id INTO parent_location FROM bar_receipts r WHERE r.id=NEW.receipt_id FOR SHARE;
      SELECT c.location_id INTO lot_location FROM restaurant_cash_operations c WHERE c.id=NEW.restaurant_cash_operation_id FOR SHARE;
      IF parent_location IS NULL OR lot_location IS NULL OR parent_location<>lot_location THEN
        RAISE EXCEPTION 'BAR supplier payment ownership mismatch';
      END IF;
    ELSE
      -- касса гостиницы: только у прихода бара гостиницы и того же объекта
      SELECT r.property_id INTO receipt_property FROM bar_receipts r WHERE r.id=NEW.receipt_id FOR SHARE;
      SELECT c.property_id INTO cash_property FROM cash_operations c WHERE c.id=NEW.cash_operation_id FOR SHARE;
      IF receipt_property IS NULL OR cash_property IS NULL OR receipt_property<>cash_property THEN
        RAISE EXCEPTION 'BAR supplier payment ownership mismatch';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported table for bar_child_ownership_guard: %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.bar_child_ownership_guard() SET search_path = %s', s, path);
END $$;
