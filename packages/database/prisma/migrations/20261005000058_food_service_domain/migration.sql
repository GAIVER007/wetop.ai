-- CreateEnum
CREATE TYPE "RestaurantReservationStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RestaurantReservationSource" AS ENUM ('DESK', 'WALK_IN');

-- CreateTable
CREATE TABLE "dining_areas" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dining_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_tables" (
    "id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_periods" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "time_from" TIME(0) NOT NULL,
    "time_to" TIME(0) NOT NULL,
    "ends_next_day" BOOLEAN NOT NULL DEFAULT false,
    "default_duration_minutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_reservations" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_period_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" "RestaurantReservationStatus" NOT NULL DEFAULT 'BOOKED',
    "source" "RestaurantReservationSource" NOT NULL DEFAULT 'DESK',
    "notes" TEXT,
    "creation_key" VARCHAR(200) NOT NULL,
    "creation_fingerprint" VARCHAR(64) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "restaurant_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_assignments" (
    "reservation_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "table_assignments_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateIndex
CREATE INDEX "dining_areas_location_id_idx" ON "dining_areas"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_area_id_name_key" ON "dining_tables"("area_id", "name");

-- CreateIndex
CREATE INDEX "service_periods_location_id_idx" ON "service_periods"("location_id");

-- CreateIndex
CREATE INDEX "restaurant_reservations_location_id_starts_at_idx" ON "restaurant_reservations"("location_id", "starts_at");

-- CreateIndex
CREATE INDEX "restaurant_reservations_customer_id_idx" ON "restaurant_reservations"("customer_id");

-- CreateIndex
CREATE INDEX "restaurant_reservations_status_idx" ON "restaurant_reservations"("status");

-- CreateIndex
CREATE INDEX "restaurant_reservations_service_period_id_idx" ON "restaurant_reservations"("service_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_reservations_location_id_creation_key_key" ON "restaurant_reservations"("location_id", "creation_key");

-- CreateIndex
CREATE INDEX "table_assignments_table_id_idx" ON "table_assignments"("table_id");

-- AddForeignKey
ALTER TABLE "dining_areas" ADD CONSTRAINT "dining_areas_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "dining_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_periods" ADD CONSTRAINT "service_periods_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "service_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_assignments" ADD CONSTRAINT "table_assignments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "restaurant_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_assignments" ADD CONSTRAINT "table_assignments_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_assignments" ADD CONSTRAINT "table_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE dining_areas ADD CONSTRAINT dining_areas_name CHECK (btrim(name) <> '');
ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_values CHECK (capacity > 0 AND btrim(name) <> '');
ALTER TABLE service_periods ADD CONSTRAINT service_periods_values CHECK (weekday BETWEEN 0 AND 6 AND default_duration_minutes > 0 AND btrim(name) <> '' AND (ends_next_day OR time_to > time_from));
ALTER TABLE restaurant_reservations ADD CONSTRAINT restaurant_reservations_values CHECK (party_size > 0 AND ends_at > starts_at AND btrim(creation_key) <> '' AND length(creation_fingerprint) = 64);

CREATE FUNCTION food_ownership_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc uuid; org uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'dining_areas', 'service_periods' THEN
  loc := NEW.location_id;
  IF TG_OP = 'UPDATE' THEN
   IF NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Food parent is immutable'; END IF;
  END IF;
 WHEN 'dining_tables' THEN
  SELECT location_id INTO loc FROM dining_areas WHERE id = NEW.area_id;
  IF TG_OP = 'UPDATE' THEN
   IF NEW.area_id <> OLD.area_id THEN RAISE EXCEPTION 'Food parent is immutable'; END IF;
  END IF;
 WHEN 'restaurant_reservations' THEN
  loc := NEW.location_id;
  IF TG_OP = 'UPDATE' THEN
   IF NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Food parent is immutable'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM service_periods WHERE id = NEW.service_period_id AND location_id = loc) THEN RAISE EXCEPTION 'Food period belongs to another location'; END IF;
 WHEN 'table_assignments' THEN
  IF TG_OP = 'UPDATE' THEN
   IF NEW.reservation_id <> OLD.reservation_id THEN RAISE EXCEPTION 'Food parent is immutable'; END IF;
  END IF;
  SELECT location_id INTO loc FROM restaurant_reservations WHERE id = NEW.reservation_id;
  IF NOT EXISTS (SELECT 1 FROM dining_tables t JOIN dining_areas a ON a.id=t.area_id WHERE t.id=NEW.table_id AND a.location_id=loc) THEN RAISE EXCEPTION 'Food table belongs to another location'; END IF;
 END CASE;
 SELECT b.organization_id INTO org FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=loc AND b.vertical='FOOD_SERVICE';
 IF org IS NULL THEN RAISE EXCEPTION 'Food location required'; END IF;
 IF TG_TABLE_NAME = 'restaurant_reservations' THEN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id=NEW.customer_id AND organization_id=org) THEN RAISE EXCEPTION 'Food customer belongs to another organization'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION food_seated_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid uuid;
BEGIN
 IF TG_TABLE_NAME = 'restaurant_reservations' THEN rid := NEW.id;
 ELSIF TG_OP = 'DELETE' THEN rid := OLD.reservation_id;
 ELSE rid := NEW.reservation_id;
 END IF;
 IF EXISTS (SELECT 1 FROM restaurant_reservations r WHERE r.id=rid AND r.status='SEATED' AND NOT EXISTS (SELECT 1 FROM table_assignments a WHERE a.reservation_id=r.id)) THEN RAISE EXCEPTION 'Seated reservation requires a table'; END IF;
 RETURN NULL;
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.food_ownership_guard() SET search_path = %s',s,path);
 EXECUTE format('ALTER FUNCTION %I.food_seated_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['dining_areas','dining_tables','service_periods','restaurant_reservations','table_assignments'] LOOP
  EXECUTE format('CREATE TRIGGER food_ownership_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION food_ownership_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wetop_app, wetop_service',t);
 END LOOP;
END $$;
CREATE CONSTRAINT TRIGGER food_seated_guard AFTER INSERT OR UPDATE ON restaurant_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION food_seated_guard();
CREATE CONSTRAINT TRIGGER food_seated_guard AFTER INSERT OR UPDATE OR DELETE ON table_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION food_seated_guard();

CREATE POLICY rls_tenant ON dining_areas TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON dining_tables TO wetop_app USING (EXISTS (SELECT 1 FROM dining_areas a WHERE a.id=area_id));
CREATE POLICY rls_tenant ON service_periods TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON restaurant_reservations TO wetop_app USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON table_assignments TO wetop_app USING (EXISTS (SELECT 1 FROM restaurant_reservations r WHERE r.id=reservation_id) AND EXISTS (SELECT 1 FROM dining_tables t WHERE t.id=table_id));
