-- MKT8 (ADR-149, DATA_MODEL §29.5; Q-270 решён владельцем 07.10.2026): библиотека изображений управляемого сайта.
-- Хранилище приватный S3 в Казахстане, в базе только непрозрачный ключ объекта, без поставщика, бакета и адреса. Права
-- ролей отдельной миграцией 067 (как 061, 063, 065): восстановление копии повторяет только миграции прав. Откат: down.sql.
-- На рабочей базе применяет владелец.

-- CreateEnum
CREATE TYPE "SiteAssetKind" AS ENUM ('IMAGE', 'LOGO', 'FAVICON');

-- CreateEnum
CREATE TYPE "SiteAssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "SiteAssetSource" AS ENUM ('UPLOAD', 'CHANNEX_IMPORT');

-- CreateTable
CREATE TABLE "site_assets" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "kind" "SiteAssetKind" NOT NULL,
    "status" "SiteAssetStatus" NOT NULL,
    "source" "SiteAssetSource" NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "storage_ref" VARCHAR(500) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "default_alt" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "site_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_assets_storage_ref_key" ON "site_assets"("storage_ref");

-- CreateIndex
CREATE INDEX "site_assets_location_id_status_idx" ON "site_assets"("location_id", "status");

-- AddForeignKey
ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Хранится только обработанная копия: WebP у картинки и логотипа, PNG 512×512 у фавиконки (§29.5, план MKT8 §6).
-- Ключ объекта выводится из строки целиком: филиал, id и sha256 те же, другого места в бакете у ассета нет
ALTER TABLE "site_assets"
  ADD CONSTRAINT "site_assets_mime" CHECK (
    "mime_type" = CASE WHEN "kind" = 'FAVICON' THEN 'image/png' ELSE 'image/webp' END),
  ADD CONSTRAINT "site_assets_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "site_assets_storage_ref" CHECK (
    "storage_ref" = 'site-assets/' || "location_id"::text || '/' || "id"::text || '/' || "sha256"
      || CASE WHEN "kind" = 'FAVICON' THEN '.png' ELSE '.webp' END),
  ADD CONSTRAINT "site_assets_byte_size" CHECK ("byte_size" BETWEEN 1 AND 10485760),
  ADD CONSTRAINT "site_assets_dimensions" CHECK (
    CASE "kind"
      WHEN 'FAVICON' THEN "width" = 512 AND "height" = 512
      WHEN 'LOGO' THEN "width" BETWEEN 1 AND 1600 AND "height" BETWEEN 1 AND 1600
      ELSE "width" BETWEEN 1 AND 2400 AND "height" BETWEEN 1 AND 2400
    END),
  ADD CONSTRAINT "site_assets_default_alt" CHECK ("default_alt" IS NULL OR jsonb_typeof("default_alt") = 'object'),
  ADD CONSTRAINT "site_assets_deleted_at" CHECK (("status" = 'DELETED') = ("deleted_at" IS NOT NULL));

-- Повтор той же картинки того же назначения в филиале: один живой ассет (DELETED место освобождает)
CREATE UNIQUE INDEX "site_assets_live_key" ON "site_assets"("location_id", "kind", "sha256") WHERE "status" <> 'DELETED';

-- Владелец, источник и время создания не меняются никогда; вид, байты и ключ не меняются после READY; переходы по
-- плану MKT8 §3, DELETED конечный. Вставка без DELETED: удалённого ассета не бывает без живого прошлого
CREATE FUNCTION site_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.status = 'DELETED' THEN
   RAISE EXCEPTION 'site_assets: новый ассет не может быть удалённым';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id <> OLD.id OR NEW.location_id <> OLD.location_id OR NEW.source <> OLD.source OR NEW.created_at <> OLD.created_at THEN
  RAISE EXCEPTION 'site_assets: владелец, источник и время создания не меняются';
 END IF;
 IF OLD.status IN ('READY', 'DELETED') AND (
    NEW.kind <> OLD.kind OR NEW.sha256 <> OLD.sha256 OR NEW.storage_ref <> OLD.storage_ref OR NEW.mime_type <> OLD.mime_type
    OR NEW.byte_size <> OLD.byte_size OR NEW.width <> OLD.width OR NEW.height <> OLD.height) THEN
  RAISE EXCEPTION 'site_assets: готовый ассет не меняет вид, байты и ключ';
 END IF;
 IF NEW.status <> OLD.status AND (OLD.status, NEW.status) NOT IN (
    ('UPLOADING', 'PROCESSING'), ('UPLOADING', 'READY'), ('UPLOADING', 'REJECTED'),
    ('PROCESSING', 'READY'), ('PROCESSING', 'REJECTED'), ('READY', 'DELETED'), ('REJECTED', 'DELETED')) THEN
  RAISE EXCEPTION 'site_assets: переход % → % запрещён', OLD.status, NEW.status;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.site_asset_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER site_asset_guard BEFORE INSERT OR UPDATE ON "site_assets"
  FOR EACH ROW EXECUTE FUNCTION site_asset_guard();

-- Изоляция (§29.9): ассет по цепочке Location → Business → организация, как сайт
ALTER TABLE "site_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "site_assets" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));

-- Права ролей приложения: отдельной миграцией 067, чтобы восстановление копии их повторило
