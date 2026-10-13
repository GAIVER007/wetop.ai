-- Откат кассы ресторана (DATA_MODEL §35): таблицы пустые или данные владелец снял сам
DROP TABLE IF EXISTS "restaurant_cash_reconciliations";
DROP TABLE IF EXISTS "restaurant_cash_operations";
DROP TABLE IF EXISTS "restaurant_payments";
DROP FUNCTION IF EXISTS restaurant_cash_guard();
