-- 151 Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7, решение владельца 23.10.2026 «Да, делай по этой схеме»,
-- docs/decisions/2026-10-23-branch-payment-methods.md). Филиал включает, выключает и упорядочивает шесть денежных
-- способов кассы филиала (§35): CASH, CARD_TERMINAL, KASPI, HALYK, BANK_TRANSFER_PERSON, BANK_TRANSFER_LEGAL.
-- Строк нет: умолчания (все шесть включены), поэтому выкладка ничего не меняет. Таблица гостиницы
-- payment_method_settings (§21.6) не трогается. Аддитивно: старый API новую таблицу не читает.
BEGIN;

CREATE TABLE "branch_payment_method_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "location_id" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "branch_payment_method_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branch_payment_method_settings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "branch_payment_method_settings_method_branch" CHECK (
    "method" IN ('CASH','CARD_TERMINAL','KASPI','HALYK','BANK_TRANSFER_PERSON','BANK_TRANSFER_LEGAL')
  ),
  CONSTRAINT "branch_payment_method_settings_sort_order_nonnegative" CHECK ("sort_order" >= 0)
);
CREATE UNIQUE INDEX "branch_payment_method_settings_location_id_method_key" ON "branch_payment_method_settings"("location_id", "method");

-- RLS как у кассы филиала (миграция 86): филиал бизнеса своей организации
ALTER TABLE "branch_payment_method_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_payment_method_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "branch_payment_method_settings" TO wetop_app
  USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()))
  WITH CHECK (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));

-- Права: чтение, запись и правка; удаления нет (выключение вместо удаления), как у настроек объекта
REVOKE ALL ON "branch_payment_method_settings" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "branch_payment_method_settings" TO wetop_app, wetop_service;

COMMIT;
