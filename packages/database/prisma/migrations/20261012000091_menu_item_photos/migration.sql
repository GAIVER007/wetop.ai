-- Фото блюд меню (DATA_MODEL §37, v2.20, ADR-167)

-- CreateTable
CREATE TABLE "menu_item_photos" (
    "menu_item_id" UUID NOT NULL,
    "storage_ref" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "menu_item_photos_pkey" PRIMARY KEY ("menu_item_id")
);
-- CreateIndex
CREATE UNIQUE INDEX "menu_item_photos_storage_ref_key" ON "menu_item_photos"("storage_ref");
-- AddForeignKey
ALTER TABLE "menu_item_photos" ADD CONSTRAINT "menu_item_photos_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "menu_item_photos" ADD CONSTRAINT "menu_item_photos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Значения
ALTER TABLE menu_item_photos ADD CONSTRAINT menu_item_photos_values CHECK (
  byte_size > 0 AND width > 0 AND height > 0 AND btrim(storage_ref) <> '' AND sha256 ~ '^[0-9a-f]{64}$'
);

-- Родитель неизменяем, блюдо только ресторанного бизнеса (тот же образец, что restaurant_module_guard)
CREATE FUNCTION menu_item_photo_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.menu_item_id <> OLD.menu_item_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM menu_items m JOIN businesses b ON b.id = m.business_id WHERE m.id = NEW.menu_item_id AND b.vertical = 'FOOD_SERVICE') THEN RAISE EXCEPTION 'Restaurant business required'; END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.menu_item_photo_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER menu_item_photo_guard BEFORE INSERT OR UPDATE ON menu_item_photos FOR EACH ROW EXECUTE FUNCTION menu_item_photo_guard();
ALTER TABLE menu_item_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON menu_item_photos TO wetop_app USING (EXISTS (SELECT 1 FROM menu_items m WHERE m.id=menu_item_id));
