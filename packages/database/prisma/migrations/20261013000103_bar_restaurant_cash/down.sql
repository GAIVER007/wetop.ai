-- Откат §45: отказ, если есть деньги бара в кассе ресторана (их не к чему привязать без 103)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bar_sales WHERE restaurant_cash_operation_id IS NOT NULL
    UNION ALL SELECT 1 FROM bar_supplier_payments WHERE restaurant_cash_operation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'BAR rows linked to restaurant cash exist: rollback of 103 would lose them';
  END IF;
END $$;
DROP TRIGGER bar_supplier_payments_ownership ON bar_supplier_payments;
CREATE TRIGGER bar_supplier_payments_ownership BEFORE INSERT OR UPDATE OF receipt_id,cash_operation_id ON bar_supplier_payments FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
DROP TRIGGER bar_sales_links_ownership ON bar_sales;
CREATE TRIGGER bar_sales_links_ownership BEFORE INSERT OR UPDATE OF property_id,folio_id,cash_operation_id,charge_id ON bar_sales FOR EACH ROW EXECUTE FUNCTION bar_sale_links_guard();
ALTER TABLE "bar_sales" DROP CONSTRAINT "bar_sales_one_cash";
ALTER TABLE "bar_sales" DROP COLUMN "restaurant_cash_operation_id";
ALTER TABLE "bar_supplier_payments" DROP CONSTRAINT "bar_supplier_payments_one_cash";
ALTER TABLE "bar_supplier_payments" DROP COLUMN "restaurant_cash_operation_id";
ALTER TABLE "bar_supplier_payments" ALTER COLUMN "cash_operation_id" SET NOT NULL;

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
    SELECT r.location_id, l.product_id INTO parent_location, line_product
      FROM bar_receipt_lines l JOIN bar_receipts r ON r.id=l.receipt_id
      WHERE l.id=NEW.receipt_line_id FOR SHARE OF l,r;
    IF product_location IS NULL OR parent_location IS NULL OR NEW.location_id<>product_location OR NEW.location_id<>parent_location OR NEW.product_id<>line_product THEN
      RAISE EXCEPTION 'BAR stock lot ownership mismatch';
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
    -- касса гостиницы: только у прихода бара гостиницы и того же объекта
    SELECT r.property_id INTO receipt_property FROM bar_receipts r WHERE r.id=NEW.receipt_id FOR SHARE;
    SELECT c.property_id INTO cash_property FROM cash_operations c WHERE c.id=NEW.cash_operation_id FOR SHARE;
    IF receipt_property IS NULL OR cash_property IS NULL OR receipt_property<>cash_property THEN
      RAISE EXCEPTION 'BAR supplier payment ownership mismatch';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported table for bar_child_ownership_guard: %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION bar_sale_links_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  linked_property uuid;
  charge_folio uuid;
BEGIN
  IF TG_TABLE_NAME <> 'bar_sales' THEN
    RAISE EXCEPTION 'Unsupported table for bar_sale_links_guard: %', TG_TABLE_NAME;
  END IF;
  IF NEW.property_id IS NULL AND (NEW.folio_id IS NOT NULL OR NEW.cash_operation_id IS NOT NULL OR NEW.charge_id IS NOT NULL) THEN
    RAISE EXCEPTION 'BAR sale hotel money links require a property';
  END IF;
  IF NEW.folio_id IS NOT NULL THEN
    SELECT r.property_id INTO linked_property FROM folios f JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id
      WHERE f.id=NEW.folio_id FOR SHARE OF f,i,r;
    IF linked_property IS NULL OR linked_property<>NEW.property_id THEN
      RAISE EXCEPTION 'BAR sale folio ownership mismatch';
    END IF;
  END IF;
  IF NEW.cash_operation_id IS NOT NULL THEN
    SELECT c.property_id INTO linked_property FROM cash_operations c WHERE c.id=NEW.cash_operation_id FOR SHARE;
    IF linked_property IS NULL OR linked_property<>NEW.property_id THEN
      RAISE EXCEPTION 'BAR sale cash ownership mismatch';
    END IF;
  END IF;
  IF NEW.charge_id IS NOT NULL THEN
    SELECT r.property_id,c.folio_id INTO linked_property,charge_folio FROM charges c JOIN folios f ON f.id=c.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id
      WHERE c.id=NEW.charge_id FOR SHARE OF c,f,i,r;
    IF linked_property IS NULL OR linked_property<>NEW.property_id OR (NEW.folio_id IS NOT NULL AND NEW.folio_id<>charge_folio) THEN
      RAISE EXCEPTION 'BAR sale charge ownership mismatch';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text; fn text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  FOREACH fn IN ARRAY ARRAY['bar_child_ownership_guard','bar_sale_links_guard'] LOOP
    EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = %s', s, fn, path);
  END LOOP;
END $$;
