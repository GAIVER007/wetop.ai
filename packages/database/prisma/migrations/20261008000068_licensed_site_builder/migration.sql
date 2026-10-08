-- MKT9.2 (ТЗ владельца 08.10.2026, DATA_MODEL §29.10–§29.13): лицензированный конструктор сайта. Проект конструктора
-- это филиал: один филиал, один сайт навсегда; лицензия на филиал (выдаёт только главный администратор платформы);
-- разговорные задачи ИИ (Чат, План, Оформление) без версий; закладки версий; знания проекта. Права ролей отдельной
-- миграцией 069 (восстановление копии повторяет только миграции прав). Откат: down.sql. На рабочей базе применяет
-- владелец (AGENTS.md §15).

-- Предпроверка: у филиала больше одного сайта (архивные тоже считаются). Миграция не выбирает, какой оставить, и
-- ничего не чинит сама: останавливается и называет филиалы
DO $$
DECLARE dup text;
BEGIN
 SELECT string_agg(location_id::text || ' (' || n || ')', ', ') INTO dup
   FROM (SELECT location_id, count(*) AS n FROM marketing_sites GROUP BY location_id HAVING count(*) > 1) d;
 IF dup IS NOT NULL THEN
  RAISE EXCEPTION 'MKT9.2: у филиалов больше одного сайта, один филиал это один сайт: %. Решите вручную, какой сайт оставить', dup;
 END IF;
END $$;

-- CreateEnum
CREATE TYPE "SiteAiRunMode" AS ENUM ('CHAT', 'PLAN', 'DESIGN');

-- CreateEnum
CREATE TYPE "SiteAiRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "marketing_sites" ADD COLUMN     "builder_instructions" VARCHAR(5000);

-- CreateTable
CREATE TABLE "site_builder_entitlements" (
    "location_id" UUID NOT NULL,
    "status" "ExtensionStatus" NOT NULL,
    "active_until" TIMESTAMPTZ(6),
    "note" VARCHAR(300),
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_builder_entitlements_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "site_ai_runs" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "mode" "SiteAiRunMode" NOT NULL,
    "status" "SiteAiRunStatus" NOT NULL DEFAULT 'QUEUED',
    "request_key" UUID NOT NULL,
    "requested_by_id" UUID,
    "base_version_id" UUID,
    "brief_hash" CHAR(64),
    "user_text" VARCHAR(4000) NOT NULL,
    "assistant_text" VARCHAR(12000),
    "payload" JSONB,
    "model" VARCHAR(100),
    "tokens_input" INTEGER,
    "tokens_output" INTEGER,
    "tokens_cached" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6),
    "error_code" VARCHAR(40),
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "site_ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_site_version_bookmarks" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_site_version_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_ai_runs_status_next_attempt_at_idx" ON "site_ai_runs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "site_ai_runs_requested_by_id_created_at_idx" ON "site_ai_runs"("requested_by_id", "created_at");

-- CreateIndex
CREATE INDEX "site_ai_runs_site_id_created_at_idx" ON "site_ai_runs"("site_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "site_ai_runs_site_id_request_key_key" ON "site_ai_runs"("site_id", "request_key");

-- CreateIndex
CREATE INDEX "marketing_site_version_bookmarks_version_id_idx" ON "marketing_site_version_bookmarks"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_site_version_bookmarks_site_id_version_id_key" ON "marketing_site_version_bookmarks"("site_id", "version_id");

-- AddForeignKey
ALTER TABLE "site_builder_entitlements" ADD CONSTRAINT "site_builder_entitlements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_builder_entitlements" ADD CONSTRAINT "site_builder_entitlements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_ai_runs" ADD CONSTRAINT "site_ai_runs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "marketing_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_ai_runs" ADD CONSTRAINT "site_ai_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_ai_runs" ADD CONSTRAINT "site_ai_runs_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_version_bookmarks" ADD CONSTRAINT "marketing_site_version_bookmarks_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "marketing_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_version_bookmarks" ADD CONSTRAINT "marketing_site_version_bookmarks_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_site_version_bookmarks" ADD CONSTRAINT "marketing_site_version_bookmarks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Один филиал, один сайт навсегда: полный UNIQUE без WHERE вместо частичного «один неархивный» (…060); архив
-- филиал не освобождает. Простой индекс location_id больше не нужен
DROP INDEX "marketing_sites_location_id_idx";
DROP INDEX "marketing_sites_location_active_key";
CREATE UNIQUE INDEX "marketing_sites_location_id_key" ON "marketing_sites"("location_id");

-- Лицензия: у пробной срок обязателен, как у расширений организации (§16.3)
ALTER TABLE "site_builder_entitlements"
  ADD CONSTRAINT "site_builder_entitlements_trial_until" CHECK ("status" <> 'TRIAL' OR "active_until" IS NOT NULL);

-- Разговорная задача: форма состояния, токены, попытки, словарь ошибок (тот же, что у сборки, плюс лицензия), хэш
-- брифа, размер структуры ответа
ALTER TABLE "site_ai_runs"
  ADD CONSTRAINT "site_ai_runs_status_shape" CHECK (
    ("status" = 'QUEUED' AND "finished_at" IS NULL)
    OR ("status" = 'RUNNING' AND "started_at" IS NOT NULL AND "finished_at" IS NULL)
    OR ("status" = 'SUCCEEDED' AND "finished_at" IS NOT NULL AND "error_code" IS NULL
        AND ("assistant_text" IS NOT NULL OR "payload" IS NOT NULL))
    OR ("status" = 'FAILED' AND "finished_at" IS NOT NULL AND "error_code" IS NOT NULL)),
  ADD CONSTRAINT "site_ai_runs_tokens" CHECK (
    ("tokens_input" IS NULL OR "tokens_input" >= 0)
    AND ("tokens_output" IS NULL OR "tokens_output" >= 0)
    AND ("tokens_cached" IS NULL OR ("tokens_cached" >= 0 AND "tokens_input" IS NOT NULL AND "tokens_cached" <= "tokens_input"))),
  ADD CONSTRAINT "site_ai_runs_attempts" CHECK ("attempts" BETWEEN 0 AND 3),
  ADD CONSTRAINT "site_ai_runs_error_code" CHECK ("error_code" IS NULL OR "error_code" IN (
    'SCHEMA_INVALID', 'MODEL_UNAVAILABLE', 'BUDGET_EXCEEDED', 'TIMEOUT', 'REJECTED_CONTENT',
    'USAGE_UNAVAILABLE', 'BRIEF_CHANGED', 'BASE_VERSION_CHANGED', 'BUDGET_DAY_CHANGED', 'LICENSE_UNAVAILABLE')),
  ADD CONSTRAINT "site_ai_runs_brief_hash_format" CHECK ("brief_hash" IS NULL OR "brief_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "site_ai_runs_user_text_present" CHECK (length(btrim("user_text")) > 0),
  ADD CONSTRAINT "site_ai_runs_payload_size" CHECK ("payload" IS NULL OR octet_length("payload"::text) <= 32768);

-- Задача сборки: лицензия кончилась до платного вызова (не повторяется)
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_error_code";
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_error_code" CHECK ("error_code" IS NULL OR "error_code" IN (
    'SCHEMA_INVALID', 'MODEL_UNAVAILABLE', 'BUDGET_EXCEEDED', 'TIMEOUT', 'REJECTED_CONTENT',
    'USAGE_UNAVAILABLE', 'BRIEF_CHANGED', 'BASE_VERSION_CHANGED', 'BUDGET_DAY_CHANGED', 'LICENSE_UNAVAILABLE'));

-- Закладка: подпись не пустая
ALTER TABLE "marketing_site_version_bookmarks"
  ADD CONSTRAINT "marketing_site_version_bookmarks_label_present" CHECK (length(btrim("label")) > 0);

-- Лицензия только у гостиничного филиала: конструктор v0 есть только у Hospitality
CREATE FUNCTION site_builder_entitlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.location_id IS DISTINCT FROM OLD.location_id AND TG_OP = 'UPDATE' THEN
  RAISE EXCEPTION 'site_builder_entitlements: филиал лицензии не меняется';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
    WHERE l.id = NEW.location_id AND b.vertical = 'HOSPITALITY') THEN
  RAISE EXCEPTION 'site_builder_entitlements: конструктор сайта только у гостиничного филиала';
 END IF;
 RETURN NEW;
END $$;

-- Разговорная задача: новая только в QUEUED; переходы QUEUED → RUNNING | FAILED, RUNNING → QUEUED | SUCCEEDED |
-- FAILED; конечное состояние не меняется; сайт, режим, ключ, запрос человека, база, бриф, автор и первое начало не
-- меняются; токены и попытки только растут; база только своего сайта. Удаление сотрудника обнуляет автора (FK)
CREATE FUNCTION site_ai_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.status <> 'QUEUED' THEN
   RAISE EXCEPTION 'site_ai_runs: новая задача только в QUEUED';
  END IF;
 ELSE
  IF NEW.requested_by_id IS NULL AND OLD.requested_by_id IS NOT NULL
     AND to_jsonb(NEW) - 'requested_by_id' = to_jsonb(OLD) - 'requested_by_id' THEN
   RETURN NEW;
  END IF;
  IF OLD.status IN ('SUCCEEDED', 'FAILED') THEN
   RAISE EXCEPTION 'site_ai_runs: задача в конечном состоянии % не меняется', OLD.status;
  END IF;
  IF NEW.site_id <> OLD.site_id OR NEW.mode <> OLD.mode OR NEW.request_key <> OLD.request_key
     OR NEW.user_text <> OLD.user_text OR NEW.brief_hash IS DISTINCT FROM OLD.brief_hash
     OR NEW.base_version_id IS DISTINCT FROM OLD.base_version_id
     OR NEW.requested_by_id IS DISTINCT FROM OLD.requested_by_id
     OR NEW.created_at <> OLD.created_at
     OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
   RAISE EXCEPTION 'site_ai_runs: сайт, режим, ключ, запрос, база, бриф, автор и первое начало задачи не меняется';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'QUEUED' AND NEW.status IN ('RUNNING', 'FAILED'))
    OR (OLD.status = 'RUNNING' AND NEW.status IN ('QUEUED', 'SUCCEEDED', 'FAILED'))) THEN
   RAISE EXCEPTION 'site_ai_runs: переход % → % запрещён', OLD.status, NEW.status;
  END IF;
  IF (OLD.tokens_input IS NOT NULL AND (NEW.tokens_input IS NULL OR NEW.tokens_input < OLD.tokens_input))
     OR (OLD.tokens_output IS NOT NULL AND (NEW.tokens_output IS NULL OR NEW.tokens_output < OLD.tokens_output))
     OR (OLD.tokens_cached IS NOT NULL AND (NEW.tokens_cached IS NULL OR NEW.tokens_cached < OLD.tokens_cached)) THEN
   RAISE EXCEPTION 'site_ai_runs: расход токенов задачи только растёт';
  END IF;
  IF NEW.attempts < OLD.attempts THEN
   RAISE EXCEPTION 'site_ai_runs: число попыток только растёт';
  END IF;
 END IF;
 IF NEW.base_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.base_version_id AND v.site_id = NEW.site_id) THEN
  RAISE EXCEPTION 'site_ai_runs: base_version_id указывает на версию другого сайта';
 END IF;
 RETURN NEW;
END $$;

-- Закладка: версия этого сайта; сайт и версия не меняются; не больше 20 закладок на сайт (замок по сайту, чтобы две
-- вкладки не поставили 21-ю одновременно)
CREATE FUNCTION marketing_site_bookmark_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.site_id <> OLD.site_id OR NEW.version_id <> OLD.version_id) THEN
  RAISE EXCEPTION 'marketing_site_version_bookmarks: сайт и версия закладки не меняются';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.version_id AND v.site_id = NEW.site_id) THEN
  RAISE EXCEPTION 'marketing_site_version_bookmarks: версия другого сайта';
 END IF;
 IF TG_OP = 'INSERT' THEN
  PERFORM pg_advisory_xact_lock(hashtext('marketing_site_bookmarks:' || NEW.site_id::text));
  IF (SELECT count(*) FROM marketing_site_version_bookmarks b WHERE b.site_id = NEW.site_id) >= 20 THEN
   RAISE EXCEPTION 'marketing_site_version_bookmarks: не больше 20 закладок на сайт';
  END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.site_builder_entitlement_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.site_ai_run_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.marketing_site_bookmark_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER site_builder_entitlement_guard BEFORE INSERT OR UPDATE ON "site_builder_entitlements"
  FOR EACH ROW EXECUTE FUNCTION site_builder_entitlement_guard();
CREATE TRIGGER site_ai_run_guard BEFORE INSERT OR UPDATE ON "site_ai_runs"
  FOR EACH ROW EXECUTE FUNCTION site_ai_run_guard();
CREATE TRIGGER marketing_site_bookmark_guard BEFORE INSERT OR UPDATE ON "marketing_site_version_bookmarks"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_bookmark_guard();

-- Прежняя работа не обрывается: филиалы, у которых сайт уже есть, получают ACTIVE без срока. Новые филиалы лицензию
-- получают только от главного администратора
INSERT INTO "site_builder_entitlements" ("location_id", "status", "active_until", "note", "updated_at")
SELECT DISTINCT s.location_id, 'ACTIVE'::"ExtensionStatus", NULL::timestamptz, 'MKT9.2: сайт был до лицензий', now()
  FROM marketing_sites s
  JOIN locations l ON l.id = s.location_id
  JOIN businesses b ON b.id = l.business_id
 WHERE b.vertical = 'HOSPITALITY';

-- Изоляция (§29.9): лицензия через филиал → бизнес → организация; разговор и закладки через свой сайт
ALTER TABLE "site_builder_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_builder_entitlements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "site_ai_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_ai_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_site_version_bookmarks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_site_version_bookmarks" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "site_builder_entitlements" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "site_ai_runs" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_sites s WHERE s.id = site_id));
CREATE POLICY rls_tenant ON "marketing_site_version_bookmarks" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_sites s WHERE s.id = site_id));

-- Права ролей приложения: отдельной миграцией 069
