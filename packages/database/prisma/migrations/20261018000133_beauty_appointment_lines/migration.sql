-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ: BEAUTY-ZAPIS-20261017 A1/A2/A3/E2.
-- Apply only with the compatible API release after backup and validation described in README.md.

BEGIN;

CREATE TYPE "EmployeeServicePriceType" AS ENUM ('FIXED', 'RANGE', 'FREE', 'UNFIXED');

CREATE TABLE "employee_service_prices" (
  "employee_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "price_type" "EmployeeServicePriceType" NOT NULL,
  "price_min_minor" BIGINT,
  "price_max_minor" BIGINT,
  "duration_minutes" INTEGER,
  "currency" VARCHAR(3) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_service_prices_pkey" PRIMARY KEY ("employee_id", "service_id", "location_id"),
  CONSTRAINT "employee_service_prices_employee_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_service_prices_service_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_service_prices_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_service_prices_revision" CHECK ("revision" > 0),
  CONSTRAINT "employee_service_prices_duration" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
  CONSTRAINT "employee_service_prices_values" CHECK (
    ("price_type" = 'FREE' AND "price_min_minor" = 0 AND "price_max_minor" = 0)
    OR ("price_type" = 'FIXED' AND "price_min_minor" IS NOT NULL AND "price_min_minor" >= 0 AND "price_max_minor" = "price_min_minor")
    OR ("price_type" = 'RANGE' AND "price_min_minor" IS NOT NULL AND "price_max_minor" IS NOT NULL AND "price_min_minor" >= 0 AND "price_max_minor" >= "price_min_minor")
    OR ("price_type" = 'UNFIXED' AND "price_min_minor" IS NULL AND "price_max_minor" IS NULL)
  )
);
CREATE INDEX "employee_service_prices_location_service_idx" ON "employee_service_prices"("location_id", "service_id");

CREATE TABLE "appointment_lines" (
  "id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "service_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "base_price_minor" BIGINT NOT NULL,
  "discount_minor" BIGINT NOT NULL DEFAULT 0,
  "surcharge_minor" BIGINT NOT NULL DEFAULT 0,
  "price_minor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "discount_percent" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_lines_appointment_position_key" UNIQUE ("appointment_id", "position"),
  CONSTRAINT "appointment_lines_appointment_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointment_lines_service_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointment_lines_employee_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointment_lines_position" CHECK ("position" >= 0),
  CONSTRAINT "appointment_lines_span" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "appointment_lines_money" CHECK (
    "base_price_minor" >= 0 AND "discount_minor" >= 0 AND "surcharge_minor" >= 0
    AND "discount_minor" <= "base_price_minor"
    AND "price_minor" = "base_price_minor" - "discount_minor" + "surcharge_minor"
  ),
  CONSTRAINT "appointment_lines_discount_percent" CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 0 AND 100)
);
CREATE INDEX "appointment_lines_employee_starts_idx" ON "appointment_lines"("employee_id", "starts_at");
CREATE INDEX "appointment_lines_service_idx" ON "appointment_lines"("service_id");

CREATE OR REPLACE FUNCTION beauty_employee_service_price_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE branch_currency text;
BEGIN
  SELECT l.currency INTO branch_currency
  FROM locations l
  JOIN employees e ON e.id = NEW.employee_id AND e.business_id = l.business_id
  JOIN beauty_services s ON s.id = NEW.service_id AND s.business_id = l.business_id
  JOIN employee_locations el ON el.employee_id = e.id AND el.location_id = l.id
  JOIN employee_services es ON es.employee_id = e.id AND es.service_id = s.id
  JOIN location_services ls ON ls.location_id = l.id AND ls.service_id = s.id AND ls.enabled
  WHERE l.id = NEW.location_id;
  IF branch_currency IS NULL THEN
    RAISE EXCEPTION 'Master price requires an assigned master and enabled service of the same branch';
  END IF;
  IF NEW.currency <> branch_currency THEN RAISE EXCEPTION 'Master price currency must match branch currency'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'Master price revision must increase by one'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "employee_service_prices_guard" BEFORE INSERT OR UPDATE ON "employee_service_prices"
  FOR EACH ROW EXECUTE FUNCTION beauty_employee_service_price_guard();

INSERT INTO "appointment_lines"
  ("id", "appointment_id", "position", "service_id", "employee_id", "starts_at", "ends_at",
   "base_price_minor", "discount_minor", "surcharge_minor", "price_minor", "currency", "updated_at")
SELECT gen_random_uuid(), a.id, 0, a.service_id, a.employee_id, a.starts_at, a.ends_at,
       a.price, 0, 0, a.price, a.currency, now()
FROM appointments a
ON CONFLICT ("appointment_id", "position") DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM appointment_lines) <> (SELECT count(*) FROM appointments) THEN
    RAISE EXCEPTION 'Appointment line backfill count mismatch';
  END IF;
END $$;

-- Historical rows are snapshots and can legitimately reference an archived master or a service
-- that is no longer assigned. New and changed rows must satisfy the current branch assignments.
CREATE OR REPLACE FUNCTION beauty_appointment_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE appointment_location uuid; appointment_currency text; appointment_status text;
BEGIN
  SELECT a.location_id, a.currency, a.status::text
    INTO appointment_location, appointment_currency, appointment_status
  FROM appointments a WHERE a.id = NEW.appointment_id;
  IF appointment_location IS NULL THEN RAISE EXCEPTION 'Appointment line requires an appointment'; END IF;
  IF NEW.currency <> appointment_currency THEN RAISE EXCEPTION 'Appointment line currency must match appointment'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM locations l
    JOIN employees e ON e.id = NEW.employee_id AND e.business_id = l.business_id AND e.status = 'ACTIVE'
    JOIN employee_locations el ON el.location_id = l.id AND el.employee_id = e.id
    JOIN beauty_services s ON s.id = NEW.service_id AND s.business_id = l.business_id AND s.active
    JOIN employee_services es ON es.employee_id = NEW.employee_id AND es.service_id = s.id
    JOIN location_services ls ON ls.location_id = l.id AND ls.service_id = s.id AND ls.enabled
    WHERE l.id = appointment_location
  ) THEN RAISE EXCEPTION 'Appointment line requires an active assigned master and active enabled service of the branch'; END IF;

  IF appointment_status NOT IN ('CANCELLED', 'NO_SHOW') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.employee_id::text, 731));
    IF EXISTS (
      SELECT 1 FROM appointment_lines other
      JOIN appointments parent ON parent.id = other.appointment_id
      WHERE other.employee_id = NEW.employee_id
        AND other.id <> NEW.id
        AND parent.status NOT IN ('CANCELLED', 'NO_SHOW')
        AND tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
    ) THEN RAISE EXCEPTION 'Appointment line overlaps another service for this master'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "appointment_lines_guard" BEFORE INSERT OR UPDATE ON "appointment_lines"
  FOR EACH ROW EXECUTE FUNCTION beauty_appointment_line_guard();

CREATE OR REPLACE FUNCTION beauty_appointment_legacy_sync() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line_count integer;
BEGIN
  IF current_setting('wetop.appointment_lines_write', true) = 'on' THEN RETURN NEW; END IF;
  SELECT count(*) INTO line_count FROM appointment_lines WHERE appointment_id = NEW.id;
  IF TG_OP = 'UPDATE'
     AND NEW.employee_id IS NOT DISTINCT FROM OLD.employee_id
     AND NEW.service_id IS NOT DISTINCT FROM OLD.service_id
     AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at
     AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
     AND NEW.price IS NOT DISTINCT FROM OLD.price
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency
  THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND line_count > 1 THEN
    RAISE EXCEPTION 'Multi-line appointment fields must be changed through the appointment API';
  END IF;
  IF line_count = 0 THEN
    INSERT INTO appointment_lines
      (id, appointment_id, position, service_id, employee_id, starts_at, ends_at,
       base_price_minor, discount_minor, surcharge_minor, price_minor, currency, updated_at)
    VALUES (gen_random_uuid(), NEW.id, 0, NEW.service_id, NEW.employee_id, NEW.starts_at, NEW.ends_at,
      NEW.price, 0, 0, NEW.price, NEW.currency, now());
  ELSE
    UPDATE appointment_lines SET service_id = NEW.service_id, employee_id = NEW.employee_id,
      starts_at = NEW.starts_at, ends_at = NEW.ends_at, base_price_minor = NEW.price,
      discount_minor = 0, surcharge_minor = 0, price_minor = NEW.price, currency = NEW.currency,
      discount_percent = NULL, updated_at = now()
    WHERE appointment_id = NEW.id AND position = 0;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "appointments_legacy_line_sync" AFTER INSERT OR UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION beauty_appointment_legacy_sync();

CREATE OR REPLACE FUNCTION beauty_appointment_status_overlap_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line appointment_lines%ROWTYPE;
BEGIN
  IF NEW.status IN ('CANCELLED', 'NO_SHOW') OR OLD.status NOT IN ('CANCELLED', 'NO_SHOW') THEN RETURN NEW; END IF;
  FOR line IN SELECT * FROM appointment_lines WHERE appointment_id = NEW.id ORDER BY employee_id, position LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(line.employee_id::text, 731));
    IF EXISTS (
      SELECT 1 FROM appointment_lines other JOIN appointments parent ON parent.id = other.appointment_id
      WHERE other.employee_id = line.employee_id AND other.appointment_id <> NEW.id
        AND parent.status NOT IN ('CANCELLED', 'NO_SHOW')
        AND tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(line.starts_at, line.ends_at, '[)')
    ) THEN RAISE EXCEPTION 'Appointment status reactivation overlaps another service for this master'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER "appointments_status_overlap_guard" BEFORE UPDATE OF "status" ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION beauty_appointment_status_overlap_guard();

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_overlap_per_employee";

ALTER TABLE "appointment_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "appointment_lines" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM appointments parent WHERE parent.id = appointment_lines.appointment_id))
  WITH CHECK (EXISTS (SELECT 1 FROM appointments parent WHERE parent.id = appointment_lines.appointment_id));
ALTER TABLE "employee_service_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_service_prices" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "employee_service_prices" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM locations parent WHERE parent.id = employee_service_prices.location_id))
  WITH CHECK (EXISTS (SELECT 1 FROM locations parent WHERE parent.id = employee_service_prices.location_id));

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_employee_service_price_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_appointment_line_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_appointment_legacy_sync() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_appointment_status_overlap_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
