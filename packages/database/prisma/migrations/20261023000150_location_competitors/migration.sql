-- 150 Загрузка конкурентов салона и ресторана (DATA_MODEL §60; план plans/2026-10-23-competitors-business-manual.md,
-- проба площадок reports/2026-10-23-competitor-platform-probe.md; владелец 23.10.2026 «да давай делай все варианты»).
-- 1) location_competitors: сосед филиала (салона или ресторана), ссылка на его онлайн-запись или бронь.
-- 2) location_competitor_snapshots: снимок дня «нет мест / мало мест / есть места» и число видимых окон или столов;
--    история по дню снимка, ручной ввод того же дня сильнее сборщика (как §23 у гостиницы).
-- Аддитивно: гостиничные competitors* (§23) и прочие таблицы не меняются. Типы перечислений берутся из §23.
BEGIN;

CREATE TABLE "location_competitors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "address" VARCHAR(300),
  "distance_m" INTEGER,
  "url" TEXT,
  "note" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_competitors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_competitors_id_location_key" UNIQUE ("id", "location_id"),
  CONSTRAINT "location_competitors_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "location_competitors_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "location_competitors_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "location_competitors_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "location_competitors_values" CHECK (
    btrim("name") <> ''
    AND ("distance_m" IS NULL OR "distance_m" >= 0)
    AND ("url" IS NULL OR "url" ~* '^https?://[^[:space:]]+$')
  )
);
-- имя соседа уникально в филиале без учёта регистра и пробелов по краям
CREATE UNIQUE INDEX "location_competitors_location_name_key" ON "location_competitors" ("location_id", lower(btrim("name")));
CREATE INDEX "location_competitors_business_idx" ON "location_competitors" ("business_id", "location_id", "active");

CREATE TABLE "location_competitor_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "competitor_id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "observed_on" DATE NOT NULL,
  "level" "CompetitorAvailabilityLevel" NOT NULL,
  "free_slots" INTEGER,
  "source" "CompetitorObservationSource" NOT NULL DEFAULT 'MANUAL',
  "created_by_id" UUID,
  "observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_competitor_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_competitor_snapshots_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  -- сосед того же филиала: составной ключ, чужой филиал не подставить
  CONSTRAINT "location_competitor_snapshots_competitor_fkey" FOREIGN KEY ("competitor_id", "location_id") REFERENCES "location_competitors"("id", "location_id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "location_competitor_snapshots_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "location_competitor_snapshots_values" CHECK (
    "day" >= "observed_on"
    AND ("free_slots" IS NULL OR "free_slots" >= 0)
    AND ("level" <> 'SOLD_OUT' OR "free_slots" IS NULL OR "free_slots" = 0)
  )
);
CREATE UNIQUE INDEX "location_competitor_snapshots_day_key" ON "location_competitor_snapshots" ("competitor_id", "day", "observed_on");
CREATE INDEX "location_competitor_snapshots_location_idx" ON "location_competitor_snapshots" ("location_id", "observed_on", "day");

-- Принадлежность: бизнес салона или ресторана своей организации, филиал этого бизнеса; у снимка организация соседа.
-- Родитель строки не меняется (перенос соседа в другой филиал запрещён: история снимков осталась бы чужой).
CREATE FUNCTION location_competitor_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org uuid;
BEGIN
  IF TG_TABLE_NAME = 'location_competitors' THEN
    IF TG_OP = 'UPDATE' AND (NEW.organization_id, NEW.business_id, NEW.location_id, NEW.created_at)
       IS DISTINCT FROM (OLD.organization_id, OLD.business_id, OLD.location_id, OLD.created_at) THEN
      RAISE EXCEPTION 'Competitor owner cannot change';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
       WHERE l.id = NEW.location_id AND b.id = NEW.business_id AND b.organization_id = NEW.organization_id
         AND b.vertical IN ('BEAUTY', 'FOOD_SERVICE')
    ) THEN
      RAISE EXCEPTION 'Competitor location belongs to another business or vertical';
    END IF;
    NEW.updated_at := CURRENT_TIMESTAMP;
  ELSE
    IF TG_OP = 'UPDATE' AND (NEW.organization_id, NEW.location_id, NEW.competitor_id, NEW.day, NEW.observed_on)
       IS DISTINCT FROM (OLD.organization_id, OLD.location_id, OLD.competitor_id, OLD.day, OLD.observed_on) THEN
      RAISE EXCEPTION 'Snapshot key cannot change';
    END IF;
    SELECT c.organization_id INTO org FROM location_competitors c WHERE c.id = NEW.competitor_id;
    IF org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Snapshot belongs to another organization';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.location_competitor_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER location_competitors_guard BEFORE INSERT OR UPDATE ON "location_competitors"
  FOR EACH ROW EXECUTE FUNCTION location_competitor_guard();
CREATE TRIGGER location_competitor_snapshots_guard BEFORE INSERT OR UPDATE ON "location_competitor_snapshots"
  FOR EACH ROW EXECUTE FUNCTION location_competitor_guard();

-- RLS: своя организация, как у соседних таблиц салона и ресторана
ALTER TABLE "location_competitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "location_competitors" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "location_competitors" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
ALTER TABLE "location_competitor_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "location_competitor_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "location_competitor_snapshots" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());

-- Права: соседи не удаляются (архив `active = false`), снимок можно поправить и удалить ошибочный
REVOKE ALL ON "location_competitors", "location_competitor_snapshots" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "location_competitors" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "location_competitor_snapshots" TO wetop_app, wetop_service;

COMMIT;
