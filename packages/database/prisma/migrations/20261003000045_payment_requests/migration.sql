-- DATA_MODEL §23 (03.10.2026, ADR-143): запросы оплаты — счёт Kaspi по телефону, ссылка банка или перевод,
-- привязанные к счёту проживания. «Оплачено» создаёт обычный платёж и закрывает запрос одной транзакцией.
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE "payment_requests" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "folio_id" uuid NOT NULL,
  "amount" bigint NOT NULL,
  "currency" char(3) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "link" text,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "payment_id" uuid,
  "note" text,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "closed_at" timestamptz(6),
  CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_requests_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "payment_requests_amount_positive" CHECK ("amount" > 0),
  -- только живые деньги, у которых бывает счёт или ссылка
  CONSTRAINT "payment_requests_method" CHECK ("method" IN ('KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'CARD_TERMINAL')),
  CONSTRAINT "payment_requests_link" CHECK ("link" IS NULL OR ("link" LIKE 'https://%' AND length("link") <= 500)),
  -- оплачен ⇔ есть платёж; закрыт ⇔ есть время закрытия
  CONSTRAINT "payment_requests_paid" CHECK (("status" = 'PAID') = ("payment_id" IS NOT NULL)),
  CONSTRAINT "payment_requests_closed" CHECK (("status" = 'PENDING') = ("closed_at" IS NULL))
);
CREATE UNIQUE INDEX "payment_requests_payment_id_key" ON "payment_requests"("payment_id");
CREATE INDEX "payment_requests_folio_id_idx" ON "payment_requests"("folio_id");
CREATE INDEX "payment_requests_property_id_status_idx" ON "payment_requests"("property_id", "status");

-- Изоляция организаций (§17): как у остальных таблиц объекта
ALTER TABLE "payment_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "payment_requests" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
