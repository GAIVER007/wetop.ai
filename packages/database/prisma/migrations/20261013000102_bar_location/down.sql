-- Откат §44: бар снова только на объекте гостиницы. Отказ, если есть бар без объекта (бар салона или ресторана)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bar_categories WHERE property_id IS NULL UNION ALL SELECT 1 FROM bar_products WHERE property_id IS NULL
    UNION ALL SELECT 1 FROM bar_suppliers WHERE property_id IS NULL UNION ALL SELECT 1 FROM bar_receipts WHERE property_id IS NULL
    UNION ALL SELECT 1 FROM bar_stock_lots WHERE property_id IS NULL UNION ALL SELECT 1 FROM bar_stock_movements WHERE property_id IS NULL
    UNION ALL SELECT 1 FROM bar_sales WHERE property_id IS NULL) THEN
    RAISE EXCEPTION 'BAR rows without a property exist: rollback of 102 would lose them';
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales'] LOOP
    EXECUTE format('DROP POLICY rls_tenant ON %I', t);
    EXECUTE format('DROP TRIGGER %I ON %I', t || '_location_fill', t);
    EXECUTE format('DROP TRIGGER %I ON %I', t || '_property_immutable', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF property_id ON %I FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard()', t || '_property_immutable', t);
  END LOOP;
END $$;
DROP POLICY rls_tenant ON bar_receipt_lines;
DROP POLICY rls_tenant ON bar_supplier_payments;
DROP POLICY rls_tenant ON bar_sale_lines;
DROP FUNCTION bar_location_guard();

DROP TRIGGER bar_stock_lots_ownership ON bar_stock_lots;
CREATE TRIGGER bar_stock_lots_ownership BEFORE INSERT OR UPDATE OF property_id,product_id,receipt_line_id ON bar_stock_lots FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
DROP TRIGGER bar_stock_movements_ownership ON bar_stock_movements;
CREATE TRIGGER bar_stock_movements_ownership BEFORE INSERT OR UPDATE OF property_id,product_id,lot_id ON bar_stock_movements FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
DROP TRIGGER bar_products_property_guard ON bar_products;
CREATE TRIGGER "bar_products_property_guard" BEFORE INSERT OR UPDATE OF "category_id", "property_id" ON "bar_products" FOR EACH ROW EXECUTE FUNCTION bar_property_guard();
DROP TRIGGER bar_receipts_property_guard ON bar_receipts;
CREATE TRIGGER "bar_receipts_property_guard" BEFORE INSERT OR UPDATE OF "supplier_id", "property_id" ON "bar_receipts" FOR EACH ROW EXECUTE FUNCTION bar_property_guard();

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

CREATE OR REPLACE FUNCTION bar_property_immutable_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF TG_TABLE_NAME NOT IN ('bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales') OR TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Unsupported table/operation for bar_property_immutable_guard';
  END IF;
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'BAR property_id is immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION bar_child_ownership_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
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

CREATE OR REPLACE FUNCTION bar_sale_links_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
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


DO $$
DECLARE
  s text := current_schema();
  path text;
  fn text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  FOREACH fn IN ARRAY ARRAY['bar_property_guard','bar_property_immutable_guard','bar_child_ownership_guard','bar_sale_links_guard'] LOOP
    EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = %s', s, fn, path);
  END LOOP;
END $$;

DROP INDEX "bar_categories_location_id_name_key";
CREATE UNIQUE INDEX "bar_categories_property_id_name_key" ON "bar_categories"("property_id", "name");
DROP INDEX "bar_products_location_id_code_key";
DROP INDEX "bar_products_location_id_barcode_key";
DROP INDEX "bar_products_location_id_active_idx";
CREATE UNIQUE INDEX "bar_products_property_id_code_key" ON "bar_products"("property_id", "code");
CREATE UNIQUE INDEX "bar_products_property_id_barcode_key" ON "bar_products"("property_id", "barcode");
CREATE INDEX "bar_products_property_id_active_idx" ON "bar_products"("property_id", "active");
DROP INDEX "bar_suppliers_location_id_name_key";
CREATE UNIQUE INDEX "bar_suppliers_property_id_name_key" ON "bar_suppliers"("property_id", "name");
DROP INDEX "bar_receipts_location_id_supplier_id_document_number_key";
DROP INDEX "bar_receipts_location_id_received_date_idx";
CREATE UNIQUE INDEX "bar_receipts_property_id_supplier_id_document_number_key" ON "bar_receipts"("property_id", "supplier_id", "document_number");
CREATE INDEX "bar_receipts_property_id_received_date_idx" ON "bar_receipts"("property_id", "received_date");
DROP INDEX "bar_stock_lots_location_id_product_id_received_at_idx";
CREATE INDEX "bar_stock_lots_property_id_product_id_received_at_idx" ON "bar_stock_lots"("property_id", "product_id", "received_at");
DROP INDEX "bar_stock_movements_location_id_product_id_created_at_idx";
CREATE INDEX "bar_stock_movements_property_id_product_id_created_at_idx" ON "bar_stock_movements"("property_id", "product_id", "created_at");
DROP INDEX "bar_sales_location_id_idempotency_key_key";
DROP INDEX "bar_sales_location_id_created_at_idx";
CREATE UNIQUE INDEX "bar_sales_property_id_idempotency_key_key" ON "bar_sales"("property_id", "idempotency_key");
CREATE INDEX "bar_sales_property_id_created_at_idx" ON "bar_sales"("property_id", "created_at");

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales'] LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, t || '_location_id_fkey');
    EXECUTE format('ALTER TABLE %I DROP COLUMN "location_id"', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "property_id" SET NOT NULL', t);
  END LOOP;
END $$;

CREATE POLICY rls_tenant ON "bar_categories" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_products" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_suppliers" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_receipts" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_receipt_lines" FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id))) WITH CHECK (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id)));
CREATE POLICY rls_tenant ON "bar_stock_lots" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_stock_movements" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_supplier_payments" FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id))) WITH CHECK (EXISTS (SELECT 1 FROM bar_receipts r WHERE r.id = receipt_id AND app_property_visible(r.property_id)));
CREATE POLICY rls_tenant ON "bar_sales" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
CREATE POLICY rls_tenant ON "bar_sale_lines" FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_sales s WHERE s.id = sale_id AND app_property_visible(s.property_id))) WITH CHECK (EXISTS (SELECT 1 FROM bar_sales s WHERE s.id = sale_id AND app_property_visible(s.property_id)));
