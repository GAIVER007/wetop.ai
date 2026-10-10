DO $$
DECLARE
  table_name text;
BEGIN
  -- Миграция 26 выдаёт эти права новым таблицам через ALTER DEFAULT PRIVILEGES (образец отката миграции 59):
  -- состояние до миграции 82 уже содержит полный GRANT, откат должен его сохранить, а не снять
  FOREACH table_name IN ARRAY ARRAY[
    'menu_categories',
    'menu_items',
    'menu_item_ingredients',
    'restaurant_orders',
    'restaurant_order_items',
    'employee_pay_settings',
    'employee_pay_adjustments'
  ] LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wetop_app, wetop_service',
      table_name
    );
  END LOOP;
END $$;
