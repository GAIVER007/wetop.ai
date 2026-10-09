-- ADR-154, DATA_MODEL §30: карточка объекта (описание, сайт, публичное имя, правила проживания, удобства) колонками
-- `properties`. Аддитивно: все колонки с умолчанием или NULL, прав и политик RLS не добавляется (rls_tenant на
-- properties уже действует). Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- AlterTable
ALTER TABLE "properties"
  ADD COLUMN "description"       VARCHAR(500),
  ADD COLUMN "website"           VARCHAR(300),
  ADD COLUMN "public_name"       VARCHAR(200),
  ADD COLUMN "early_check_in"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "late_check_out"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "children_allowed"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pets_allowed"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "smoking_allowed"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onsite_payment"    VARCHAR(12) NOT NULL DEFAULT 'CASH_CARD',
  ADD COLUMN "cancellation_rule" VARCHAR(16) NOT NULL DEFAULT 'FREE_1D',
  ADD COLUMN "deposit_rule"      VARCHAR(16) NOT NULL DEFAULT 'NONE',
  ADD COLUMN "min_guest_age"     SMALLINT NOT NULL DEFAULT 18,
  ADD COLUMN "quiet_hours_from"  VARCHAR(5),
  ADD COLUMN "quiet_hours_to"    VARCHAR(5),
  ADD COLUMN "house_rules_note"  VARCHAR(500),
  ADD COLUMN "amenities"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_onsite_payment_check"    CHECK ("onsite_payment" IN ('CASH_CARD', 'CASH', 'CARD', 'TRANSFER')),
  ADD CONSTRAINT "properties_cancellation_rule_check" CHECK ("cancellation_rule" IN ('FREE_1D', 'FREE_3D', 'FREE_7D', 'NON_REFUNDABLE')),
  ADD CONSTRAINT "properties_deposit_rule_check"      CHECK ("deposit_rule" IN ('NONE', 'FIRST_NIGHT', 'HALF', 'FULL')),
  ADD CONSTRAINT "properties_min_guest_age_check"     CHECK ("min_guest_age" BETWEEN 0 AND 99),
  ADD CONSTRAINT "properties_quiet_hours_pair_check"  CHECK (("quiet_hours_from" IS NULL) = ("quiet_hours_to" IS NULL));
