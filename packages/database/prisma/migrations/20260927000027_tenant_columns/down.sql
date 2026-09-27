-- Откат 20260927000027_tenant_columns. Данные гостей и журнала не теряются: снимаются только новые колонки.
-- Порядок: сначала откатить 20260927000028_rls_policies (политики ссылаются на эти колонки).
DROP TRIGGER IF EXISTS audit_logs_organization ON "audit_logs";
DROP FUNCTION IF EXISTS audit_logs_organization();
SELECT set_config('wetop.audit_purge', 'on', false);
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_organization_id_fkey";
DROP INDEX IF EXISTS "audit_logs_organization_id_created_at_idx";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "organization_id";
SELECT set_config('wetop.audit_purge', '', false);
DROP FUNCTION IF EXISTS app_audit_organization(text, text, uuid);
ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_organization_id_fkey";
DROP INDEX IF EXISTS "guests_organization_id_idx";
ALTER TABLE "guests" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "properties" ALTER COLUMN "organization_id" DROP NOT NULL;
DROP FUNCTION IF EXISTS app_current_org();
