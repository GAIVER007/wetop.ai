-- Откат §50: ключи повтора теряются, сами оплаты остаются
DROP INDEX IF EXISTS "bar_supplier_payments_receipt_id_idempotency_key_key";
ALTER TABLE "bar_supplier_payments" DROP CONSTRAINT IF EXISTS "bar_supplier_payments_idempotency_key_check";
ALTER TABLE "bar_supplier_payments" DROP COLUMN IF EXISTS "idempotency_key";
