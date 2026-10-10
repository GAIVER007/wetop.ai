-- Права вынесены отдельно (образец миграции 59). У employee_pay_adjustments
-- журнал только дописывается: без UPDATE и DELETE (DATA_MODEL §33.4).
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'menu_categories',
    'menu_items',
    'menu_item_ingredients',
    'restaurant_orders',
    'restaurant_order_items',
    'employee_pay_settings'
  ] LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wetop_app, wetop_service',
      table_name
    );
  END LOOP;
  GRANT SELECT, INSERT ON employee_pay_adjustments TO wetop_app, wetop_service;
END $$;
