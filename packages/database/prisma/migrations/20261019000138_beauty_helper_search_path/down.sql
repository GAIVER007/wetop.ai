BEGIN;
SET LOCAL lock_timeout = '5s';

-- UP refuses any pre-existing function configuration. Restore exactly that canonical baseline.
DO $hardening$
DECLARE
  s text := current_schema();
  expected text := CASE WHEN current_schema() = 'public' THEN 'search_path=public, pg_temp' ELSE format('search_path=%I, public, pg_temp', current_schema()) END;
  helpers oid[];
BEGIN
  helpers := ARRAY[
    format('%I.beauty_location_hours_valid(jsonb)', s)::regprocedure::oid,
    format('%I.beauty_time_in_hours(timestamp with time zone,timestamp with time zone,text,jsonb)', s)::regprocedure::oid
  ];
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = ANY(helpers) AND proconfig IS DISTINCT FROM ARRAY[expected]) THEN
    RAISE EXCEPTION 'Beauty helper configuration changed after hardening; inspect before rollback';
  END IF;
  EXECUTE format('ALTER FUNCTION %I.beauty_location_hours_valid(jsonb) RESET search_path', s);
  EXECUTE format('ALTER FUNCTION %I.beauty_time_in_hours(timestamp with time zone,timestamp with time zone,text,jsonb) RESET search_path', s);
END
$hardening$;
COMMIT;
