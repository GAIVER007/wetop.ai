-- Replay only the ACL established by 128 after a --no-privileges backup restore.
-- Keep schema/RLS in 128 and leave transaction ownership to the migration/restore runner.
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_public_profiles, employee_media,
 employee_portfolio_items, beauty_payroll_policies TO wetop_app;
REVOKE ALL ON employee_public_profiles, employee_media, employee_portfolio_items,
 beauty_payroll_policies FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_public_employee(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_public_employee(text) TO wetop_app;
REVOKE ALL ON FUNCTION employee_portfolio_scope_guard() FROM PUBLIC;

-- Supabase roles are optional on local/KZ PostgreSQL, exactly as in 128. Never create them.
DO $migration$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=t) THEN
   EXECUTE format('REVOKE ALL ON employee_public_profiles,employee_media,employee_portfolio_items,beauty_payroll_policies FROM %I',t);
   EXECUTE format('REVOKE ALL ON FUNCTION resolve_public_employee(text) FROM %I',t);
  END IF;
 END LOOP;
END $migration$;
