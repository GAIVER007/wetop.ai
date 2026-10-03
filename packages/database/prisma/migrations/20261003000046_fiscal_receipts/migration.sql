-- DATA_MODEL §25 (03.10.2026, ADR-141): фискальный чек выдаётся по запросу гостя. Чек пробивает касса объекта,
-- WETOP хранит отметку «чек выдан» с номером у платежа: один чек на платёж, только у проведённого платежа.
CREATE TABLE "fiscal_receipts" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "number" text NOT NULL,
  "issued_at" timestamptz(6) NOT NULL DEFAULT now(),
  "issued_by_id" uuid,
  CONSTRAINT "fiscal_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_receipts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fiscal_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fiscal_receipts_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fiscal_receipts_number" CHECK (length(btrim("number")) BETWEEN 1 AND 64)
);
CREATE UNIQUE INDEX "fiscal_receipts_payment_id_key" ON "fiscal_receipts"("payment_id");
CREATE INDEX "fiscal_receipts_property_id_issued_at_idx" ON "fiscal_receipts"("property_id", "issued_at");

-- Изоляция организаций (§17): как у остальных таблиц объекта
ALTER TABLE "fiscal_receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "fiscal_receipts" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
