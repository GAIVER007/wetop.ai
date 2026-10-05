-- Права вынесены из создающей миграции 58, чтобы production restore мог
-- повторить их без повторного CREATE TYPE и CREATE TABLE.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'dining_areas',
    'dining_tables',
    'service_periods',
    'restaurant_reservations',
    'table_assignments'
  ] LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wetop_app, wetop_service',
      table_name
    );
  END LOOP;
END $$;
