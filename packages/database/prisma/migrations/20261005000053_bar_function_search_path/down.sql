-- Restore the pre-repair function setting. This reintroduces the mutable path.
-- Use only as an explicitly approved rollback, not as a security mitigation.
DO $$
DECLARE
  s text := current_schema();
BEGIN
  EXECUTE format('ALTER FUNCTION %I.bar_property_guard() RESET search_path', s);
END $$;
