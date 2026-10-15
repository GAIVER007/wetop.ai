-- DATA_MODEL §23.1 (макет владельца 09.10.2026, ADR-155): цены конкурентов, район, категория, настройки мониторинга.
-- Конкуренты получают поля для таблицы «Отслеживаемые конкуренты», снимки цен ложатся рядом со снимками загрузки.
CREATE TYPE "CompetitorMonitoring" AS ENUM ('OCCUPANCY', 'PRICE', 'BOTH');

ALTER TABLE "competitors"
  ADD COLUMN "district" text,
  ADD COLUMN "category" text,
  ADD COLUMN "address" text,
  ADD COLUMN "data_source" text,
  ADD COLUMN "monitoring" "CompetitorMonitoring" NOT NULL DEFAULT 'BOTH',
  ADD COLUMN "refresh_hours" smallint,
  ADD COLUMN "auto_refresh" boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT "competitors_district_length" CHECK ("district" IS NULL OR char_length("district") <= 80),
  ADD CONSTRAINT "competitors_category_length" CHECK ("category" IS NULL OR char_length("category") <= 60),
  ADD CONSTRAINT "competitors_address_length" CHECK ("address" IS NULL OR char_length("address") <= 200),
  ADD CONSTRAINT "competitors_data_source_length" CHECK ("data_source" IS NULL OR char_length("data_source") <= 40),
  ADD CONSTRAINT "competitors_refresh_hours" CHECK ("refresh_hours" IS NULL OR "refresh_hours" BETWEEN 1 AND 168);

CREATE TABLE "competitor_rates" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "competitor_id" uuid NOT NULL,
  "stay_date" date NOT NULL,
  "observed_on" date NOT NULL,
  -- минорные единицы (ADR-008): наименьшая видимая цена номера на двоих за ночь
  "price_minor" bigint NOT NULL,
  "currency" char(3) NOT NULL,
  "source" "CompetitorObservationSource" NOT NULL DEFAULT 'MANUAL',
  "created_by_id" uuid,
  "observed_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "competitor_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitor_rates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "competitor_rates_competitor_fkey" FOREIGN KEY ("competitor_id", "property_id") REFERENCES "competitors"("id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "competitor_rates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "competitor_rates_price" CHECK ("price_minor" > 0)
);
CREATE UNIQUE INDEX "competitor_rates_competitor_id_stay_date_observed_on_key"
  ON "competitor_rates"("competitor_id", "stay_date", "observed_on");
CREATE INDEX "competitor_rates_property_id_observed_on_stay_date_idx"
  ON "competitor_rates"("property_id", "observed_on", "stay_date");

-- Изоляция организаций (§17): как у остальных таблиц конкурентов
ALTER TABLE "competitor_rates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "competitor_rates" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
