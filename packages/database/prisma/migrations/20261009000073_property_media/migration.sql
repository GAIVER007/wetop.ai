-- ADR-155, DATA_MODEL §31.3: фото и договор объекта. Одна таблица, то же закрытое хранилище, что у библиотеки сайта, но
-- без лицензии конструктора. Права ролей отдельной миграцией 074 (восстановление копии повторяет только миграции прав).
-- Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateTable
CREATE TABLE "property_media" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "file_name" VARCHAR(200),
    "mime_type" VARCHAR(40) NOT NULL,
    "storage_ref" VARCHAR(500) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" CHAR(64) NOT NULL,
    "alt" VARCHAR(200),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_media_storage_ref_key" ON "property_media"("storage_ref");
CREATE INDEX "property_media_property_id_kind_idx" ON "property_media"("property_id", "kind");
-- Тот же файл того же вида на объекте: одна живая запись; один живой договор на объект
CREATE UNIQUE INDEX "property_media_live_key" ON "property_media"("property_id", "kind", "sha256") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "property_media_contract_key" ON "property_media"("property_id") WHERE "kind" = 'CONTRACT' AND "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ключ объекта выводится из строки целиком: объект, id и sha256 те же, другого места в бакете у файла нет
ALTER TABLE "property_media"
  ADD CONSTRAINT "property_media_kind" CHECK ("kind" IN ('PHOTO', 'CONTRACT')),
  ADD CONSTRAINT "property_media_mime" CHECK (
    "mime_type" = CASE WHEN "kind" = 'PHOTO' THEN 'image/webp' ELSE 'application/pdf' END),
  ADD CONSTRAINT "property_media_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "property_media_storage_ref" CHECK (
    "storage_ref" = 'property-media/' || "property_id"::text || '/' || "id"::text || '/' || "sha256"
      || CASE WHEN "kind" = 'PHOTO' THEN '.webp' ELSE '.pdf' END),
  ADD CONSTRAINT "property_media_byte_size" CHECK ("byte_size" BETWEEN 1 AND 10485760),
  ADD CONSTRAINT "property_media_dimensions" CHECK (
    CASE "kind"
      WHEN 'PHOTO' THEN "width" BETWEEN 1 AND 2400 AND "height" BETWEEN 1 AND 2400
      ELSE "width" IS NULL AND "height" IS NULL
    END),
  ADD CONSTRAINT "property_media_position" CHECK ("position" BETWEEN 0 AND 1000);

-- Объект, вид, байты и ключ не меняются никогда: меняются порядок, подпись и удаление
CREATE FUNCTION property_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id <> OLD.id OR NEW.property_id <> OLD.property_id OR NEW.kind <> OLD.kind OR NEW.sha256 <> OLD.sha256
    OR NEW.storage_ref <> OLD.storage_ref OR NEW.byte_size <> OLD.byte_size OR NEW.created_at <> OLD.created_at THEN
  RAISE EXCEPTION 'property_media: объект, вид, байты и ключ не меняются';
 END IF;
 IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
  RAISE EXCEPTION 'property_media: удалённая запись не возвращается';
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.property_media_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER property_media_guard BEFORE UPDATE ON "property_media"
  FOR EACH ROW EXECUTE FUNCTION property_media_guard();

-- Изоляция (ADR-103): как у прочих таблиц объекта
ALTER TABLE "property_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "property_media" FOR ALL TO wetop_app USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
