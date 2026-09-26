DROP TRIGGER IF EXISTS audit_logs_immutable ON "audit_logs";
DROP FUNCTION IF EXISTS audit_logs_immutable();
ALTER TABLE "refunds" DROP CONSTRAINT IF EXISTS "refunds_amount_positive";
ALTER TABLE "payment_allocations" DROP CONSTRAINT IF EXISTS "payment_allocations_amount_positive";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_amount_positive";
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_property_id_external_id_key";
