-- 141 Бонусы и подарочные сертификаты салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md, §2-3).
-- Деньги и бонусы bigint в минорных единицах (AGENTS.md §12). Журналы движений только дописываются.
-- Новые способы оплаты BONUS и GIFT_CERTIFICATE не деньги в кассе: допустимы только в оплате и возврате записи
-- салона (restaurant_cash_operations с appointment_id), в остальных таблицах способов оплаты их нет (CHECK).
-- ALTER TYPE ... ADD VALUE в транзакции допустим, пока новое значение в ней не используется: проверки ниже
-- сравнивают текст способа, а не значение перечисления.
BEGIN;

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BONUS';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'GIFT_CERTIFICATE';

ALTER TABLE "payments" ADD CONSTRAINT "payments_method_money" CHECK ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE'));
ALTER TABLE "cash_operations" ADD CONSTRAINT "cash_operations_method_money"
  CHECK ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE') AND ("method_to" IS NULL OR "method_to"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE')));
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_method_money" CHECK ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE'));
-- payment_requests уже ограничены CHECK payment_requests_method (четыре способа перевода)
ALTER TABLE "payment_method_settings" ADD CONSTRAINT "payment_method_settings_method_money" CHECK ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE'));
ALTER TABLE "restaurant_payments" ADD CONSTRAINT "restaurant_payments_method_money" CHECK ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE'));
ALTER TABLE "restaurant_cash_reconciliations" ADD CONSTRAINT "restaurant_cash_reconciliations_method_money" CHECK ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE'));
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_loyalty_method" CHECK (
  ("method"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE') OR ("appointment_id" IS NOT NULL AND "kind" IN ('INCOME', 'EXPENSE')))
  AND ("method_to" IS NULL OR "method_to"::text NOT IN ('BONUS', 'GIFT_CERTIFICATE'))
);

CREATE TYPE "BonusEntryKind" AS ENUM ('ACCRUAL', 'REDEEM', 'REVERSAL', 'ADJUSTMENT');
CREATE TYPE "GiftCertificateStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'VOID');
CREATE TYPE "GiftCertificateEntryKind" AS ENUM ('SALE', 'REDEEM', 'REVERSAL');

CREATE TABLE "bonus_programs" (
  "business_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "accrual_percent" INTEGER NOT NULL DEFAULT 5,
  "max_redeem_percent" INTEGER NOT NULL DEFAULT 30,
  "expires_days" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bonus_programs_pkey" PRIMARY KEY ("business_id"),
  CONSTRAINT "bonus_programs_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "bonus_programs_values" CHECK (
    "accrual_percent" BETWEEN 0 AND 100 AND "max_redeem_percent" BETWEEN 0 AND 100
    AND ("expires_days" IS NULL OR "expires_days" BETWEEN 1 AND 3650) AND "revision" > 0
  )
);

CREATE TABLE "customer_bonus_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "kind" "BonusEntryKind" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(6),
  "appointment_id" UUID,
  "payment_id" UUID,
  "reason" VARCHAR(300),
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_bonus_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_bonus_entries_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "customer_bonus_entries_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "customer_bonus_entries_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "customer_bonus_entries_appointment_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "customer_bonus_entries_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "restaurant_cash_operations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "customer_bonus_entries_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "customer_bonus_entries_values" CHECK (
    "amount_minor" <> 0
    AND ("kind" <> 'ACCRUAL' OR ("amount_minor" > 0 AND "payment_id" IS NOT NULL))
    AND ("kind" <> 'REDEEM' OR ("amount_minor" < 0 AND "payment_id" IS NOT NULL))
    AND ("kind" <> 'REVERSAL' OR "payment_id" IS NOT NULL)
    AND ("kind" <> 'ADJUSTMENT' OR ("reason" IS NOT NULL AND btrim("reason") <> '' AND "payment_id" IS NULL))
    AND ("expires_at" IS NULL OR "kind" IN ('ACCRUAL', 'ADJUSTMENT'))
  )
);
-- одно начисление, одно списание и один возврат на операцию кассы: повтор не начисляет дважды
CREATE UNIQUE INDEX "customer_bonus_entries_payment_kind_key" ON "customer_bonus_entries" ("payment_id", "kind");
CREATE INDEX "customer_bonus_entries_customer_idx" ON "customer_bonus_entries" ("business_id", "customer_id", "created_at");
CREATE INDEX "customer_bonus_entries_appointment_idx" ON "customer_bonus_entries" ("appointment_id");

CREATE TABLE "gift_certificates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "code" VARCHAR(12) NOT NULL,
  "initial_minor" BIGINT NOT NULL,
  "balance_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "buyer_customer_id" UUID,
  "status" "GiftCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gift_certificates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gift_certificates_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificates_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificates_buyer_fkey" FOREIGN KEY ("buyer_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificates_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificates_values" CHECK (
    "code" ~ '^[A-HJKMNP-Z2-9]{8}$'
    AND "initial_minor" > 0 AND "balance_minor" >= 0 AND "balance_minor" <= "initial_minor"
    AND ("status" <> 'USED' OR "balance_minor" = 0)
  )
);
CREATE UNIQUE INDEX "gift_certificates_business_code_key" ON "gift_certificates" ("business_id", "code");
CREATE INDEX "gift_certificates_business_created_idx" ON "gift_certificates" ("business_id", "created_at");

CREATE TABLE "gift_certificate_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "certificate_id" UUID NOT NULL,
  "kind" "GiftCertificateEntryKind" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "appointment_id" UUID,
  "payment_id" UUID,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gift_certificate_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gift_certificate_entries_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificate_entries_certificate_fkey" FOREIGN KEY ("certificate_id") REFERENCES "gift_certificates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificate_entries_appointment_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificate_entries_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "restaurant_cash_operations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificate_entries_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "gift_certificate_entries_values" CHECK (
    "payment_id" IS NOT NULL
    AND ("kind" <> 'SALE' OR ("amount_minor" > 0 AND "appointment_id" IS NULL))
    AND ("kind" <> 'REDEEM' OR ("amount_minor" < 0 AND "appointment_id" IS NOT NULL))
    AND ("kind" <> 'REVERSAL' OR ("amount_minor" > 0 AND "appointment_id" IS NOT NULL))
  )
);
CREATE UNIQUE INDEX "gift_certificate_entries_payment_kind_key" ON "gift_certificate_entries" ("payment_id", "kind");
CREATE INDEX "gift_certificate_entries_certificate_idx" ON "gift_certificate_entries" ("certificate_id", "created_at");

-- Принадлежность: бизнес салона своей организации, клиент своей организации, запись своего бизнеса.
CREATE FUNCTION loyalty_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid; org uuid; appointment uuid; payment uuid;
BEGIN
  -- поля NEW читаются только своей таблицы: PL/pgSQL не сокращает AND, чужое поле дало бы ошибку
  IF TG_TABLE_NAME = 'gift_certificate_entries' THEN
    SELECT g.business_id, g.organization_id INTO biz, org FROM gift_certificates g WHERE g.id = NEW.certificate_id;
    IF org IS DISTINCT FROM NEW.organization_id THEN RAISE EXCEPTION 'Certificate entry belongs to another organization'; END IF;
    appointment := NEW.appointment_id; payment := NEW.payment_id;
  ELSE
    biz := NEW.business_id; org := NEW.organization_id;
    IF NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = biz AND b.organization_id = org AND b.vertical = 'BEAUTY') THEN
      RAISE EXCEPTION 'Loyalty row requires a Beauty business of its organization';
    END IF;
    IF TG_TABLE_NAME = 'customer_bonus_entries' THEN
      IF NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = NEW.customer_id AND c.organization_id = org) THEN
        RAISE EXCEPTION 'Bonus customer belongs to another organization';
      END IF;
      appointment := NEW.appointment_id; payment := NEW.payment_id;
    ELSIF TG_TABLE_NAME = 'gift_certificates' THEN
      IF NEW.buyer_customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers c WHERE c.id = NEW.buyer_customer_id AND c.organization_id = org) THEN
        RAISE EXCEPTION 'Certificate buyer belongs to another organization';
      END IF;
    END IF;
  END IF;
  IF appointment IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM appointments a JOIN locations l ON l.id = a.location_id WHERE a.id = appointment AND l.business_id = biz) THEN
    RAISE EXCEPTION 'Loyalty entry appointment belongs to another business';
  END IF;
  IF payment IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM restaurant_cash_operations o JOIN locations l ON l.id = o.location_id WHERE o.id = payment AND l.business_id = biz) THEN
    RAISE EXCEPTION 'Loyalty entry payment belongs to another business';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION loyalty_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

CREATE FUNCTION gift_certificates_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.organization_id, NEW.business_id, NEW.code, NEW.initial_minor, NEW.currency, NEW.created_at)
     IS DISTINCT FROM (OLD.organization_id, OLD.business_id, OLD.code, OLD.initial_minor, OLD.currency, OLD.created_at) THEN
    RAISE EXCEPTION 'Gift certificate identity is immutable';
  END IF;
  IF OLD.status = 'VOID' AND NEW.status <> 'VOID' THEN RAISE EXCEPTION 'Void certificate stays void'; END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;

CREATE FUNCTION bonus_programs_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Bonus program business is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = NEW.business_id AND b.vertical = 'BEAUTY') THEN
    RAISE EXCEPTION 'Bonus program requires a Beauty business';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;

CREATE TRIGGER customer_bonus_entries_owner BEFORE INSERT ON "customer_bonus_entries" FOR EACH ROW EXECUTE FUNCTION loyalty_owner_guard();
CREATE TRIGGER customer_bonus_entries_append_only BEFORE UPDATE OR DELETE ON "customer_bonus_entries" FOR EACH ROW EXECUTE FUNCTION loyalty_append_only();
CREATE TRIGGER gift_certificates_owner BEFORE INSERT ON "gift_certificates" FOR EACH ROW EXECUTE FUNCTION loyalty_owner_guard();
CREATE TRIGGER gift_certificates_guard BEFORE UPDATE ON "gift_certificates" FOR EACH ROW EXECUTE FUNCTION gift_certificates_guard();
CREATE TRIGGER gift_certificates_no_delete BEFORE DELETE ON "gift_certificates" FOR EACH ROW EXECUTE FUNCTION loyalty_append_only();
CREATE TRIGGER gift_certificate_entries_owner BEFORE INSERT ON "gift_certificate_entries" FOR EACH ROW EXECUTE FUNCTION loyalty_owner_guard();
CREATE TRIGGER gift_certificate_entries_append_only BEFORE UPDATE OR DELETE ON "gift_certificate_entries" FOR EACH ROW EXECUTE FUNCTION loyalty_append_only();
CREATE TRIGGER bonus_programs_guard BEFORE INSERT OR UPDATE ON "bonus_programs" FOR EACH ROW EXECUTE FUNCTION bonus_programs_guard();

-- RLS: оплата записи пишет движения в своей транзакции ролью wetop_app, поэтому вставка своей организации
-- разрешена; программа бонусов пишется служебной ролью (настройка руководителя).
ALTER TABLE "bonus_programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bonus_programs" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "bonus_programs" FOR SELECT TO wetop_app USING (EXISTS (
  SELECT 1 FROM businesses b WHERE b.id = bonus_programs.business_id AND b.organization_id = app_current_org()
));
ALTER TABLE "customer_bonus_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_bonus_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "customer_bonus_entries" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_insert ON "customer_bonus_entries" FOR INSERT TO wetop_app WITH CHECK ("organization_id" = app_current_org());
ALTER TABLE "gift_certificates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_certificates" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "gift_certificates" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_insert ON "gift_certificates" FOR INSERT TO wetop_app WITH CHECK ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_update ON "gift_certificates" FOR UPDATE TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
ALTER TABLE "gift_certificate_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_certificate_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "gift_certificate_entries" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_insert ON "gift_certificate_entries" FOR INSERT TO wetop_app WITH CHECK ("organization_id" = app_current_org());

REVOKE ALL ON "bonus_programs", "customer_bonus_entries", "gift_certificates", "gift_certificate_entries" FROM wetop_app, wetop_service;
GRANT SELECT ON "bonus_programs" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON "bonus_programs" TO wetop_service;
GRANT SELECT, INSERT ON "customer_bonus_entries", "gift_certificate_entries" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "gift_certificates" TO wetop_app, wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.loyalty_owner_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.loyalty_append_only() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.gift_certificates_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.bonus_programs_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
