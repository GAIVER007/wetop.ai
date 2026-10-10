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
    'employee_pay_settings',
    'employee_pay_adjustments'
  ] LOOP
    EXECUTE format(
      'REVOKE ALL ON %I FROM wetop_app, wetop_service',
      table_name
    );
  END LOOP;
END $$;
