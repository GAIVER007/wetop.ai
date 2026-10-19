BEGIN;
SET LOCAL lock_timeout = '5s';

-- Hardening follow-up only: preserve all released/prepared UP bytes and function bodies.
-- Source preparation does not authorize production application.
DO $hardening$
DECLARE
  s text := current_schema();
  path text;
  helpers oid[];
BEGIN
  helpers := ARRAY[
    format('%I.beauty_location_hours_valid(jsonb)', s)::regprocedure::oid,
    format('%I.beauty_time_in_hours(timestamp with time zone,timestamp with time zone,text,jsonb)', s)::regprocedure::oid
  ];
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = ANY(helpers) AND proconfig IS NOT NULL) THEN
    RAISE EXCEPTION 'Unexpected existing Beauty helper configuration; inspect before hardening';
  END IF;
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_location_hours_valid(jsonb) SET search_path = %s', s, path);
  EXECUTE format('ALTER FUNCTION %I.beauty_time_in_hours(timestamp with time zone,timestamp with time zone,text,jsonb) SET search_path = %s', s, path);
END
$hardening$;
COMMIT;
