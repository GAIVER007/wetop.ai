-- MKT6 (ADR-149, DATA_MODEL §29.3, §29.7, Q-274 решён владельцем 07.10.2026): задача генерации сайта ИИ, она же
-- очередь в Postgres, и связь версии с задачей. Права ролей отдельной миграцией 063 (восстановление копии повторяет
-- только миграции прав). Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "GenerationRunType" AS ENUM ('INITIAL', 'SECTION', 'PATCH', 'SEO');

-- CreateEnum
CREATE TYPE "GenerationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "type" "GenerationRunType" NOT NULL,
    "status" "GenerationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "request_key" UUID NOT NULL,
    "requested_by_id" UUID,
    "base_version_id" UUID,
    "output_version_id" UUID,
    "brief_hash" CHAR(64),
    "instruction" VARCHAR(2000),
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

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "marketing_site_versions" ADD COLUMN "generation_run_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "generation_runs_output_version_id_key" ON "generation_runs"("output_version_id");

-- CreateIndex
CREATE INDEX "generation_runs_status_next_attempt_at_idx" ON "generation_runs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "generation_runs_requested_by_id_created_at_idx" ON "generation_runs"("requested_by_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "generation_runs_site_id_request_key_key" ON "generation_runs"("site_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_site_versions_generation_run_id_key" ON "marketing_site_versions"("generation_run_id");

-- AddForeignKey
ALTER TABLE "marketing_site_versions" ADD CONSTRAINT "marketing_site_versions_generation_run_id_fkey" FOREIGN KEY ("generation_run_id") REFERENCES "generation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "marketing_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_output_version_id_fkey" FOREIGN KEY ("output_version_id") REFERENCES "marketing_site_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Источник версии (снимает временный CHECK MKT3 «только MANUAL»): ручная версия без задачи, версия ИИ только с
-- задачей. IMPORT по-прежнему не проходит: путь импорта откроется своим срезом.
ALTER TABLE "marketing_site_versions" DROP CONSTRAINT "marketing_site_versions_source_manual";
ALTER TABLE "marketing_site_versions" ADD CONSTRAINT "marketing_site_versions_source_provenance" CHECK (
  ("source" = 'MANUAL' AND "generation_run_id" IS NULL) OR ("source" = 'AI' AND "generation_run_id" IS NOT NULL));

-- Форма задачи по состоянию (§29.8); токены целые и не меньше нуля, кэш входит во вход (Q-274); попыток не больше
-- трёх; словарь кодов ошибок; хэш брифа sha256 в нижнем регистре
ALTER TABLE "generation_runs"
  ADD CONSTRAINT "generation_runs_status_shape" CHECK (
    ("status" = 'QUEUED' AND "output_version_id" IS NULL AND "finished_at" IS NULL)
    OR ("status" = 'RUNNING' AND "started_at" IS NOT NULL AND "output_version_id" IS NULL AND "finished_at" IS NULL)
    OR ("status" = 'SUCCEEDED' AND "output_version_id" IS NOT NULL AND "finished_at" IS NOT NULL AND "error_code" IS NULL)
    OR ("status" = 'FAILED' AND "output_version_id" IS NULL AND "finished_at" IS NOT NULL AND "error_code" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "output_version_id" IS NULL AND "finished_at" IS NOT NULL)),
  ADD CONSTRAINT "generation_runs_tokens" CHECK (
    ("tokens_input" IS NULL OR "tokens_input" >= 0)
    AND ("tokens_output" IS NULL OR "tokens_output" >= 0)
    AND ("tokens_cached" IS NULL OR ("tokens_cached" >= 0 AND "tokens_input" IS NOT NULL AND "tokens_cached" <= "tokens_input"))),
  ADD CONSTRAINT "generation_runs_attempts" CHECK ("attempts" BETWEEN 0 AND 3),
  ADD CONSTRAINT "generation_runs_error_code" CHECK ("error_code" IS NULL OR "error_code" IN (
    'SCHEMA_INVALID', 'MODEL_UNAVAILABLE', 'BUDGET_EXCEEDED', 'TIMEOUT', 'REJECTED_CONTENT',
    'USAGE_UNAVAILABLE', 'BRIEF_CHANGED', 'BASE_VERSION_CHANGED', 'BUDGET_DAY_CHANGED')),
  ADD CONSTRAINT "generation_runs_brief_hash_format" CHECK ("brief_hash" IS NULL OR "brief_hash" ~ '^[0-9a-f]{64}$');

-- Задача: новая только в QUEUED; переходы §29.8; конечные состояния не меняются; сайт, вид, ключ, бриф, команда,
-- базовая версия, автор и первое начало не меняются; токены и попытки только растут; базовая и итоговая версии только
-- этого сайта, итоговая ещё и ссылается на эту задачу. Пропускается одно: удаление сотрудника обнуляет автора по
-- FK ON DELETE SET NULL, как у версий и журнала.
CREATE FUNCTION generation_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.status <> 'QUEUED' THEN
   RAISE EXCEPTION 'generation_runs: новая задача только в QUEUED';
  END IF;
 ELSE
  IF NEW.requested_by_id IS NULL AND OLD.requested_by_id IS NOT NULL
     AND to_jsonb(NEW) - 'requested_by_id' = to_jsonb(OLD) - 'requested_by_id' THEN
   RETURN NEW;
  END IF;
  IF OLD.status IN ('SUCCEEDED', 'FAILED', 'CANCELLED') THEN
   RAISE EXCEPTION 'generation_runs: задача в конечном состоянии % не меняется', OLD.status;
  END IF;
  IF NEW.site_id <> OLD.site_id OR NEW.type <> OLD.type OR NEW.request_key <> OLD.request_key
     OR NEW.brief_hash IS DISTINCT FROM OLD.brief_hash OR NEW.instruction IS DISTINCT FROM OLD.instruction
     OR NEW.base_version_id IS DISTINCT FROM OLD.base_version_id
     OR NEW.requested_by_id IS DISTINCT FROM OLD.requested_by_id
     OR NEW.created_at <> OLD.created_at
     OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
   RAISE EXCEPTION 'generation_runs: сайт, вид, ключ, бриф, команда, база, автор и первое начало задачи не меняется';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'QUEUED' AND NEW.status IN ('RUNNING', 'FAILED', 'CANCELLED'))
    OR (OLD.status = 'RUNNING' AND NEW.status IN ('QUEUED', 'SUCCEEDED', 'FAILED'))) THEN
   RAISE EXCEPTION 'generation_runs: переход % → % запрещён', OLD.status, NEW.status;
  END IF;
  IF (OLD.tokens_input IS NOT NULL AND (NEW.tokens_input IS NULL OR NEW.tokens_input < OLD.tokens_input))
     OR (OLD.tokens_output IS NOT NULL AND (NEW.tokens_output IS NULL OR NEW.tokens_output < OLD.tokens_output))
     OR (OLD.tokens_cached IS NOT NULL AND (NEW.tokens_cached IS NULL OR NEW.tokens_cached < OLD.tokens_cached)) THEN
   RAISE EXCEPTION 'generation_runs: расход токенов задачи только растёт';
  END IF;
  IF NEW.attempts < OLD.attempts THEN
   RAISE EXCEPTION 'generation_runs: число попыток только растёт';
  END IF;
 END IF;
 IF NEW.base_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.base_version_id AND v.site_id = NEW.site_id) THEN
  RAISE EXCEPTION 'generation_runs: base_version_id указывает на версию другого сайта';
 END IF;
 IF NEW.output_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v
    WHERE v.id = NEW.output_version_id AND v.site_id = NEW.site_id AND v.generation_run_id = NEW.id) THEN
  RAISE EXCEPTION 'generation_runs: output_version_id указывает на версию другого сайта или другой задачи';
 END IF;
 RETURN NEW;
END $$;

-- Версия ИИ только от задачи своего сайта (вторую версию той же задачи держит UNIQUE generation_run_id)
CREATE FUNCTION marketing_site_version_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.generation_run_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM generation_runs r WHERE r.id = NEW.generation_run_id AND r.site_id = NEW.site_id) THEN
  RAISE EXCEPTION 'marketing_site_versions: generation_run_id указывает на задачу другого сайта';
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.generation_run_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.marketing_site_version_run_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER generation_run_guard BEFORE INSERT OR UPDATE ON "generation_runs"
  FOR EACH ROW EXECUTE FUNCTION generation_run_guard();
CREATE TRIGGER marketing_site_version_run_guard BEFORE INSERT ON "marketing_site_versions"
  FOR EACH ROW EXECUTE FUNCTION marketing_site_version_run_guard();

-- Изоляция (§29.9): задача через свой сайт, сайт через Location → Business → организация
ALTER TABLE "generation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "generation_runs" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_sites s WHERE s.id = site_id));

-- Права ролей приложения: отдельной миграцией 063, как MKT3 061
