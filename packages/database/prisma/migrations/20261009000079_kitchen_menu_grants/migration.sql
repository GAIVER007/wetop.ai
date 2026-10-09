-- Права вынесены из создающей миграции 78, чтобы production restore мог
-- повторить их без повторного CREATE TABLE (как 059 у Food v1).
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'menu_categories',
    'menu_items',
    'location_menu_items'
  ] LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wetop_app, wetop_service',
      table_name
    );
  END LOOP;
END $$;
