-- Кухня FS1: меню ресторана (DATA_MODEL §33, ADR-KITCHEN-FS).
-- Каталог на Business, переопределения на Location. Аддитивно, backfill нет.

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
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
    "category_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(64),
    "description" TEXT,
    "price" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "output_weight_grams" INTEGER,
    "prep_time_minutes" INTEGER,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_menu_items" (
    "location_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "price_override" BIGINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "location_menu_items_pkey" PRIMARY KEY ("location_id","menu_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_business_id_name_key" ON "menu_categories"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_business_id_name_key" ON "menu_items"("business_id", "name");

-- CreateIndex
CREATE INDEX "menu_items_business_id_category_id_idx" ON "menu_items"("business_id", "category_id");

-- CreateIndex
CREATE INDEX "location_menu_items_menu_item_id_idx" ON "location_menu_items"("menu_item_id");

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_menu_items" ADD CONSTRAINT "location_menu_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_menu_items" ADD CONSTRAINT "location_menu_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE menu_categories ADD CONSTRAINT menu_categories_name CHECK (btrim(name) <> '');
ALTER TABLE menu_items ADD CONSTRAINT menu_items_values CHECK (
  btrim(name) <> '' AND price >= 0
  AND (output_weight_grams IS NULL OR output_weight_grams > 0)
  AND (prep_time_minutes IS NULL OR prep_time_minutes > 0)
);
ALTER TABLE location_menu_items ADD CONSTRAINT location_menu_items_values CHECK (price_override IS NULL OR price_override >= 0);

CREATE FUNCTION menu_ownership_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'menu_categories' THEN
  biz := NEW.business_id;
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Menu parent is immutable'; END IF;
 WHEN 'menu_items' THEN
  biz := NEW.business_id;
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Menu parent is immutable'; END IF;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM menu_categories WHERE id = NEW.category_id AND business_id = biz) THEN RAISE EXCEPTION 'Menu category belongs to another business'; END IF;
 WHEN 'location_menu_items' THEN
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.menu_item_id <> OLD.menu_item_id) THEN RAISE EXCEPTION 'Menu parent is immutable'; END IF;
  SELECT business_id INTO biz FROM locations WHERE id = NEW.location_id;
  IF NOT EXISTS (SELECT 1 FROM menu_items WHERE id = NEW.menu_item_id AND business_id = biz) THEN RAISE EXCEPTION 'Menu item belongs to another business'; END IF;
 END CASE;
 IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = biz AND vertical = 'FOOD_SERVICE') THEN RAISE EXCEPTION 'Food business required'; END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.menu_ownership_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['menu_categories','menu_items','location_menu_items'] LOOP
  EXECUTE format('CREATE TRIGGER menu_ownership_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION menu_ownership_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;

CREATE POLICY rls_tenant ON menu_categories TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON menu_items TO wetop_app USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id=business_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON location_menu_items TO wetop_app USING (EXISTS (SELECT 1 FROM menu_items i WHERE i.id=menu_item_id) AND EXISTS (SELECT 1 FROM locations l WHERE l.id=location_id));
