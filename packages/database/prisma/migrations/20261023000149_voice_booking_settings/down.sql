-- Откат 149: приложение снова только читает профиль голоса. Данные не затрагиваются.
BEGIN;
DROP POLICY rls_tenant_update ON "voice_profiles";
DROP POLICY rls_tenant_insert ON "voice_profiles";
REVOKE INSERT, UPDATE ON "voice_profiles" FROM wetop_app;
COMMIT;
