-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (../README.md): only after exact release approval, verified restore and compatible writers.
-- HELD: observed capacity only; no import of ServicePeriod as opening hours.
CREATE TABLE workload_tracking_coverage (
 location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE RESTRICT,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 basis text NOT NULL DEFAULT 'ACTUAL_TABLE_OCCUPANCY' CHECK(basis='ACTUAL_TABLE_OCCUPANCY')
);
CREATE TABLE resource_capacity_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES locations(id),
 table_id uuid NOT NULL REFERENCES dining_tables(id), active boolean NOT NULL,
 valid_from timestamptz NOT NULL, valid_to timestamptz,
 observed_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 timezone text NOT NULL, source_revision uuid NOT NULL,
 CHECK(valid_to IS NULL OR valid_to>=valid_from),
 EXCLUDE USING gist(table_id WITH =,tstzrange(valid_from,valid_to,'[)') WITH &&)
);
CREATE UNIQUE INDEX capacity_current ON resource_capacity_revisions(table_id) WHERE valid_to IS NULL;
-- Proven UTC intervals only. No default 24h and no mutable configuration reconstruction.
CREATE TABLE resource_capacity_intervals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),revision_id uuid NOT NULL REFERENCES resource_capacity_revisions(id),
 location_id uuid NOT NULL REFERENCES locations(id),table_id uuid NOT NULL REFERENCES dining_tables(id),
 local_date date NOT NULL,timezone text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 source_revision uuid NOT NULL,CHECK(ends_at>starts_at),
 EXCLUDE USING gist(revision_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&)
);
CREATE TABLE workload_coverage_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),location_id uuid NOT NULL REFERENCES locations(id),
 basis text NOT NULL DEFAULT 'ACTUAL_TABLE_OCCUPANCY' CHECK(basis='ACTUAL_TABLE_OCCUPANCY'),
 unit text NOT NULL DEFAULT 'TABLE_MILLISECOND' CHECK(unit='TABLE_MILLISECOND'),
 from_utc timestamptz NOT NULL,to_utc timestamptz,
 state text NOT NULL CHECK(state IN ('COMPLETE','GAP','UNAVAILABLE')),
 reason text,source_revision text NOT NULL,CHECK(to_utc IS NULL OR to_utc>=from_utc)
);
CREATE INDEX capacity_intervals_window ON resource_capacity_intervals(location_id,starts_at,ends_at);
CREATE INDEX coverage_window ON workload_coverage_segments(location_id,from_utc,to_utc);
CREATE FUNCTION capture_restaurant_capacity(target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE observed timestamptz; revision uuid := gen_random_uuid(); zone text;
BEGIN
 SELECT timezone INTO STRICT zone FROM locations WHERE id=target FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=target AND b.vertical='FOOD_SERVICE') THEN RAISE EXCEPTION 'restaurant required'; END IF;
 observed:=clock_timestamp();
 INSERT INTO workload_tracking_coverage(location_id,observed_at) VALUES(target,observed) ON CONFLICT DO NOTHING;
 UPDATE resource_capacity_revisions SET valid_to=observed WHERE location_id=target AND valid_to IS NULL;
 INSERT INTO resource_capacity_revisions(location_id,table_id,active,valid_from,observed_at,timezone,source_revision)
 SELECT target,t.id,t.active AND a.active,observed,observed,zone,revision FROM dining_tables t JOIN dining_areas a ON a.id=t.area_id WHERE a.location_id=target;
 UPDATE workload_coverage_segments SET to_utc=observed WHERE location_id=target AND to_utc IS NULL;
 INSERT INTO workload_coverage_segments(location_id,from_utc,state,reason,source_revision)
 VALUES(target,observed,'UNAVAILABLE','OPENING_SCHEDULE_NOT_CONFIRMED',revision::text);
END $$;
-- All real SQL/Prisma catalog and booking-settings paths participate atomically once opted in.
CREATE FUNCTION capacity_setting_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_NAME='dining_tables' THEN
  SELECT location_id INTO target FROM dining_areas WHERE id=coalesce(NEW.area_id,OLD.area_id);
 ELSIF TG_TABLE_NAME='locations' THEN target:=NEW.id;
 ELSE target:=coalesce(NEW.location_id,OLD.location_id); END IF;
 IF EXISTS(SELECT 1 FROM workload_tracking_coverage WHERE location_id=target) THEN PERFORM capture_restaurant_capacity(target); END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER capacity_table_change AFTER INSERT OR UPDATE OF active,capacity,area_id OR DELETE ON dining_tables FOR EACH ROW EXECUTE FUNCTION capacity_setting_changed();
CREATE TRIGGER capacity_area_change AFTER UPDATE OF active ON dining_areas FOR EACH ROW EXECUTE FUNCTION capacity_setting_changed();
CREATE TRIGGER capacity_period_change AFTER INSERT OR UPDATE OR DELETE ON service_periods FOR EACH ROW EXECUTE FUNCTION capacity_setting_changed();
CREATE TRIGGER capacity_closed_day_change AFTER INSERT OR UPDATE OR DELETE ON food_closed_days FOR EACH ROW EXECUTE FUNCTION capacity_setting_changed();
CREATE TRIGGER capacity_timezone_change AFTER UPDATE OF timezone ON locations FOR EACH ROW WHEN(NEW.timezone IS DISTINCT FROM OLD.timezone) EXECUTE FUNCTION capacity_setting_changed();
ALTER TABLE workload_tracking_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_tracking_coverage FORCE ROW LEVEL SECURITY;
ALTER TABLE resource_capacity_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_capacity_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE resource_capacity_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_capacity_intervals FORCE ROW LEVEL SECURITY;
ALTER TABLE workload_coverage_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_coverage_segments FORCE ROW LEVEL SECURITY;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['workload_tracking_coverage','resource_capacity_revisions','resource_capacity_intervals','workload_coverage_segments'] LOOP
 EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()))',tab);
 END LOOP;
END $$;
GRANT SELECT,INSERT ON workload_tracking_coverage TO wetop_app;
GRANT SELECT,INSERT,UPDATE ON resource_capacity_revisions,workload_coverage_segments TO wetop_app;
GRANT SELECT ON resource_capacity_intervals TO wetop_app;
REVOKE ALL ON FUNCTION capture_restaurant_capacity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_restaurant_capacity(uuid) TO wetop_app;

-- Bind only this migration's owned routines to the actual application schema.
DO $owner_home_search_path$
DECLARE target_schema text := current_schema(); routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=target_schema AND p.proname=ANY(ARRAY['capacity_setting_changed','capture_restaurant_capacity'])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public, pg_temp',routine.signature,target_schema);
  END LOOP;
END
$owner_home_search_path$;
