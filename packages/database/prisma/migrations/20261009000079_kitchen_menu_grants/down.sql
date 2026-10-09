DO $$
DECLARE
  table_name text;
BEGIN
  -- Миграция 26 выдаёт эти права новым таблицам через ALTER DEFAULT PRIVILEGES.
  -- Поэтому состояние до миграции 79 уже содержит GRANT, откат должен его сохранить.
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
