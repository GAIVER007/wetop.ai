-- Откат 158: только пока «Другим» не пользовались. CHECK возвращаются к набору миграции 151, тип PaymentMethod
-- пересоздаётся без OTHER, поэтому схема после отката совпадает со схемой до 158.
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

-- Убрать значение из перечисления PostgreSQL не умеет: тип пересоздаётся без OTHER (как откат 141).
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
    'BANK_TRANSFER_PERSON', 'CARD_GUARANTEE', 'DEPOSIT', 'HALYK', 'KASPI', 'BONUS', 'GIFT_CERTIFICATE')$q$, s);
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
