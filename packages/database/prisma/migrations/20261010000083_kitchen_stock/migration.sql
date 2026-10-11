-- Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS). Аддитивно, backfill нет.

-- CreateEnum
CREATE TYPE "KitchenMovementKind" AS ENUM ('RECEIPT', 'WRITE_OFF', 'INVENTORY', 'REVERSAL');

-- CreateTable
CREATE TABLE "kitchen_products" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "unit" VARCHAR(8) NOT NULL,
    "min_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kitchen_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_stock_lots" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier" VARCHAR(200),
    "document" VARCHAR(100),
    "received_on" DATE NOT NULL,
    "received_qty" DECIMAL(14,3) NOT NULL,
    "remaining_qty" DECIMAL(14,3) NOT NULL,
    "unit_cost" BIGINT NOT NULL,
    "expires_on" DATE,
    "reversed_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kitchen_stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_stock_movements" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lot_id" UUID,
    "kind" "KitchenMovementKind" NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "cost" BIGINT NOT NULL,
    "reason" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_products_business_id_name_key" ON "kitchen_products"("business_id", "name");

-- CreateIndex
CREATE INDEX "kitchen_stock_lots_location_id_product_id_idx" ON "kitchen_stock_lots"("location_id", "product_id");

-- CreateIndex
CREATE INDEX "kitchen_stock_movements_location_id_created_at_idx" ON "kitchen_stock_movements"("location_id", "created_at");

-- CreateIndex
CREATE INDEX "kitchen_stock_movements_product_id_idx" ON "kitchen_stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "kitchen_stock_movements_lot_id_idx" ON "kitchen_stock_movements"("lot_id");

-- AddForeignKey
ALTER TABLE "kitchen_products" ADD CONSTRAINT "kitchen_products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_lots" ADD CONSTRAINT "kitchen_stock_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_lots" ADD CONSTRAINT "kitchen_stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_lots" ADD CONSTRAINT "kitchen_stock_lots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "kitchen_stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE kitchen_products ADD CONSTRAINT kitchen_products_values CHECK (btrim(name) <> '' AND unit IN ('г','мл','шт') AND min_qty >= 0);
ALTER TABLE kitchen_stock_lots ADD CONSTRAINT kitchen_stock_lots_values CHECK (received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty AND unit_cost > 0 AND (reversed_at IS NULL OR remaining_qty = 0));
ALTER TABLE kitchen_stock_movements ADD CONSTRAINT kitchen_stock_movements_values CHECK (qty <> 0);

-- Принадлежность: продукт бизнеса FOOD_SERVICE; партия и движение на филиале бизнеса продукта;
-- движение с партией: та же партия филиала и продукта; родительские поля неизменяемы.
CREATE FUNCTION kitchen_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF TG_TABLE_NAME = 'kitchen_stock_movements' AND NEW.lot_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM kitchen_stock_lots WHERE id = NEW.lot_id AND location_id = NEW.location_id AND product_id = NEW.product_id) THEN
   RAISE EXCEPTION 'Kitchen lot belongs to another location or product';
  END IF;
 END CASE;
 RETURN NEW;
END $$;

-- Лента только дописывается (как audit_logs_immutable, …22): обход только для уборки тестовых данных
CREATE FUNCTION kitchen_movements_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('wetop.audit_purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
 RAISE EXCEPTION 'kitchen_stock_movements: лента только дописывается, % запрещён', TG_OP USING ERRCODE = 'raise_exception';
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.kitchen_stock_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.kitchen_movements_immutable() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['kitchen_products','kitchen_stock_lots','kitchen_stock_movements'] LOOP
  EXECUTE format('CREATE TRIGGER kitchen_stock_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION kitchen_stock_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE TRIGGER kitchen_movements_immutable BEFORE UPDATE OR DELETE ON kitchen_stock_movements FOR EACH ROW EXECUTE FUNCTION kitchen_movements_immutable();

CREATE POLICY rls_tenant ON kitchen_products TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON kitchen_stock_lots TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON kitchen_stock_movements TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
