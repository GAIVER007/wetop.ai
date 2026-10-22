-- Откат 141: только пока бонусами и сертификатами не пользовались. Движения и проданные сертификаты ради отката
-- не удаляют; оплаты BONUS и GIFT_CERTIFICATE не переписывают на другой способ.
BEGIN;
LOCK TABLE "bonus_programs", "customer_bonus_entries", "gift_certificates", "gift_certificate_entries",
  "restaurant_cash_operations", "restaurant_payments", "restaurant_cash_reconciliations", "payments",
  "cash_operations", "cash_reconciliations", "payment_requests", "payment_method_settings" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "customer_bonus_entries") OR EXISTS (SELECT 1 FROM "gift_certificates")
     OR EXISTS (SELECT 1 FROM "gift_certificate_entries") OR EXISTS (SELECT 1 FROM "bonus_programs")
     OR EXISTS (SELECT 1 FROM "restaurant_cash_operations" WHERE "method"::text IN ('BONUS', 'GIFT_CERTIFICATE')) THEN
    RAISE EXCEPTION 'Bonuses or gift certificates are in use: export them before rollback of 141';
  END IF;
END $$;

DROP TABLE "gift_certificate_entries";
DROP TABLE "gift_certificates";
DROP TABLE "customer_bonus_entries";
DROP TABLE "bonus_programs";
DROP FUNCTION loyalty_owner_guard();
DROP FUNCTION loyalty_append_only();
DROP FUNCTION gift_certificates_guard();
DROP FUNCTION bonus_programs_guard();
DROP TYPE "GiftCertificateEntryKind";
DROP TYPE "GiftCertificateStatus";
DROP TYPE "BonusEntryKind";

ALTER TABLE "payments" DROP CONSTRAINT "payments_method_money";
ALTER TABLE "cash_operations" DROP CONSTRAINT "cash_operations_method_money";
ALTER TABLE "cash_reconciliations" DROP CONSTRAINT "cash_reconciliations_method_money";
ALTER TABLE "payment_method_settings" DROP CONSTRAINT "payment_method_settings_method_money";
ALTER TABLE "restaurant_payments" DROP CONSTRAINT "restaurant_payments_method_money";
ALTER TABLE "restaurant_cash_reconciliations" DROP CONSTRAINT "restaurant_cash_reconciliations_method_money";
ALTER TABLE "restaurant_cash_operations" DROP CONSTRAINT "restaurant_cash_operations_loyalty_method";

-- Убрать значения из перечисления PostgreSQL не умеет: тип пересоздаётся без BONUS и GIFT_CERTIFICATE.
-- CHECK, которые сравнивают способы, снимаются на время замены и ставятся обратно теми же определениями.
DO $$
DECLARE s text := current_schema(); r record; defs text[] := '{}'; rels text[] := '{}'; names text[] := '{}'; i int;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass::text AS rel, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.connamespace = s::regnamespace AND con.contype = 'c'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
                  AND a.atttypid = format('%I."PaymentMethod"', s)::regtype)
  LOOP
    rels := rels || r.rel; names := names || r.conname::text; defs := defs || r.def;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.rel, r.conname);
  END LOOP;
  EXECUTE format('ALTER TYPE %I."PaymentMethod" RENAME TO "PaymentMethod_old"', s);
  EXECUTE format($q$CREATE TYPE %I."PaymentMethod" AS ENUM ('CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_LEGAL', 'EXTERNAL',
    'BANK_TRANSFER_PERSON', 'CARD_GUARANTEE', 'DEPOSIT', 'HALYK', 'KASPI')$q$, s);
  FOR r IN
    SELECT c.oid::regclass::text AS rel, a.attname
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relnamespace = s::regnamespace AND c.relkind = 'r' AND NOT a.attisdropped
      AND a.atttypid = format('%I."PaymentMethod_old"', s)::regtype
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I TYPE %I."PaymentMethod" USING (%I::text::%I."PaymentMethod")',
      r.rel, r.attname, s, r.attname, s);
  END LOOP;
  FOR i IN 1 .. coalesce(array_length(defs, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rels[i], names[i], replace(defs[i], '"PaymentMethod_old"', '"PaymentMethod"'));
  END LOOP;
  EXECUTE format('DROP TYPE %I."PaymentMethod_old"', s);
END $$;
COMMIT;
