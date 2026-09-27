-- Откат 20260927000027_tenant_columns — к состоянию после 20260927000026_phase1_tenant_scope (колонки организации у
-- гостей и журнала остаются, как их завела phase1: без NOT NULL, FK NO ACTION). Данные не теряются.
-- Порядок: сначала откатить 20260927000028_rls_policies (политики зовут функции ниже).
-- 27.09.2026: возврат FK к определениям phase1 перенесён из ветки claude/hopeful-thompson-2v8v8a — без него
-- check-migrations.sh ловил расхождение схемы после отката (FK оставались ON DELETE RESTRICT ON UPDATE CASCADE).
DROP TRIGGER IF EXISTS audit_logs_organization ON "audit_logs";
DROP FUNCTION IF EXISTS audit_logs_organization();
DROP FUNCTION IF EXISTS app_audit_organization(text, text, uuid);
DROP INDEX IF EXISTS "audit_logs_organization_id_created_at_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs" ("organization_id");

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
