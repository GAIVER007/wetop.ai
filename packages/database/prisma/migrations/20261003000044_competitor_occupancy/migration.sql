-- DATA_MODEL §23 (утверждено поручением владельца 03.10.2026, ADR-141): загрузка конкурентов.
-- Конкуренты объекта и снимки их загрузки по ночам; своя загрузка не хранится, она считается из календаря.
CREATE TYPE "CompetitorObservationSource" AS ENUM ('MANUAL', 'AI_AGENT');

CREATE TABLE "competitors" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "name" text NOT NULL,
  "distance_m" integer,
  "units_total" integer,
  "url" text,
  "note" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "competitors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitors_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "competitors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "competitors_name_length" CHECK (char_length("name") BETWEEN 1 AND 120),
  CONSTRAINT "competitors_distance" CHECK ("distance_m" IS NULL OR "distance_m" >= 0),
  CONSTRAINT "competitors_units_total" CHECK ("units_total" IS NULL OR "units_total" > 0),
  CONSTRAINT "competitors_url_length" CHECK ("url" IS NULL OR char_length("url") <= 500),
  CONSTRAINT "competitors_note_length" CHECK ("note" IS NULL OR char_length("note") <= 500)
);
CREATE UNIQUE INDEX "competitors_property_id_name_key" ON "competitors"("property_id", "name");
-- цель составного ключа снимков: снимок не может сослаться на конкурента чужого объекта
CREATE UNIQUE INDEX "competitors_id_property_id_key" ON "competitors"("id", "property_id");

CREATE TABLE "competitor_occupancy" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "competitor_id" uuid NOT NULL,
  "stay_date" date NOT NULL,
  "observed_on" date NOT NULL,
  "occupancy_bp" integer NOT NULL,
  "source" "CompetitorObservationSource" NOT NULL DEFAULT 'MANUAL',
  "created_by_id" uuid,
  "observed_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "competitor_occupancy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitor_occupancy_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "competitor_occupancy_competitor_fkey" FOREIGN KEY ("competitor_id", "property_id") REFERENCES "competitors"("id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "competitor_occupancy_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  -- базисные пункты: 0 = пусто, 10 000 = полон (ADR-008: без чисел с плавающей точкой)
  CONSTRAINT "competitor_occupancy_bp" CHECK ("occupancy_bp" BETWEEN 0 AND 10000)
);
CREATE UNIQUE INDEX "competitor_occupancy_competitor_id_stay_date_observed_on_key"
  ON "competitor_occupancy"("competitor_id", "stay_date", "observed_on");
CREATE INDEX "competitor_occupancy_property_id_observed_on_stay_date_idx"
  ON "competitor_occupancy"("property_id", "observed_on", "stay_date");

-- Изоляция организаций (§17): как у остальных таблиц объекта
ALTER TABLE "competitors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "competitors" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
ALTER TABLE "competitor_occupancy" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "competitor_occupancy" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
