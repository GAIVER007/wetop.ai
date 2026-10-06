-- MKT3 (ADR-149, DATA_MODEL §29.2–§29.3, Q-272 решён владельцем 06.10.2026): управляемый сайт филиала и его
-- неизменяемые версии SiteSpec. Только две таблицы: публикации и домены (MKT7), генерация (MKT6) и ассеты (MKT8)
-- появятся своими миграциями. Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "MarketingSiteState" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SiteVersionSource" AS ENUM ('MANUAL', 'AI', 'IMPORT');

-- CreateTable
CREATE TABLE "marketing_sites" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "tracked_site_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "state" "MarketingSiteState" NOT NULL DEFAULT 'DRAFT',
    "latest_version_id" UUID,
    "published_version_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketing_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_site_versions" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "parent_version_id" UUID,
    "schema_version" VARCHAR(20) NOT NULL,
    "spec" JSONB NOT NULL,
    "spec_hash" CHAR(64) NOT NULL,
    "source" "SiteVersionSource" NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_site_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_sites_tracked_site_id_key" ON "marketing_sites"("tracked_site_id");

-- CreateIndex
CREATE INDEX "marketing_sites_location_id_idx" ON "marketing_sites"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_site_versions_site_id_revision_key" ON "marketing_site_versions"("site_id", "revision");

-- AddForeignKey
ALTER TABLE "marketing_sites" ADD CONSTRAINT "marketing_sites_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_sites" ADD CONSTRAINT "marketing_sites_tracked_site_id_fkey" FOREIGN KEY ("tracked_site_id") REFERENCES "tracked_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_sites" ADD CONSTRAINT "marketing_sites_latest_version_id_fkey" FOREIGN KEY ("latest_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_sites" ADD CONSTRAINT "marketing_sites_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_sites" ADD CONSTRAINT "marketing_sites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_versions" ADD CONSTRAINT "marketing_site_versions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "marketing_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_versions" ADD CONSTRAINT "marketing_site_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_versions" ADD CONSTRAINT "marketing_site_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Правила сайта, которых Prisma не описывает
ALTER TABLE "marketing_sites"
  ADD CONSTRAINT "marketing_sites_slug_format" CHECK ("slug" ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  ADD CONSTRAINT "marketing_sites_name_present" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "marketing_sites_published_version" CHECK ("state" NOT IN ('PUBLISHED', 'PAUSED') OR "published_version_id" IS NOT NULL),
  ADD CONSTRAINT "marketing_sites_archived_at" CHECK (("state" = 'ARCHIVED') = ("archived_at" IS NOT NULL)),
  -- зарезервированные адреса, тот же список, что RESERVED_SITE_SLUGS (packages/domain/src/marketing/site-slug.ts;
  -- совпадение держит tests/unit/marketing-reserved-slugs.test.ts)
  ADD CONSTRAINT "marketing_sites_slug_reserved" CHECK ("slug" NOT IN (
    'www', 'app', 'api', 'assistant', 'seller', 'admin', 'mail', 'status', 'preview',
    'static', 'assets', 'cdn', 'help', 'support', 'wetop', 'docs', 'blog'));

-- v1: не больше одного неархивного сайта на филиал; адрес уникален среди неархивных
CREATE UNIQUE INDEX "marketing_sites_location_active_key" ON "marketing_sites"("location_id") WHERE "state" <> 'ARCHIVED';
CREATE UNIQUE INDEX "marketing_sites_slug_active_key" ON "marketing_sites"("slug") WHERE "state" <> 'ARCHIVED';

-- Версия: ревизия с единицы, хэш sha256 в нижнем регистре, документ объектом. Предел размера SiteSpec один: 256 КБ
-- канонической записи, его держит проверка документа (validateSiteSpec, API). 384 КБ здесь только грубая страховка
-- базы, а не второй допустимый размер документа: jsonb::text не каноническая запись (пробел после ':' и ',', до 1,5
-- раза длиннее), поэтому тот же порог в базе отклонял бы документы, которые проверку прошли.
-- schema_version совпадает с schemaVersion внутри документа. Источник пока только MANUAL: AI требует связи с
-- generation_runs (MKT6), IMPORT появится вместе с путём импорта; тот срез снимет или заменит этот CHECK.
ALTER TABLE "marketing_site_versions"
  ADD CONSTRAINT "marketing_site_versions_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "marketing_site_versions_hash_format" CHECK ("spec_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "marketing_site_versions_spec_object" CHECK (jsonb_typeof("spec") = 'object'),
  ADD CONSTRAINT "marketing_site_versions_spec_size" CHECK (octet_length("spec"::text) <= 393216),
  ADD CONSTRAINT "marketing_site_versions_schema_version" CHECK (length("schema_version") > 0),
  ADD CONSTRAINT "marketing_site_versions_schema_matches_spec" CHECK (("spec" ->> 'schemaVersion') IS NOT DISTINCT FROM "schema_version"),
  ADD CONSTRAINT "marketing_site_versions_source_manual" CHECK ("source" = 'MANUAL');

-- Указатели сайта ведут только на его версии; филиал сайта после создания не меняется; TrackedSite сайта принадлежит
-- объекту того же филиала (§29.2, BOOK-4 на уровне данных; MKT3 связь ещё не ставит, MKT7 берёт готовую колонку)
CREATE FUNCTION marketing_site_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN
  RAISE EXCEPTION 'marketing_sites: филиал сайта не меняется';
 END IF;
 IF NEW.tracked_site_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM tracked_sites t JOIN properties p ON p.id = t.property_id
    WHERE t.id = NEW.tracked_site_id AND p.location_id = NEW.location_id) THEN
  RAISE EXCEPTION 'marketing_sites: tracked_site_id принадлежит объекту другого филиала';
 END IF;
 IF NEW.latest_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.latest_version_id AND v.site_id = NEW.id) THEN
  RAISE EXCEPTION 'marketing_sites: latest_version_id указывает на версию другого сайта';
 END IF;
 IF NEW.published_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.published_version_id AND v.site_id = NEW.id) THEN
  RAISE EXCEPTION 'marketing_sites: published_version_id указывает на версию другого сайта';
 END IF;
 RETURN NEW;
END $$;

-- Первая версия: ревизия 1 без родителя; следующая: родитель того же сайта и ревизия родителя + 1
CREATE FUNCTION marketing_site_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_site uuid; parent_revision integer;
BEGIN
 IF NEW.parent_version_id IS NULL THEN
  IF NEW.revision <> 1 THEN
   RAISE EXCEPTION 'marketing_site_versions: версия без родителя только первая (revision 1)';
  END IF;
  RETURN NEW;
 END IF;
 SELECT v.site_id, v.revision INTO parent_site, parent_revision FROM marketing_site_versions v WHERE v.id = NEW.parent_version_id;
 IF parent_site IS NULL OR parent_site <> NEW.site_id THEN
  RAISE EXCEPTION 'marketing_site_versions: родитель принадлежит другому сайту';
 END IF;
 IF NEW.revision <> parent_revision + 1 THEN
  RAISE EXCEPTION 'marketing_site_versions: ревизия идёт следом за ревизией родителя';
 END IF;
 RETURN NEW;
END $$;

-- Версия неизменяема после вставки. Пропускается одно: удаление сотрудника обнуляет автора по FK ON DELETE SET NULL,
-- как у журнала (audit_logs_immutable); всё остальное, и UPDATE, и DELETE, запрещено без исключений. Очистка
-- черновиков (старше 90 дней, сохраняя 50 последних) появится отдельным срезом со своим путём.
CREATE FUNCTION marketing_site_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.created_by_id IS NULL AND OLD.created_by_id IS NOT NULL
    AND to_jsonb(NEW) - 'created_by_id' = to_jsonb(OLD) - 'created_by_id' THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'marketing_site_versions: версия неизменяема, % запрещён', TG_OP USING ERRCODE = 'raise_exception';
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.marketing_site_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.marketing_site_version_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.marketing_site_version_immutable() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER marketing_site_guard BEFORE INSERT OR UPDATE ON "marketing_sites"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_guard();
CREATE TRIGGER marketing_site_version_guard BEFORE INSERT ON "marketing_site_versions"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_version_guard();
CREATE TRIGGER marketing_site_version_immutable BEFORE UPDATE OR DELETE ON "marketing_site_versions"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_version_immutable();

-- Изоляция (DATA_MODEL §29.9, образец Food …058): сайт по цепочке Location → Business → организация, версия через сайт
ALTER TABLE "marketing_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_sites" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_site_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_site_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_sites" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "marketing_site_versions" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_sites s WHERE s.id = site_id));

-- Права ролей приложения: отдельной миграцией 061 (как Food 058 и 059), чтобы восстановление копии их повторило
