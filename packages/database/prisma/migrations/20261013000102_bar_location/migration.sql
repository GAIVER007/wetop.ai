-- Бар на филиале (DATA_MODEL §44, v2.27, ADR-178): владение по location_id, объект гостиницы необязателен.
-- Гостиничные деньги (счёт гостя, начисления, касса гостиницы) охраняются как прежде.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'BAR location migration requires an administrative BYPASSRLS role for backfill';
  END IF;
END $$;

-- 1. Колонка филиала у верхних таблиц, заполнение из объекта гостиницы
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "location_id" UUID', t);
    EXECUTE format('UPDATE %I x SET location_id = p.location_id FROM properties p WHERE p.id = x.property_id', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "location_id" SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "property_id" DROP NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_location_id_fkey');
  END LOOP;
END $$;

-- 2. Уникальности и индексы по филиалу
DROP INDEX "bar_categories_property_id_name_key";
CREATE UNIQUE INDEX "bar_categories_location_id_name_key" ON "bar_categories"("location_id", "name");
DROP INDEX "bar_products_property_id_code_key";
DROP INDEX "bar_products_property_id_barcode_key";
DROP INDEX "bar_products_property_id_active_idx";
CREATE UNIQUE INDEX "bar_products_location_id_code_key" ON "bar_products"("location_id", "code");
CREATE UNIQUE INDEX "bar_products_location_id_barcode_key" ON "bar_products"("location_id", "barcode");
CREATE INDEX "bar_products_location_id_active_idx" ON "bar_products"("location_id", "active");
DROP INDEX "bar_suppliers_property_id_name_key";
CREATE UNIQUE INDEX "bar_suppliers_location_id_name_key" ON "bar_suppliers"("location_id", "name");
DROP INDEX "bar_receipts_property_id_supplier_id_document_number_key";
DROP INDEX "bar_receipts_property_id_received_date_idx";
CREATE UNIQUE INDEX "bar_receipts_location_id_supplier_id_document_number_key" ON "bar_receipts"("location_id", "supplier_id", "document_number");
CREATE INDEX "bar_receipts_location_id_received_date_idx" ON "bar_receipts"("location_id", "received_date");
DROP INDEX "bar_stock_lots_property_id_product_id_received_at_idx";
CREATE INDEX "bar_stock_lots_location_id_product_id_received_at_idx" ON "bar_stock_lots"("location_id", "product_id", "received_at");
DROP INDEX "bar_stock_movements_property_id_product_id_created_at_idx";
CREATE INDEX "bar_stock_movements_location_id_product_id_created_at_idx" ON "bar_stock_movements"("location_id", "product_id", "created_at");
DROP INDEX "bar_sales_property_id_idempotency_key_key";
DROP INDEX "bar_sales_property_id_created_at_idx";
CREATE UNIQUE INDEX "bar_sales_location_id_idempotency_key_key" ON "bar_sales"("location_id", "idempotency_key");
CREATE INDEX "bar_sales_location_id_created_at_idx" ON "bar_sales"("location_id", "created_at");

-- 3. Филиал из объекта, объект только этого филиала
CREATE FUNCTION bar_location_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE property_location uuid;
BEGIN
  IF TG_TABLE_NAME NOT IN ('bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales') THEN
    RAISE EXCEPTION 'Unsupported table for bar_location_guard: %', TG_TABLE_NAME;
  END IF;
  IF NEW.property_id IS NOT NULL THEN
    SELECT p.location_id INTO property_location FROM properties p WHERE p.id = NEW.property_id FOR SHARE;
    IF property_location IS NULL THEN
      -- объект не виден под RLS (чужая организация) или без филиала: строка не принимается
      RAISE EXCEPTION 'BAR property is not visible or has no location';
    END IF;
    IF NEW.location_id IS NULL THEN
      NEW.location_id := property_location;
    ELSIF NEW.location_id <> property_location THEN
      RAISE EXCEPTION 'BAR property belongs to another location';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 4. Охрана владения по филиалу (прежние имена функций и тексты отказов)
CREATE OR REPLACE FUNCTION bar_property_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'bar_products' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM bar_categories c WHERE c.id = NEW.category_id AND c.location_id = NEW.location_id
    ) THEN
      RAISE EXCEPTION 'Category belongs to another property';
    END IF;
  ELSIF TG_TABLE_NAME = 'bar_receipts' THEN
    IF NEW.supplier_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM bar_suppliers s WHERE s.id = NEW.supplier_id AND s.location_id = NEW.location_id
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
  IF NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.location_id IS DISTINCT FROM OLD.location_id THEN
    RAISE EXCEPTION 'BAR property_id is immutable';
  END IF;
  RETURN NEW;
END $$;

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

-- Связи продажи с деньгами гостиницы: только у строки с объектом; сравнение с NULL иначе молча пропустило бы связь
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
DECLARE
  s text := current_schema();
  path text;
  fn text;
  t text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  FOREACH fn IN ARRAY ARRAY['bar_location_guard','bar_property_guard','bar_property_immutable_guard','bar_child_ownership_guard','bar_sale_links_guard'] LOOP
    EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = %s', s, fn, path);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales'] LOOP
    -- имя «..._location_fill» идёт по алфавиту раньше прочих BEFORE-триггеров строки: филиал заполнен до их проверок
    -- только вставка: смену объекта или филиала у готовой строки отклоняет охрана неизменности
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION bar_location_guard()', t || '_location_fill', t);
    EXECUTE format('DROP TRIGGER %I ON %I', t || '_property_immutable', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF property_id, location_id ON %I FOR EACH ROW EXECUTE FUNCTION bar_property_immutable_guard()', t || '_property_immutable', t);
  END LOOP;
END $$;

-- Охрана партий и движений срабатывает и на смену филиала
DROP TRIGGER bar_stock_lots_ownership ON bar_stock_lots;
CREATE TRIGGER bar_stock_lots_ownership BEFORE INSERT OR UPDATE OF location_id,product_id,receipt_line_id ON bar_stock_lots FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
DROP TRIGGER bar_stock_movements_ownership ON bar_stock_movements;
CREATE TRIGGER bar_stock_movements_ownership BEFORE INSERT OR UPDATE OF location_id,product_id,lot_id ON bar_stock_movements FOR EACH ROW EXECUTE FUNCTION bar_child_ownership_guard();
DROP TRIGGER bar_products_property_guard ON bar_products;
CREATE TRIGGER bar_products_property_guard BEFORE INSERT OR UPDATE OF category_id, location_id ON bar_products FOR EACH ROW EXECUTE FUNCTION bar_property_guard();
DROP TRIGGER bar_receipts_property_guard ON bar_receipts;
CREATE TRIGGER bar_receipts_property_guard BEFORE INSERT OR UPDATE OF supplier_id, location_id ON bar_receipts FOR EACH ROW EXECUTE FUNCTION bar_property_guard();

-- 5. RLS по филиалу
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_categories','bar_products','bar_suppliers','bar_receipts','bar_stock_lots','bar_stock_movements','bar_sales'] LOOP
    EXECUTE format('DROP POLICY rls_tenant ON %I', t);
    EXECUTE format('CREATE POLICY rls_tenant ON %I FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()))', t);
  END LOOP;
END $$;
DROP POLICY rls_tenant ON bar_receipt_lines;
CREATE POLICY rls_tenant ON bar_receipt_lines FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_receipts r JOIN locations l ON l.id=r.location_id JOIN businesses b ON b.id=l.business_id WHERE r.id=receipt_id AND b.organization_id=app_current_org())) WITH CHECK (EXISTS (SELECT 1 FROM bar_receipts r JOIN locations l ON l.id=r.location_id JOIN businesses b ON b.id=l.business_id WHERE r.id=receipt_id AND b.organization_id=app_current_org()));
DROP POLICY rls_tenant ON bar_supplier_payments;
CREATE POLICY rls_tenant ON bar_supplier_payments FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_receipts r JOIN locations l ON l.id=r.location_id JOIN businesses b ON b.id=l.business_id WHERE r.id=receipt_id AND b.organization_id=app_current_org())) WITH CHECK (EXISTS (SELECT 1 FROM bar_receipts r JOIN locations l ON l.id=r.location_id JOIN businesses b ON b.id=l.business_id WHERE r.id=receipt_id AND b.organization_id=app_current_org()));
DROP POLICY rls_tenant ON bar_sale_lines;
CREATE POLICY rls_tenant ON bar_sale_lines FOR ALL TO wetop_app USING (EXISTS (SELECT 1 FROM bar_sales s JOIN locations l ON l.id=s.location_id JOIN businesses b ON b.id=l.business_id WHERE s.id=sale_id AND b.organization_id=app_current_org())) WITH CHECK (EXISTS (SELECT 1 FROM bar_sales s JOIN locations l ON l.id=s.location_id JOIN businesses b ON b.id=l.business_id WHERE s.id=sale_id AND b.organization_id=app_current_org()));
