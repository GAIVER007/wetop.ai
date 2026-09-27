-- Откат 20260927000026_rls_roles: снять права этой схемы. Сами роли общие на кластер (их может использовать вторая
-- схема) — удаляются руками, когда ни одна схема их не держит: DROP OWNED BY wetop_app; DROP ROLE wetop_app; (то же для wetop_service).
DO $$
DECLARE s text := current_schema();
BEGIN
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM wetop_app, wetop_service', s);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM wetop_app, wetop_service', s);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM wetop_app, wetop_service', s);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM wetop_app, wetop_service', s);
  EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM wetop_app, wetop_service', s);
END $$;
