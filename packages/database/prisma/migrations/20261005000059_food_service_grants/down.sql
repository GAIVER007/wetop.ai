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
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON %I FROM wetop_app, wetop_service',
      table_name
    );
  END LOOP;
END $$;
