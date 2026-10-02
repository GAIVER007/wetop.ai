-- DATA_MODEL §21 (утверждено владельцем 02.10.2026): касса — движения денег мимо счетов гостей.
-- Гостевые оплаты сюда не дублируются: остаток по способу вычисляется из payments/refunds и этих операций.
-- payments, refunds и folios не меняются.

CREATE TYPE "CashOperationKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- Статья кассы: справочник объекта, архив через active (удаления нет, как у services)
CREATE TABLE "cash_categories" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "kind" "CashOperationKind" NOT NULL,
  "name" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "cash_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_categories_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- у перевода статей не бывает
  CONSTRAINT "cash_categories_kind" CHECK ("kind" IN ('INCOME', 'EXPENSE'))
);
CREATE UNIQUE INDEX "cash_categories_property_id_kind_name_key" ON "cash_categories"("property_id", "kind", "name");

-- Поступление, расход или перевод между способами; прошлое не правится — ошибка аннулируется (status)
CREATE TABLE "cash_operations" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "kind" "CashOperationKind" NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "method_to" "PaymentMethod",
  "amount" bigint NOT NULL,
  "category_id" uuid,
  "note" text,
  "related_id" uuid,
  "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
  "occurred_at" timestamptz(6) NOT NULL DEFAULT now(),
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "cash_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_operations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_operations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cash_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_operations_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "cash_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_operations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cash_operations_amount_positive" CHECK ("amount" > 0),
  -- перевод — в другой способ и без статьи; у поступления и расхода получателя нет
  CONSTRAINT "cash_operations_transfer_shape" CHECK (
    ("kind" = 'TRANSFER' AND "method_to" IS NOT NULL AND "method_to" <> "method" AND "category_id" IS NULL)
    OR ("kind" <> 'TRANSFER' AND "method_to" IS NULL)
  ),
  -- не живые деньги объекта (Q-246) в кассе не участвуют
  CONSTRAINT "cash_operations_methods_cash" CHECK (
    "method" NOT IN ('EXTERNAL', 'DEPOSIT', 'CARD_GUARANTEE')
    AND ("method_to" IS NULL OR "method_to" NOT IN ('EXTERNAL', 'DEPOSIT', 'CARD_GUARANTEE'))
  )
);
CREATE INDEX "cash_operations_property_id_occurred_at_idx" ON "cash_operations"("property_id", "occurred_at");
CREATE INDEX "cash_operations_related_id_idx" ON "cash_operations"("related_id");

-- Статья только своего объекта: FK этого не выразит (нужна строка статьи), проверяет триггер
CREATE OR REPLACE FUNCTION cash_operations_category_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."category_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "cash_categories" c WHERE c."id" = NEW."category_id" AND c."property_id" = NEW."property_id"
  ) THEN
    RAISE EXCEPTION 'Статья принадлежит другому объекту';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "cash_operations_category_guard" BEFORE INSERT OR UPDATE OF "category_id", "property_id"
  ON "cash_operations" FOR EACH ROW EXECUTE FUNCTION cash_operations_category_guard();

-- Изоляция организаций (§17): как у остальных таблиц объекта (миграция 028)
ALTER TABLE "cash_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "cash_categories" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
ALTER TABLE "cash_operations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "cash_operations" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
