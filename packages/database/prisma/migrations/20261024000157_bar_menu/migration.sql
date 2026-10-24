-- «Меню бара» у гостиницы и салона (DATA_MODEL §62.3, срез K3; план plans/2026-10-24-kitchen-for-all-verticals.md,
-- утверждён владельцем 24.10.2026, Q-KITCHEN-ALL-1 «а»: продажа через бар, без экрана кухни).
-- Аддитивно: таблицы меню прежние, стражи пускают гостиницу и салон; строка продажи бара может быть позицией меню.
-- Данные не меняются: у всех существующих строк продажи product_id заполнен.

BEGIN;

-- Строка продажи бара: товар бара ИЛИ позиция меню (ровно одно); снимок выбранных добавок текстом
ALTER TABLE "bar_sale_lines" ALTER COLUMN "product_id" DROP NOT NULL;
ALTER TABLE "bar_sale_lines" ADD COLUMN "menu_item_id" UUID;
ALTER TABLE "bar_sale_lines" ADD COLUMN "note" VARCHAR(500);
ALTER TABLE "bar_sale_lines" ADD CONSTRAINT "bar_sale_lines_menu_item_id_fkey"
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bar_sale_lines" ADD CONSTRAINT "bar_sale_lines_one_source"
  CHECK (("product_id" IS NULL) <> ("menu_item_id" IS NULL));
CREATE INDEX "bar_sale_lines_menu_item_id_idx" ON "bar_sale_lines"("menu_item_id");
-- себестоимость позиции меню может быть нулевой (нет техкарты или всё в недостаче): у товара бара как прежде > 0
ALTER TABLE "bar_sale_lines" DROP CONSTRAINT "bar_sale_lines_values_valid";
ALTER TABLE "bar_sale_lines" ADD CONSTRAINT "bar_sale_lines_values_valid" CHECK (
  "quantity_units" > 0 AND "sale_price" > 0 AND "revenue" = "quantity_units" * "sale_price"
  AND ("cost" > 0 OR ("menu_item_id" IS NOT NULL AND "cost" = 0)));
ALTER TABLE "bar_sales" DROP CONSTRAINT "bar_sales_values_valid";
ALTER TABLE "bar_sales" ADD CONSTRAINT "bar_sales_values_valid" CHECK (
  "total_revenue" > 0 AND "total_cost" >= 0
  AND (("status" = 'POSTED' AND "reversed_at" IS NULL) OR ("status" = 'REVERSED' AND "reversed_at" IS NOT NULL)));

-- Расход склада кухни по продаже бара
ALTER TABLE "kitchen_stock_movements" ADD COLUMN "bar_sale_id" UUID;
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_bar_sale_id_fkey"
  FOREIGN KEY ("bar_sale_id") REFERENCES "bar_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "kitchen_stock_movements_bar_sale_id_idx" ON "kitchen_stock_movements"("bar_sale_id");
-- расход по продаже бара: ровно один источник из заказа, строки записи и продажи бара (продолжение 135)
ALTER TABLE "kitchen_stock_movements" DROP CONSTRAINT "kitchen_stock_movements_service_source_check";
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_service_source_check" CHECK (
  ("appointment_line_id" IS NULL OR ("kind" = 'CONSUMPTION' AND "order_id" IS NULL AND "bar_sale_id" IS NULL))
  AND ("bar_sale_id" IS NULL OR ("order_id" IS NULL AND "appointment_line_id" IS NULL
       AND "kind" IN ('CONSUMPTION', 'SHORTAGE', 'CONSUMPTION_RETURN')))
  AND ("kind" <> 'CONSUMPTION' OR (("order_id" IS NOT NULL)::int + ("appointment_line_id" IS NOT NULL)::int + ("bar_sale_id" IS NOT NULL)::int) = 1)
);

CREATE OR REPLACE FUNCTION restaurant_module_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid; loc_biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'menu_categories' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical IN ('FOOD_SERVICE','BEAUTY','HOSPITALITY')) THEN RAISE EXCEPTION 'Menu business required'; END IF;
 WHEN 'menu_items' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical IN ('FOOD_SERVICE','BEAUTY','HOSPITALITY')) THEN RAISE EXCEPTION 'Menu business required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE id = NEW.category_id AND business_id = NEW.business_id) THEN RAISE EXCEPTION 'Menu category belongs to another business'; END IF;
 WHEN 'menu_item_ingredients' THEN
  IF TG_OP = 'UPDATE' AND NEW.menu_item_id <> OLD.menu_item_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 WHEN 'restaurant_orders' THEN
  IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  SELECT b.id INTO loc_biz FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = NEW.location_id AND b.vertical = 'FOOD_SERVICE';
  IF loc_biz IS NULL THEN RAISE EXCEPTION 'Restaurant location required'; END IF;
  IF NEW.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dining_tables t JOIN dining_areas a ON a.id = t.area_id WHERE t.id = NEW.table_id AND a.location_id = NEW.location_id) THEN RAISE EXCEPTION 'Order table belongs to another location'; END IF;
  IF NEW.waiter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = NEW.waiter_id AND e.business_id = loc_biz) THEN RAISE EXCEPTION 'Order waiter belongs to another business'; END IF;
 WHEN 'restaurant_order_items' THEN
  IF TG_OP = 'UPDATE' AND NEW.order_id <> OLD.order_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NEW.menu_item_id IS NOT NULL THEN
   SELECT b.business_id INTO loc_biz FROM restaurant_orders o JOIN locations b ON b.id = o.location_id WHERE o.id = NEW.order_id;
   IF NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.id = NEW.menu_item_id AND m.business_id = loc_biz) THEN RAISE EXCEPTION 'Order item dish belongs to another business'; END IF;
  END IF;
 WHEN 'employee_pay_settings', 'employee_pay_adjustments' THEN
  IF TG_OP = 'UPDATE' AND NEW.employee_id <> OLD.employee_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 END CASE;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION restaurant_modifier_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'menu_modifier_groups' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical IN ('FOOD_SERVICE','BEAUTY','HOSPITALITY')) THEN RAISE EXCEPTION 'Menu business required'; END IF;
 WHEN 'menu_modifiers' THEN
  IF TG_OP = 'UPDATE' AND NEW.group_id <> OLD.group_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 WHEN 'menu_item_modifier_groups' THEN
  IF NOT EXISTS (SELECT 1 FROM menu_items m JOIN menu_modifier_groups g ON g.business_id = m.business_id
                  WHERE m.id = NEW.menu_item_id AND g.id = NEW.group_id) THEN
   RAISE EXCEPTION 'Modifier group belongs to another business';
  END IF;
 WHEN 'restaurant_order_item_modifiers' THEN
  IF TG_OP = 'UPDATE' AND NEW.order_item_id <> OLD.order_item_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NEW.modifier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM restaurant_order_items i JOIN restaurant_orders o ON o.id = i.order_id JOIN locations l ON l.id = o.location_id
      JOIN menu_modifiers mm ON mm.id = NEW.modifier_id JOIN menu_modifier_groups g ON g.id = mm.group_id
     WHERE i.id = NEW.order_item_id AND g.business_id = l.business_id) THEN
   RAISE EXCEPTION 'Order modifier belongs to another business';
  END IF;
 WHEN 'restaurant_payment_items' THEN
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.payment_id, NEW.order_item_id, NEW.amount, NEW.created_at) IS DISTINCT FROM (OLD.payment_id, OLD.order_item_id, OLD.amount, OLD.created_at)
   THEN RAISE EXCEPTION 'Restaurant payment item is immutable'; END IF;
   IF OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at THEN RAISE EXCEPTION 'Released payment item stays released'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM restaurant_payments p JOIN restaurant_order_items i ON i.order_id = p.order_id
                  WHERE p.id = NEW.payment_id AND i.id = NEW.order_item_id) THEN
   RAISE EXCEPTION 'Payment item belongs to another order';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM restaurant_payments p WHERE p.id = NEW.payment_id AND p.status <> 'COMPLETED') THEN
   RAISE EXCEPTION 'Payment item requires a completed payment';
  END IF;
 END CASE;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION menu_item_photo_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.menu_item_id <> OLD.menu_item_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM menu_items m JOIN businesses b ON b.id = m.business_id WHERE m.id = NEW.menu_item_id AND b.vertical IN ('FOOD_SERVICE','BEAUTY','HOSPITALITY')) THEN RAISE EXCEPTION 'Menu business required'; END IF;
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
    IF NEW.product_id IS NOT NULL THEN
      SELECT p.location_id INTO product_location FROM bar_products p WHERE p.id=NEW.product_id FOR SHARE;
      IF parent_location IS NULL OR product_location IS NULL OR parent_location<>product_location THEN
        RAISE EXCEPTION 'BAR sale line ownership mismatch';
      END IF;
    ELSE
      -- §62.3: позиция меню бизнеса филиала продажи
      IF parent_location IS NULL OR NOT EXISTS (
        SELECT 1 FROM menu_items m JOIN locations l ON l.business_id = m.business_id
        WHERE m.id = NEW.menu_item_id AND l.id = parent_location) THEN
        RAISE EXCEPTION 'BAR sale line ownership mismatch';
      END IF;
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
  IF NEW.appointment_line_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM appointment_lines line
    JOIN appointments appointment ON appointment.id = line.appointment_id
    WHERE line.id = NEW.appointment_line_id AND appointment.location_id = NEW.location_id) THEN
   RAISE EXCEPTION 'Stock movement appointment line belongs to another location';
  END IF;
  IF NEW.bar_sale_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM bar_sales sale WHERE sale.id = NEW.bar_sale_id AND sale.location_id = NEW.location_id) THEN
   RAISE EXCEPTION 'Stock movement bar sale belongs to another location';
  END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_module_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.restaurant_modifier_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.menu_item_photo_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.bar_child_ownership_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.kitchen_link_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
