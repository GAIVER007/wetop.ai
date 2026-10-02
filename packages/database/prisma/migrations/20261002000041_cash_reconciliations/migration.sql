-- DATA_MODEL §21.4 (утверждено владельцем 02.10.2026, дополнение к ADR-134): сверка кассы.
-- Снимок «по системе» и факт пересчёта; расхождение не хранится — выравнивается обычной операцией кассы.
CREATE TABLE "cash_reconciliations" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "expected" bigint NOT NULL,
  "counted" bigint NOT NULL,
  "note" text,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "cash_reconciliations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_reconciliations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_reconciliations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  -- пересчитанная сумма не бывает отрицательной; сверяются только живые деньги кассы (Q-237)
  CONSTRAINT "cash_reconciliations_counted" CHECK ("counted" >= 0),
  CONSTRAINT "cash_reconciliations_method_cash" CHECK ("method" NOT IN ('EXTERNAL', 'DEPOSIT', 'CARD_GUARANTEE'))
);
CREATE INDEX "cash_reconciliations_property_id_method_created_at_idx"
  ON "cash_reconciliations"("property_id", "method", "created_at");

-- Изоляция организаций (§17): как у остальных таблиц объекта
ALTER TABLE "cash_reconciliations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "cash_reconciliations" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
