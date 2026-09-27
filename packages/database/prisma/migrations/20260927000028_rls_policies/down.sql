-- Откат 20260927000028_rls_policies: снять политики и выключить RLS. Данные не меняются.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relrowsecurity LOOP
    EXECUTE format('DROP POLICY IF EXISTS rls_tenant ON %I', r.relname);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS app_property_visible(uuid);
