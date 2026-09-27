-- Откат 20260927000027_tenant_columns — к состоянию после 20260927000026_phase1_tenant_scope (колонки организации у
-- гостей и журнала остаются, как их завела phase1: без NOT NULL). Данные не теряются.
-- Порядок: сначала откатить 20260927000028_rls_policies (политики зовут функции ниже).
DROP TRIGGER IF EXISTS audit_logs_organization ON "audit_logs";
DROP FUNCTION IF EXISTS audit_logs_organization();
DROP FUNCTION IF EXISTS app_audit_organization(text, text, uuid);
DROP INDEX IF EXISTS "audit_logs_organization_id_created_at_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs" ("organization_id");
ALTER TABLE "guests" ALTER COLUMN "organization_id" DROP DEFAULT;
ALTER TABLE "guests" ALTER COLUMN "organization_id" DROP NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "organization_id" DROP NOT NULL;
DROP FUNCTION IF EXISTS app_current_org();
