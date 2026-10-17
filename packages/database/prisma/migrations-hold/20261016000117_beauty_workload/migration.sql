-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (../README.md): only after exact release approval, verified restore and compatible writers.
-- HELD, local-only evidence. Explicit opt-in; never synthesize historical events.
CREATE TABLE beauty_schedule_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),location_id uuid NOT NULL REFERENCES locations(id),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(), timezone text NOT NULL,
 effective_from date NOT NULL,effective_to date NOT NULL, CHECK(effective_to>=effective_from),UNIQUE(id,location_id)
);
CREATE TABLE beauty_capacity_intervals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL,location_id uuid NOT NULL REFERENCES locations(id),
 employee_id uuid NOT NULL REFERENCES employees(id),local_date date NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 FOREIGN KEY(version_id,location_id) REFERENCES beauty_schedule_versions(id,location_id),CHECK(ends_at>starts_at)
);
CREATE INDEX beauty_capacity_window ON beauty_capacity_intervals(location_id,local_date);
CREATE TABLE appointment_workload_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),appointment_id uuid NOT NULL REFERENCES appointments(id),
 location_id uuid NOT NULL REFERENCES locations(id),employee_id uuid NOT NULL REFERENCES employees(id),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revision bigint GENERATED ALWAYS AS IDENTITY,correction_reason text,
 CHECK(ends_at>starts_at),CHECK(status IN ('BOOKED','CONFIRMED','IN_PROGRESS','DONE','CANCELLED','NO_SHOW'))
);
CREATE INDEX beauty_appointment_history ON appointment_workload_revisions(location_id,appointment_id,revision DESC);
CREATE FUNCTION capture_beauty_schedule(target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v uuid:=gen_random_uuid(); zone text; d date; observed timestamptz:=clock_timestamp();
BEGIN
 SELECT l.timezone INTO STRICT zone FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=target AND b.vertical='BEAUTY' FOR UPDATE OF l;
 d:=(observed AT TIME ZONE zone)::date;
 INSERT INTO beauty_schedule_versions(id,location_id,observed_at,timezone,effective_from,effective_to) VALUES(v,target,observed,zone,d,d+31);
 INSERT INTO beauty_capacity_intervals(version_id,location_id,employee_id,local_date,starts_at,ends_at)
 SELECT v,target,e.id,day::date,restaurant_local_instant(day::date+h.time_from,zone),restaurant_local_instant(day::date+h.time_to,zone)
 FROM employees e JOIN employee_locations el ON el.employee_id=e.id AND el.location_id=target
 JOIN working_hours h ON h.employee_id=e.id AND h.location_id=target
 CROSS JOIN generate_series(d::timestamp,(d+31)::timestamp,'1 day') day
 WHERE e.status='ACTIVE' AND h.weekday=extract(dow FROM day) AND h.time_to>h.time_from
 AND NOT EXISTS(SELECT 1 FROM time_offs t WHERE t.employee_id=e.id AND day::date BETWEEN t.date_from AND t.date_to);
 -- Existing appointments are observed now, not backdated to created_at.
 INSERT INTO appointment_workload_revisions(appointment_id,location_id,employee_id,starts_at,ends_at,status,recorded_at,effective_at)
 SELECT a.id,a.location_id,a.employee_id,a.starts_at,a.ends_at,a.status::text,observed,observed FROM appointments a
 WHERE a.location_id=target AND NOT EXISTS(SELECT 1 FROM appointment_workload_revisions r WHERE r.appointment_id=a.id);
END $$;
CREATE FUNCTION beauty_appointment_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.beauty_capture',true)='true' OR EXISTS(SELECT 1 FROM beauty_schedule_versions WHERE location_id=NEW.location_id) THEN
 INSERT INTO appointment_workload_revisions(appointment_id,location_id,employee_id,starts_at,ends_at,status)
 VALUES(NEW.id,NEW.location_id,NEW.employee_id,NEW.starts_at,NEW.ends_at,NEW.status::text);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER beauty_appointment_history AFTER INSERT OR UPDATE OF starts_at,ends_at,status,employee_id ON appointments FOR EACH ROW EXECUTE FUNCTION beauty_appointment_changed();
-- SQL and website writers participate once a location starts tracking.
CREATE FUNCTION beauty_capacity_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; emp uuid;
BEGIN
 IF TG_TABLE_NAME='employees' THEN emp:=coalesce(NEW.id,OLD.id);
 ELSIF TG_TABLE_NAME='locations' THEN
 target:=NEW.id;
 IF EXISTS(SELECT 1 FROM beauty_schedule_versions WHERE location_id=target) THEN PERFORM capture_beauty_schedule(target); END IF;
 RETURN NEW;
 ELSE emp:=coalesce(NEW.employee_id,OLD.employee_id); END IF;
 FOR target IN SELECT DISTINCT s.location_id FROM beauty_schedule_versions s JOIN locations l ON l.id=s.location_id JOIN employees e ON e.business_id=l.business_id WHERE e.id=emp ORDER BY s.location_id LOOP
 PERFORM capture_beauty_schedule(target);
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER beauty_hours_history AFTER INSERT OR UPDATE OR DELETE ON working_hours FOR EACH ROW EXECUTE FUNCTION beauty_capacity_changed();
CREATE TRIGGER beauty_absence_history AFTER INSERT OR UPDATE OR DELETE ON time_offs FOR EACH ROW EXECUTE FUNCTION beauty_capacity_changed();
CREATE TRIGGER beauty_assignment_history AFTER INSERT OR UPDATE OR DELETE ON employee_locations FOR EACH ROW EXECUTE FUNCTION beauty_capacity_changed();
CREATE TRIGGER beauty_employee_history AFTER UPDATE OF status ON employees FOR EACH ROW EXECUTE FUNCTION beauty_capacity_changed();
CREATE TRIGGER beauty_zone_history AFTER UPDATE OF timezone,status ON locations FOR EACH ROW EXECUTE FUNCTION beauty_capacity_changed();
CREATE FUNCTION beauty_history_tenant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'BEAUTY_HISTORY_IMMUTABLE'; END IF;
 IF TG_TABLE_NAME<>'beauty_schedule_versions' THEN
 IF NOT EXISTS(SELECT 1 FROM employees e JOIN locations l ON l.business_id=e.business_id WHERE e.id=NEW.employee_id AND l.id=NEW.location_id) THEN RAISE EXCEPTION 'BEAUTY_HISTORY_SCOPE'; END IF;
 END IF;
 IF TG_TABLE_NAME='appointment_workload_revisions' THEN
 IF NOT EXISTS(SELECT 1 FROM appointments a WHERE a.id=NEW.appointment_id AND a.location_id=NEW.location_id AND a.employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'BEAUTY_HISTORY_APPOINTMENT_SCOPE'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['beauty_schedule_versions','beauty_capacity_intervals','appointment_workload_revisions'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()))',tab);
 EXECUTE format('CREATE TRIGGER beauty_history_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION beauty_history_tenant_guard()',tab);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO wetop_app',tab);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE appointment_workload_revisions_revision_seq TO wetop_app;
REVOKE ALL ON FUNCTION capture_beauty_schedule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_beauty_schedule(uuid) TO wetop_app;

-- Bind only this migration's owned routines to the actual application schema.
DO $owner_home_search_path$
DECLARE target_schema text := current_schema(); routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=target_schema AND p.proname=ANY(ARRAY['beauty_appointment_changed','beauty_capacity_changed','beauty_history_tenant_guard','capture_beauty_schedule'])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public, pg_temp',routine.signature,target_schema);
  END LOOP;
END
$owner_home_search_path$;
