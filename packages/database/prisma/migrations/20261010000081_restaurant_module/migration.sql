-- Ресторан v2: меню, техкарты, заказы, кухня, зарплата (DATA_MODEL §33, ADR-159)

-- CreateEnum
CREATE TYPE "RestaurantOrderStatus" AS ENUM ('NEW', 'COOKING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeePayModel" AS ENUM ('FIXED', 'PERCENT', 'FIXED_PLUS_PERCENT', 'BONUS_ONLY');

-- AlterTable: статус «Уборка» на плане зала (§33.3)
ALTER TABLE "dining_tables" ADD COLUMN "needs_cleaning" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "weight_grams" INTEGER,
    "price" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tech_notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_ingredients" (
    "id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "norm_qty" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(8) NOT NULL,
    "unit_cost" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "menu_item_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_orders" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "table_id" UUID,
    "waiter_id" UUID,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "status" "RestaurantOrderStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "total" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooking_at" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "served_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "restaurant_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "price" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "notes" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "restaurant_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_pay_settings" (
    "employee_id" UUID NOT NULL,
    "model" "EmployeePayModel" NOT NULL DEFAULT 'FIXED',
    "fixed_minor" BIGINT NOT NULL DEFAULT 0,
    "percent" SMALLINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "employee_pay_settings_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "employee_pay_adjustments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "employee_pay_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_business_id_name_key" ON "menu_categories"("business_id", "name");

-- CreateIndex
CREATE INDEX "menu_items_business_id_idx" ON "menu_items"("business_id");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "menu_items"("category_id");

-- CreateIndex
CREATE INDEX "menu_item_ingredients_menu_item_id_idx" ON "menu_item_ingredients"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_orders_location_id_number_key" ON "restaurant_orders"("location_id", "number");

-- CreateIndex
CREATE INDEX "restaurant_orders_location_id_opened_at_idx" ON "restaurant_orders"("location_id", "opened_at");

-- CreateIndex
CREATE INDEX "restaurant_orders_location_id_status_idx" ON "restaurant_orders"("location_id", "status");

-- CreateIndex
CREATE INDEX "restaurant_orders_table_id_idx" ON "restaurant_orders"("table_id");

-- CreateIndex
CREATE INDEX "restaurant_orders_waiter_id_idx" ON "restaurant_orders"("waiter_id");

-- CreateIndex
CREATE INDEX "restaurant_order_items_order_id_idx" ON "restaurant_order_items"("order_id");

-- CreateIndex
CREATE INDEX "restaurant_order_items_menu_item_id_idx" ON "restaurant_order_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "employee_pay_adjustments_employee_id_period_idx" ON "employee_pay_adjustments"("employee_id", "period");

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_settings" ADD CONSTRAINT "employee_pay_settings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_settings" ADD CONSTRAINT "employee_pay_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_adjustments" ADD CONSTRAINT "employee_pay_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_adjustments" ADD CONSTRAINT "employee_pay_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Инварианты значений
ALTER TABLE menu_categories ADD CONSTRAINT menu_categories_values CHECK (btrim(name) <> '');
ALTER TABLE menu_items ADD CONSTRAINT menu_items_values CHECK (price >= 0 AND (weight_grams IS NULL OR weight_grams > 0) AND btrim(name) <> '');
ALTER TABLE menu_item_ingredients ADD CONSTRAINT menu_item_ingredients_values CHECK (norm_qty > 0 AND unit_cost >= 0 AND unit IN ('г', 'мл', 'шт') AND btrim(name) <> '');
ALTER TABLE restaurant_orders ADD CONSTRAINT restaurant_orders_values CHECK (number > 0 AND guest_count > 0 AND total >= 0);
ALTER TABLE restaurant_order_items ADD CONSTRAINT restaurant_order_items_values CHECK (qty > 0 AND price >= 0 AND btrim(name) <> '');
ALTER TABLE employee_pay_settings ADD CONSTRAINT employee_pay_settings_values CHECK (fixed_minor >= 0 AND percent BETWEEN 0 AND 100);
ALTER TABLE employee_pay_adjustments ADD CONSTRAINT employee_pay_adjustments_values CHECK (amount_minor <> 0 AND period = date_trunc('month', period)::date AND btrim(reason) <> '');

-- Принадлежность: бизнес FOOD_SERVICE у меню и заказов, стол и официант своего филиала/бизнеса
CREATE FUNCTION restaurant_module_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid; loc_biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'menu_categories' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical = 'FOOD_SERVICE') THEN RAISE EXCEPTION 'Restaurant business required'; END IF;
 WHEN 'menu_items' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical = 'FOOD_SERVICE') THEN RAISE EXCEPTION 'Restaurant business required'; END IF;
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

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_module_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['menu_categories','menu_items','menu_item_ingredients','restaurant_orders','restaurant_order_items','employee_pay_settings','employee_pay_adjustments'] LOOP
  EXECUTE format('CREATE TRIGGER restaurant_module_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION restaurant_module_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;

CREATE POLICY rls_tenant ON menu_categories TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON menu_items TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON menu_item_ingredients TO wetop_app USING (EXISTS (SELECT 1 FROM menu_items m WHERE m.id=menu_item_id));
CREATE POLICY rls_tenant ON restaurant_orders TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON restaurant_order_items TO wetop_app USING (EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id=order_id));
CREATE POLICY rls_tenant ON employee_pay_settings TO wetop_app USING (EXISTS (SELECT 1 FROM employees e JOIN businesses b ON b.id=e.business_id WHERE e.id=employee_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON employee_pay_adjustments TO wetop_app USING (EXISTS (SELECT 1 FROM employees e JOIN businesses b ON b.id=e.business_id WHERE e.id=employee_id AND b.organization_id=app_current_org()));
