-- Forward repair of bar_property_guard; migration 51 remains immutable.
-- Match migration 43: the owning schema first, public next, pg_temp last.
DO $$
DECLARE
  s text := current_schema();
  path text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.bar_property_guard() SET search_path = %s', s, path);
END $$;
