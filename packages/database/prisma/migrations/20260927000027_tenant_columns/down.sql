-- Откат 20260927000027_tenant_columns. Колонки guests/audit_logs.organization_id НЕ снимаются: их завела
-- миграция 20260927000026_phase1_tenant_scope (ADR-100 §17.2), и после отката этой миграции они остаются
-- в её виде (nullable, FK NO ACTION). Снимается только добавленное здесь: NOT NULL и DEFAULT у гостя,
-- NOT NULL у объекта, триггер и функции журнала, составной индекс, определения FK ADR-103.
-- Порядок: сначала откатить 20260927000028_rls_policies (политики ссылаются на эти колонки и функции).
DROP TRIGGER IF EXISTS audit_logs_organization ON "audit_logs";
DROP FUNCTION IF EXISTS audit_logs_organization();
DROP FUNCTION IF EXISTS app_audit_organization(text, text, uuid);

DROP INDEX IF EXISTS "audit_logs_organization_id_created_at_idx";
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_organization_id_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "guests" ALTER COLUMN "organization_id" DROP DEFAULT;
ALTER TABLE "guests" ALTER COLUMN "organization_id" DROP NOT NULL;
ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_organization_id_fkey";
ALTER TABLE "guests"
  ADD CONSTRAINT "guests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "properties" ALTER COLUMN "organization_id" DROP NOT NULL;
DROP FUNCTION IF EXISTS app_current_org();
