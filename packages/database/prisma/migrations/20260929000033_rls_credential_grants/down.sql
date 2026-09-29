-- Откат 20260929000033_rls_credential_grants: вернуть `wetop_app` полный доступ к семи таблицам, как выдала `…026_rls_roles`.
-- Данные и политики не меняются. После отката код API продолжает работать: он от этих прав не зависит.
-- Права обеих ролей снимаются и выдаются заново в порядке `…026` (`wetop_app`, затем `wetop_service`): иначе список прав
-- таблицы после отката отличается от прежнего порядком записей, и сверка `check-migrations.sh` снимок в снимок краснеет.
DO $$
DECLARE s text := current_schema();
BEGIN
  EXECUTE format(
    'REVOKE ALL ON TABLE %1$I.users, %1$I.platform_admins, %1$I.password_resets, %1$I.email_verifications, %1$I.wizard_sessions, %1$I.wizard_events, %1$I.wizard_surveys FROM wetop_app, wetop_service',
    s
  );
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %1$I.users, %1$I.platform_admins, %1$I.password_resets, %1$I.email_verifications, %1$I.wizard_sessions, %1$I.wizard_events, %1$I.wizard_surveys TO wetop_app, wetop_service',
    s
  );
END $$;
