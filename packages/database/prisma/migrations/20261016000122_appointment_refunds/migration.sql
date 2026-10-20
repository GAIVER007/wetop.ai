-- Возврат по выполненной записи салона (DATA_MODEL §54, v2.37, Q-BEAUTY-PAY-1): ссылка на запись и у расхода
ALTER TABLE "restaurant_cash_operations" DROP CONSTRAINT "restaurant_cash_operations_appointment";
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_appointment"
  CHECK (appointment_id IS NULL OR (kind IN ('INCOME', 'EXPENSE') AND employee_id IS NULL AND period IS NULL));
