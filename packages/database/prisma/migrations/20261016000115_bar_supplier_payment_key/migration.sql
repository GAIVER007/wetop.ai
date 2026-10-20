-- Ключ повтора оплаты поставщику (DATA_MODEL §50, v2.34, ADR-186 M6): повтор с тем же ключом у прихода
-- возвращает первую оплату. У прежних оплат ключа нет (NULL), уникальность NULL не ограничивает.
ALTER TABLE "bar_supplier_payments" ADD COLUMN "idempotency_key" VARCHAR(120);
ALTER TABLE "bar_supplier_payments" ADD CONSTRAINT "bar_supplier_payments_idempotency_key_check"
  CHECK ("idempotency_key" IS NULL OR length(btrim("idempotency_key")) > 0);
CREATE UNIQUE INDEX "bar_supplier_payments_receipt_id_idempotency_key_key"
  ON "bar_supplier_payments"("receipt_id", "idempotency_key");
