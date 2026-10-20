-- Откат §54: отказ, если возвраты по записям уже есть (без 122 им нет места)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM restaurant_cash_operations WHERE appointment_id IS NOT NULL AND kind <> 'INCOME') THEN
    RAISE EXCEPTION 'Appointment refunds exist: rollback of 122 would lose them';
  END IF;
END $$;
ALTER TABLE "restaurant_cash_operations" DROP CONSTRAINT "restaurant_cash_operations_appointment";
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_appointment"
  CHECK (appointment_id IS NULL OR (kind = 'INCOME' AND employee_id IS NULL));
