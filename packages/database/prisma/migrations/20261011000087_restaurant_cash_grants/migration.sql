-- Права кассы ресторана (DATA_MODEL §35.4), отдельно от создающей миграции (образец 59). Миграция 26 выдаёт
-- новым таблицам полный набор через ALTER DEFAULT PRIVILEGES, поэтому лишнее отзывается явно:
-- платёж и операция кассы не удаляются (только аннулируются), сверка только дописывается.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['restaurant_payments', 'restaurant_cash_operations'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO wetop_app, wetop_service', table_name);
    EXECUTE format('REVOKE DELETE, TRUNCATE ON %I FROM wetop_app, wetop_service', table_name);
  END LOOP;
  GRANT SELECT, INSERT ON restaurant_cash_reconciliations TO wetop_app, wetop_service;
  REVOKE UPDATE, DELETE, TRUNCATE ON restaurant_cash_reconciliations FROM wetop_app, wetop_service;
END $$;
