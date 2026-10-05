-- DATA_MODEL BAR Property boundary, ADR-BAR-OWNERSHIP, approved 2026-10-05.
-- Existing data must be consistent. Do not silently repair financial/stock records.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'BAR ownership migration requires an administrative BYPASSRLS role for validation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bar_products p JOIN bar_categories c ON c.id=p.category_id WHERE p.property_id<>c.property_id
    UNION ALL
    SELECT 1 FROM bar_receipts r JOIN bar_suppliers s ON s.id=r.supplier_id WHERE r.property_id<>s.property_id
    UNION ALL
    SELECT 1 FROM bar_receipt_lines l JOIN bar_receipts r ON r.id=l.receipt_id JOIN bar_products p ON p.id=l.product_id WHERE r.property_id<>p.property_id
    UNION ALL
    SELECT 1 FROM bar_stock_lots l JOIN bar_products p ON p.id=l.product_id JOIN bar_receipt_lines rl ON rl.id=l.receipt_line_id JOIN bar_receipts r ON r.id=rl.receipt_id WHERE l.property_id<>p.property_id OR l.property_id<>r.property_id OR l.product_id<>rl.product_id
    UNION ALL
    SELECT 1 FROM bar_stock_movements m JOIN bar_products p ON p.id=m.product_id LEFT JOIN bar_stock_lots l ON l.id=m.lot_id WHERE m.property_id<>p.property_id OR (l.id IS NOT NULL AND (m.property_id<>l.property_id OR m.product_id<>l.product_id))
    UNION ALL
    SELECT 1 FROM bar_sale_lines l JOIN bar_sales s ON s.id=l.sale_id JOIN bar_products p ON p.id=l.product_id WHERE s.property_id<>p.property_id
    UNION ALL
    SELECT 1 FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE r.property_id<>c.property_id
    UNION ALL
    SELECT 1 FROM bar_sales s JOIN folios f ON f.id=s.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE s.property_id<>r.property_id
    UNION ALL
    SELECT 1 FROM bar_sales s JOIN cash_operations c ON c.id=s.cash_operation_id WHERE s.property_id<>c.property_id
    UNION ALL
    SELECT 1 FROM bar_sales s JOIN charges c ON c.id=s.charge_id JOIN folios f ON f.id=c.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE s.property_id<>r.property_id OR (s.folio_id IS NOT NULL AND s.folio_id<>c.folio_id)
  ) THEN
    RAISE EXCEPTION 'Existing BAR ownership violations: reconciliation required before migration';
  END IF;
END $$;

CREATE FUNCTION bar_property_immutable_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF TG_TABLE_NAME NOT IN ('bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales') OR TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Unsupported table/operation for bar_property_immutable_guard';
  END IF;
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'BAR property_id is immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION bar_child_ownership_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  parent_property uuid;
  product_property uuid;
  line_product uuid;
  lot_property uuid;
  lot_product uuid;
BEGIN
  IF TG_TABLE_NAME = 'bar_receipt_lines' THEN
    SELECT r.property_id INTO parent_property FROM bar_receipts r WHERE r.id=NEW.receipt_id FOR SHARE;
    SELECT p.property_id INTO product_property FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF parent_property IS NULL OR product_property IS NULL OR parent_property<>product_property THEN
      RAISE EXCEPTION 'BAR receipt line ownership mismatch';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF EXISTS (SELECT 1 FROM bar_stock_lots l WHERE l.receipt_line_id=OLD.id AND (l.property_id<>parent_property OR l.product_id<>NEW.product_id)) THEN
        RAISE EXCEPTION 'BAR receipt line ownership would invalidate an existing lot';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_stock_lots' THEN
    SELECT p.property_id INTO product_property FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    SELECT r.property_id, l.product_id INTO parent_property, line_product
      FROM bar_receipt_lines l JOIN bar_receipts r ON r.id=l.receipt_id
      WHERE l.id=NEW.receipt_line_id FOR SHARE OF l,r;
    IF product_property IS NULL OR parent_property IS NULL OR NEW.property_id<>product_property OR NEW.property_id<>parent_property OR NEW.product_id<>line_product THEN
      RAISE EXCEPTION 'BAR stock lot ownership mismatch';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF EXISTS (SELECT 1 FROM bar_stock_movements m WHERE m.lot_id=OLD.id AND (m.property_id<>NEW.property_id OR m.product_id<>NEW.product_id)) THEN
        RAISE EXCEPTION 'BAR stock lot ownership would invalidate an existing movement';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_stock_movements' THEN
    SELECT p.property_id INTO product_property FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF product_property IS NULL OR NEW.property_id<>product_property THEN
      RAISE EXCEPTION 'BAR stock movement product ownership mismatch';
    END IF;
    IF NEW.lot_id IS NOT NULL THEN
      SELECT l.property_id,l.product_id INTO lot_property,lot_product FROM bar_stock_lots l WHERE l.id=NEW.lot_id FOR SHARE;
      IF lot_property IS NULL OR NEW.property_id<>lot_property OR NEW.product_id<>lot_product THEN
        RAISE EXCEPTION 'BAR stock movement lot ownership mismatch';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_sale_lines' THEN
    SELECT s.property_id INTO parent_property FROM bar_sales s WHERE s.id=NEW.sale_id FOR SHARE;
    SELECT p.property_id INTO product_property FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
    IF parent_property IS NULL OR product_property IS NULL OR parent_property<>product_property THEN
      RAISE EXCEPTION 'BAR sale line ownership mismatch';
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_supplier_payments' THEN
    SELECT r.property_id INTO parent_property FROM bar_receipts r WHERE r.id=NEW.receipt_id FOR SHARE;
    SELECT c.property_id INTO product_property FROM cash_operations c WHERE c.id=NEW.cash_operation_id FOR SHARE;
    IF parent_property IS NULL OR product_property IS NULL OR parent_property<>product_property THEN
      RAISE EXCEPTION 'BAR supplier payment ownership mismatch';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported table for bar_child_ownership_guard: %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION bar_sale_links_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  linked_property uuid;
  charge_folio uuid;
BEGIN
  IF TG_TABLE_NAME <> 'bar_sales' THEN
    RAISE EXCEPTION 'Unsupported table for bar_sale_links_guard: %', TG_TABLE_NAME;
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

-- Pin paths explicitly on every new function, including in pms_test.
DO $$
DECLARE
  s text := current_schema();
  path text;
  fn text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  FOREACH fn IN ARRAY ARRAY['bar_property_immutable_guard','bar_child_ownership_guard','bar_sale_links_guard'] LOOP
    EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = %s', s, fn, path);
  END LOOP;
END $$;

CREATE TRIGGER bar_categories_property_immutable BEFORE UPDATE OF property_id ON bar_categories FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_products_property_immutable BEFORE UPDATE OF property_id ON bar_products FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_suppliers_property_immutable BEFORE UPDATE OF property_id ON bar_suppliers FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_receipts_property_immutable BEFORE UPDATE OF property_id ON bar_receipts FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_stock_lots_property_immutable BEFORE UPDATE OF property_id ON bar_stock_lots FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_stock_movements_property_immutable BEFORE UPDATE OF property_id ON bar_stock_movements FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_sales_property_immutable BEFORE UPDATE OF property_id ON bar_sales FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard();
CREATE TRIGGER bar_receipt_lines_ownership BEFORE INSERT OR UPDATE OF receipt_id,product_id ON bar_receipt_lines FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
CREATE TRIGGER bar_stock_lots_ownership BEFORE INSERT OR UPDATE OF property_id,product_id,receipt_line_id ON bar_stock_lots FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
CREATE TRIGGER bar_stock_movements_ownership BEFORE INSERT OR UPDATE OF property_id,product_id,lot_id ON bar_stock_movements FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
CREATE TRIGGER bar_sale_lines_ownership BEFORE INSERT OR UPDATE OF sale_id,product_id ON bar_sale_lines FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
CREATE TRIGGER bar_supplier_payments_ownership BEFORE INSERT OR UPDATE OF receipt_id,cash_operation_id ON bar_supplier_payments FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
CREATE TRIGGER bar_sales_links_ownership BEFORE INSERT OR UPDATE OF property_id,folio_id,cash_operation_id,charge_id ON bar_sales FOR EACH ROW EXECUTE FUNCTION bar_sale_links_guard();
