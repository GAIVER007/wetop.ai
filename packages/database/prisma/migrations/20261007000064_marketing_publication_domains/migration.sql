-- MKT7 (ADR-149, DATA_MODEL §29.4, §29.6, §29.11; Q-271 и Q-275 решены владельцем 07.10.2026): журнал публикаций
-- управляемого сайта, домены сайта и канонический сайт брони филиала. Права ролей отдельной миграцией 065 (как 061 и
-- 063): восстановление копии повторяет только миграции прав. Откат: down.sql. На рабочей базе применяет владелец.

-- CreateEnum
CREATE TYPE "SitePublicationAction" AS ENUM ('PUBLISH', 'ROLLBACK', 'PAUSE', 'RESUME', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "SiteDomainKind" AS ENUM ('PLATFORM_SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SiteDomainStatus" AS ENUM ('PENDING', 'VERIFYING', 'VERIFIED', 'ACTIVE', 'FAILED', 'REMOVED');

-- CreateEnum
CREATE TYPE "SiteDomainVerificationMethod" AS ENUM ('DNS_TXT', 'HTTP_FILE');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN "booking_tracked_site_id" UUID;

-- CreateTable
CREATE TABLE "marketing_site_publications" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "action" "SitePublicationAction" NOT NULL,
    "version_id" UUID,
    "previous_version_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_site_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_domains" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "host" VARCHAR(253) NOT NULL,
    "kind" "SiteDomainKind" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "SiteDomainStatus" NOT NULL DEFAULT 'PENDING',
    "verification_method" "SiteDomainVerificationMethod",
    "verification_token" VARCHAR(64),
    "verified_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "last_check_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(40),
    "provider_ref" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_booking_tracked_site_id_idx" ON "locations"("booking_tracked_site_id");

-- CreateIndex
CREATE INDEX "marketing_site_publications_site_id_created_at_idx" ON "marketing_site_publications"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "site_domains_site_id_idx" ON "site_domains"("site_id");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_booking_tracked_site_id_fkey" FOREIGN KEY ("booking_tracked_site_id") REFERENCES "tracked_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_publications" ADD CONSTRAINT "marketing_site_publications_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "marketing_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_publications" ADD CONSTRAINT "marketing_site_publications_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_publications" ADD CONSTRAINT "marketing_site_publications_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_publications" ADD CONSTRAINT "marketing_site_publications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "marketing_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Журнал публикаций (§29.4): у публикации, отката и возобновления версия есть, у паузы и архива её нет
ALTER TABLE "marketing_site_publications"
  ADD CONSTRAINT "marketing_site_publications_shape" CHECK (
    ("action" IN ('PUBLISH', 'ROLLBACK', 'RESUME')) = ("version_id" IS NOT NULL));

-- Домен (§29.6): хост в одном виде (нижний регистр, без схемы, порта и точки в конце, IDN уже в punycode, до 253
-- знаков); у платформенного поддомена нет проверки владения; даты переходов совпадают с состоянием
ALTER TABLE "site_domains"
  ADD CONSTRAINT "site_domains_host_format" CHECK (
    length("host") <= 253
    AND "host" ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'),
  ADD CONSTRAINT "site_domains_platform_unverified" CHECK (
    "kind" <> 'PLATFORM_SUBDOMAIN'
    OR ("verification_method" IS NULL AND "verification_token" IS NULL AND "verified_at" IS NULL)),
  ADD CONSTRAINT "site_domains_activated_at" CHECK ("status" <> 'ACTIVE' OR "activated_at" IS NOT NULL),
  ADD CONSTRAINT "site_domains_removed_at" CHECK (("status" = 'REMOVED') = ("removed_at" IS NOT NULL));

-- Один живой владелец хоста (REMOVED и FAILED хост освобождают); не больше одного основного домена у сайта
CREATE UNIQUE INDEX "site_domains_host_live_key" ON "site_domains"("host") WHERE "status" NOT IN ('REMOVED', 'FAILED');
CREATE UNIQUE INDEX "site_domains_primary_key" ON "site_domains"("site_id") WHERE "is_primary" AND "status" <> 'REMOVED';

-- Журнал: версия и прежняя версия только этого сайта
CREATE FUNCTION marketing_site_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.version_id AND v.site_id = NEW.site_id) THEN
  RAISE EXCEPTION 'marketing_site_publications: версия другого сайта';
 END IF;
 IF NEW.previous_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.previous_version_id AND v.site_id = NEW.site_id) THEN
  RAISE EXCEPTION 'marketing_site_publications: прежняя версия другого сайта';
 END IF;
 RETURN NEW;
END $$;

-- Журнал только дописывается. Пропускается одно: удаление сотрудника обнуляет автора по FK ON DELETE SET NULL, как у
-- версий и audit_logs; остальные UPDATE и DELETE запрещены без исключений
CREATE FUNCTION marketing_site_publication_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL AND OLD.actor_id IS NOT NULL
    AND to_jsonb(NEW) - 'actor_id' = to_jsonb(OLD) - 'actor_id' THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'marketing_site_publications: журнал только дописывается, % запрещён', TG_OP USING ERRCODE = 'raise_exception';
END $$;

-- Домен: вставка только PENDING; сайт, хост и вид не меняются; переходы по §29.8, REMOVED конечное. Платформенный
-- поддомен проверки владения не проходит: только PENDING → ACTIVE и снятие
CREATE FUNCTION site_domain_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ok boolean;
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.status <> 'PENDING' THEN
   RAISE EXCEPTION 'site_domains: новый домен только PENDING';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.site_id <> OLD.site_id OR NEW.host <> OLD.host OR NEW.kind <> OLD.kind THEN
  RAISE EXCEPTION 'site_domains: сайт, хост и вид домена не меняются';
 END IF;
 IF NEW.status = OLD.status THEN
  RETURN NEW;
 END IF;
 IF OLD.kind = 'PLATFORM_SUBDOMAIN' THEN
  ok := (OLD.status, NEW.status) IN (('PENDING', 'ACTIVE'), ('PENDING', 'REMOVED'), ('ACTIVE', 'REMOVED'));
 ELSE
  ok := (OLD.status, NEW.status) IN (
    ('PENDING', 'VERIFYING'), ('PENDING', 'REMOVED'), ('VERIFYING', 'VERIFIED'), ('VERIFYING', 'FAILED'),
    ('VERIFIED', 'ACTIVE'), ('VERIFIED', 'REMOVED'), ('FAILED', 'REMOVED'), ('ACTIVE', 'REMOVED'));
 END IF;
 IF NOT ok THEN
  RAISE EXCEPTION 'site_domains: переход % → % запрещён', OLD.status, NEW.status;
 END IF;
 RETURN NEW;
END $$;

-- Канонический сайт брони филиала (Q-275): только сайт объекта этого же филиала
CREATE FUNCTION location_booking_site_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.booking_tracked_site_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM tracked_sites t JOIN properties p ON p.id = t.property_id
    WHERE t.id = NEW.booking_tracked_site_id AND p.location_id = NEW.id) THEN
  RAISE EXCEPTION 'locations: сайт брони принадлежит объекту другого филиала';
 END IF;
 RETURN NEW;
END $$;

-- Перенос Q-275: филиалу гостиницы без выбранного сайта брони ставится его единственный подходящий сайт (ACTIVE, бронь
-- включена, тариф задан). Ноль или несколько подходящих оставляют NULL: «самый ранний» не выбирается. Выбранный
-- указатель не трогается. Отдаёт число поставленных указателей
CREATE FUNCTION location_booking_backfill() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 WITH eligible AS (
   SELECT p.location_id, min(t.id::text)::uuid AS site_id, count(*) AS sites
     FROM tracked_sites t JOIN properties p ON p.id = t.property_id
    WHERE t.status = 'ACTIVE' AND t.booking_enabled AND t.booking_rate_plan_id IS NOT NULL
    GROUP BY p.location_id)
 UPDATE locations l SET booking_tracked_site_id = e.site_id
   FROM eligible e, businesses b
  WHERE e.location_id = l.id AND e.sites = 1 AND l.booking_tracked_site_id IS NULL
    AND b.id = l.business_id AND b.vertical = 'HOSPITALITY';
 GET DIAGNOSTICS n = ROW_COUNT;
 RETURN n;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.marketing_site_publication_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.marketing_site_publication_immutable() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.site_domain_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.location_booking_site_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.location_booking_backfill() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER marketing_site_publication_guard BEFORE INSERT ON "marketing_site_publications"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_publication_guard();
CREATE TRIGGER marketing_site_publication_immutable BEFORE UPDATE OR DELETE ON "marketing_site_publications"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_publication_immutable();
CREATE TRIGGER site_domain_guard BEFORE INSERT OR UPDATE ON "site_domains"
  FOR EACH ROW EXECUTE FUNCTION site_domain_guard();
CREATE TRIGGER location_booking_site_guard BEFORE INSERT OR UPDATE OF booking_tracked_site_id ON "locations"
  FOR EACH ROW EXECUTE FUNCTION location_booking_site_guard();

SELECT location_booking_backfill();

-- Изоляция (§29.9): обе таблицы через свой сайт, политика сайта уже режет чужие организации
ALTER TABLE "marketing_site_publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_site_publications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "site_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_domains" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_site_publications" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_sites s WHERE s.id = site_id));
CREATE POLICY rls_tenant ON "site_domains" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_sites s WHERE s.id = site_id));

-- Права ролей приложения: отдельной миграцией 065, чтобы восстановление копии их повторило
