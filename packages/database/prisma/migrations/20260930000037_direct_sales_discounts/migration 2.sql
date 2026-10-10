-- DATA_MODEL v2.7 §20 (утверждено владельцем 29.09.2026, ADR-128, срез D4): производный тариф и промокод.
-- Все поля новые и необязательные: у существующих тарифов и броней ничего не меняется.

-- Производный тариф: родитель, процент, окно продаж, минимум ночей
ALTER TABLE "rate_plans"
  ADD COLUMN "parent_rate_plan_id" uuid,
  ADD COLUMN "discount_percent" integer,
  ADD COLUMN "min_days_before_arrival" integer,
  ADD COLUMN "max_days_before_arrival" integer,
  ADD COLUMN "min_nights" integer;

ALTER TABLE "rate_plans"
  ADD CONSTRAINT "rate_plans_parent_rate_plan_id_fkey" FOREIGN KEY ("parent_rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "rate_plans_parent_not_self" CHECK ("parent_rate_plan_id" IS NULL OR "parent_rate_plan_id" <> "id"),
  -- производный тариф — это родитель и процент вместе; без родителя ни процента, ни условий
  ADD CONSTRAINT "rate_plans_derived_shape" CHECK (
    ("parent_rate_plan_id" IS NULL AND "discount_percent" IS NULL AND "min_days_before_arrival" IS NULL
      AND "max_days_before_arrival" IS NULL AND "min_nights" IS NULL)
    OR ("parent_rate_plan_id" IS NOT NULL AND "discount_percent" IS NOT NULL)
  ),
  ADD CONSTRAINT "rate_plans_discount_percent" CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 1 AND 90),
  ADD CONSTRAINT "rate_plans_window_days" CHECK (
    ("min_days_before_arrival" IS NULL OR "min_days_before_arrival" >= 0)
    AND ("max_days_before_arrival" IS NULL OR "max_days_before_arrival" >= 0)
    AND ("min_days_before_arrival" IS NULL OR "max_days_before_arrival" IS NULL
         OR "min_days_before_arrival" <= "max_days_before_arrival")
  ),
  ADD CONSTRAINT "rate_plans_min_nights" CHECK ("min_nights" IS NULL OR "min_nights" >= 1);

CREATE INDEX "rate_plans_parent_rate_plan_id_idx" ON "rate_plans"("parent_rate_plan_id");

-- Родитель — обычный тариф того же объекта и той же валюты; у тарифа с производными родителя быть не может.
-- CHECK этого не выразит (нужна другая строка), поэтому триггер: цепочка «производный от производного» невозможна.
CREATE OR REPLACE FUNCTION rate_plans_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_row RECORD;
BEGIN
  IF NEW."parent_rate_plan_id" IS NOT NULL THEN
    SELECT "property_id", "currency", "parent_rate_plan_id" INTO parent_row
      FROM "rate_plans" WHERE "id" = NEW."parent_rate_plan_id";
    IF parent_row."property_id" IS DISTINCT FROM NEW."property_id" THEN
      RAISE EXCEPTION 'Родитель производного тарифа должен быть на том же объекте';
    END IF;
    IF parent_row."currency" IS DISTINCT FROM NEW."currency" THEN
      RAISE EXCEPTION 'Родитель производного тарифа должен быть в той же валюте';
    END IF;
    IF parent_row."parent_rate_plan_id" IS NOT NULL THEN
      RAISE EXCEPTION 'Родитель производного тарифа не может сам быть производным';
    END IF;
    IF EXISTS (SELECT 1 FROM "rate_plans" WHERE "parent_rate_plan_id" = NEW."id") THEN
      RAISE EXCEPTION 'У тарифа есть производные: сделать его производным нельзя';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "rate_plans_parent_guard" BEFORE INSERT OR UPDATE OF "parent_rate_plan_id", "currency", "property_id"
  ON "rate_plans" FOR EACH ROW EXECUTE FUNCTION rate_plans_parent_guard();

-- Промокод объекта
CREATE TABLE "promo_codes" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "code" text NOT NULL,
  "discount_percent" integer NOT NULL,
  "stay_from" date,
  "stay_to" date,
  "max_uses" integer,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_codes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "promo_codes_code_format" CHECK ("code" ~ '^[A-Z0-9_-]{3,32}$'),
  CONSTRAINT "promo_codes_discount_percent" CHECK ("discount_percent" BETWEEN 1 AND 90),
  CONSTRAINT "promo_codes_period" CHECK ("stay_from" IS NULL OR "stay_to" IS NULL OR "stay_from" <= "stay_to"),
  CONSTRAINT "promo_codes_max_uses" CHECK ("max_uses" IS NULL OR "max_uses" >= 1)
);
CREATE UNIQUE INDEX "promo_codes_property_id_code_key" ON "promo_codes"("property_id", "code");

-- След промокода в брони; число использований — число броней с этой ссылкой
ALTER TABLE "reservations" ADD COLUMN "promo_code_id" uuid;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "reservations_promo_code_id_idx" ON "reservations"("promo_code_id");

-- Изоляция организаций (§17): объект в строке — как у остальных таблиц объекта (миграция 028)
ALTER TABLE "promo_codes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "promo_codes" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
