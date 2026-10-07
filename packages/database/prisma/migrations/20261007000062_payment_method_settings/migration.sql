-- DATA_MODEL §21.6 (ADR-152, 07.10.2026): способы оплаты объекта. Способы остаются системным списком
-- "PaymentMethod"; объект включает, выключает и упорядочивает восемь из них. Строк нет: умолчания
-- (все восемь включены). EXTERNAL не настраивается: платёж площадки, его ставят каналы.
-- Изоляция по объекту, как у кассы (миграция 040) и задач стойки (049).

CREATE TABLE "payment_method_settings" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL,
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "payment_method_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_method_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_method_settings_method_configurable" CHECK ("method" <> 'EXTERNAL'),
  CONSTRAINT "payment_method_settings_sort_order_nonnegative" CHECK ("sort_order" >= 0)
);
CREATE UNIQUE INDEX "payment_method_settings_property_id_method_key" ON "payment_method_settings"("property_id", "method");

-- Изоляция организаций (§17): как у кассы (миграция 040)
ALTER TABLE "payment_method_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "payment_method_settings" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
