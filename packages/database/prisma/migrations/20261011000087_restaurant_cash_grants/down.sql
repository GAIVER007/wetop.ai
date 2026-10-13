-- Возврат к правам по умолчанию миграции 26 (образец отката 82): состояние до 87 содержит полный GRANT
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['restaurant_payments', 'restaurant_cash_operations', 'restaurant_cash_reconciliations'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wetop_app, wetop_service', table_name);
  END LOOP;
END $$;
