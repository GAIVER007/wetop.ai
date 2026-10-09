-- Фото категорий размещения (DATA_MODEL §30, ADR-153): категория выбирает до десяти готовых изображений из библиотеки
-- сайта филиала (MKT8, `site_assets`), порядок хранится. Новых файлов и хранилища нет: загрузка остаётся в библиотеке.
-- Права ролей отдельной миграцией 071 (как 066 и 067). Откат: down.sql. На рабочей базе применяет владелец.

-- CreateTable
CREATE TABLE "accommodation_type_photos" (
    "accommodation_type_id" UUID NOT NULL,
    "site_asset_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accommodation_type_photos_pkey" PRIMARY KEY ("accommodation_type_id", "site_asset_id")
);

-- Порядок без повторов внутри категории; не больше десяти
CREATE UNIQUE INDEX "accommodation_type_photos_accommodation_type_id_position_key"
  ON "accommodation_type_photos"("accommodation_type_id", "position");
CREATE INDEX "accommodation_type_photos_site_asset_id_idx" ON "accommodation_type_photos"("site_asset_id");
ALTER TABLE "accommodation_type_photos"
  ADD CONSTRAINT "accommodation_type_photos_position" CHECK ("position" BETWEEN 0 AND 9);

-- AddForeignKey
ALTER TABLE "accommodation_type_photos" ADD CONSTRAINT "accommodation_type_photos_accommodation_type_id_fkey"
  FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accommodation_type_photos" ADD CONSTRAINT "accommodation_type_photos_site_asset_id_fkey"
  FOREIGN KEY ("site_asset_id") REFERENCES "site_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Фото берётся только из библиотеки филиала этого объекта и только как картинка (не логотип и не фавиконка).
-- Готовность и удаление ассета проверяет API; удалённый ассет читатель просто не показывает
CREATE FUNCTION accommodation_type_photo_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE type_location uuid; asset_location uuid; asset_kind text;
BEGIN
 SELECT p.location_id INTO type_location
   FROM accommodation_types t JOIN properties p ON p.id = t.property_id WHERE t.id = NEW.accommodation_type_id;
 SELECT a.location_id, a.kind::text INTO asset_location, asset_kind FROM site_assets a WHERE a.id = NEW.site_asset_id;
 IF type_location IS NULL OR asset_location IS DISTINCT FROM type_location THEN
  RAISE EXCEPTION 'accommodation_type_photos: изображение не из библиотеки филиала этой категории';
 END IF;
 IF asset_kind <> 'IMAGE' THEN
  RAISE EXCEPTION 'accommodation_type_photos: фото категории только вида IMAGE';
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.accommodation_type_photo_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER accommodation_type_photo_guard BEFORE INSERT OR UPDATE ON "accommodation_type_photos"
  FOR EACH ROW EXECUTE FUNCTION accommodation_type_photo_guard();

-- Изоляция: через родителя, у категории своя политика по объекту организации (миграция 028)
ALTER TABLE "accommodation_type_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accommodation_type_photos" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "accommodation_type_photos" TO wetop_app
  USING (EXISTS (SELECT 1 FROM "accommodation_types" t WHERE t."id" = "accommodation_type_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "accommodation_types" t WHERE t."id" = "accommodation_type_id"));
