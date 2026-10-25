-- Откат 158: только пока «Другим» не пользовались. Значение перечисления PostgreSQL не удаляет: оно остаётся
-- неиспользуемым, CHECK возвращают набор миграции 151, и OTHER снова нельзя записать никуда.
BEGIN;
LOCK TABLE "restaurant_payments", "restaurant_cash_operations", "restaurant_cash_reconciliations",
  "branch_payment_method_settings", "payments", "cash_operations", "cash_reconciliations", "payment_method_settings"
  IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "restaurant_payments" WHERE "method"::text = 'OTHER')
     OR EXISTS (SELECT 1 FROM "restaurant_cash_operations" WHERE "method"::text = 'OTHER' OR "method_to"::text = 'OTHER')
     OR EXISTS (SELECT 1 FROM "restaurant_cash_reconciliations" WHERE "method"::text = 'OTHER') THEN
    RAISE EXCEPTION 'Payment method OTHER is in use: move or void those payments before rollback of 158';
  END IF;
END $$;
DELETE FROM "branch_payment_method_settings" WHERE "method"::text = 'OTHER';
ALTER TABLE "branch_payment_method_settings" DROP CONSTRAINT "branch_payment_method_settings_method_branch";
ALTER TABLE "branch_payment_method_settings" ADD CONSTRAINT "branch_payment_method_settings_method_branch" CHECK (
  "method" IN ('CASH','CARD_TERMINAL','KASPI','HALYK','BANK_TRANSFER_PERSON','BANK_TRANSFER_LEGAL')
);
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_method_not_other";
ALTER TABLE "cash_operations" DROP CONSTRAINT IF EXISTS "cash_operations_method_not_other";
ALTER TABLE "cash_reconciliations" DROP CONSTRAINT IF EXISTS "cash_reconciliations_method_not_other";
ALTER TABLE "payment_method_settings" DROP CONSTRAINT IF EXISTS "payment_method_settings_method_not_other";
COMMIT;
