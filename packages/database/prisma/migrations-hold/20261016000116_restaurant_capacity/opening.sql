-- Part of held 116, applied AFTER migration.sql. Approved DATA_MODEL 49.4 / plan 10.3.
CREATE TABLE restaurant_opening_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES locations(id),
 area_id uuid REFERENCES dining_areas(id), timezone text NOT NULL,
 effective_from date NOT NULL,effective_to date NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), valid_to timestamptz,
 recorded_by_id uuid, CHECK(effective_to>=effective_from AND effective_to-effective_from<=366)
);
CREATE UNIQUE INDEX opening_current ON restaurant_opening_schedules(location_id) WHERE valid_to IS NULL;
CREATE TABLE restaurant_opening_intervals (
 schedule_id uuid NOT NULL REFERENCES restaurant_opening_schedules(id),
 weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6),local_start time NOT NULL,local_end time NOT NULL,
 ends_next_day boolean NOT NULL,CHECK(ends_next_day OR local_end>local_start),
 CHECK(NOT ends_next_day OR local_end<=local_start)
);
CREATE TABLE restaurant_opening_closures (
 schedule_id uuid NOT NULL REFERENCES restaurant_opening_schedules(id),day date NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 PRIMARY KEY(schedule_id,day)
);
CREATE FUNCTION restaurant_local_instant(local_value timestamp,zone text) RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
DECLARE result timestamptz; n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'INVALID_TIMEZONE'; END IF;
 -- Candidate offsets surrounding transition, verify round-trip and uniqueness.
 WITH offsets AS (SELECT DISTINCT (t AT TIME ZONE zone)-(t AT TIME ZONE 'UTC') AS off
 FROM generate_series((local_value AT TIME ZONE 'UTC')-interval '48 hours',(local_value AT TIME ZONE 'UTC')+interval '48 hours',interval '1 hour') t),
 candidates AS (SELECT DISTINCT (local_value-off) AT TIME ZONE 'UTC' AS t FROM offsets)
 SELECT count(*),min(t) INTO n,result FROM candidates WHERE t AT TIME ZONE zone=local_value;
 IF n<>1 THEN RAISE EXCEPTION 'LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS: % %',local_value,zone; END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION capture_restaurant_capacity(target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE observed timestamptz; revision uuid:=gen_random_uuid(); zone text; schedule restaurant_opening_schedules%ROWTYPE; horizon timestamptz;
BEGIN
 SELECT timezone INTO STRICT zone FROM locations WHERE id=target FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=target AND b.vertical='FOOD_SERVICE') THEN RAISE EXCEPTION 'restaurant required'; END IF;
 observed:=clock_timestamp();
 INSERT INTO workload_tracking_coverage(location_id,observed_at) VALUES(target,observed) ON CONFLICT DO NOTHING;
 UPDATE resource_capacity_revisions SET valid_to=observed WHERE location_id=target AND valid_to IS NULL;
 INSERT INTO resource_capacity_revisions(location_id,table_id,active,valid_from,observed_at,timezone,source_revision)
 SELECT target,t.id,t.active AND a.active,observed,observed,zone,revision FROM dining_tables t JOIN dining_areas a ON a.id=t.area_id WHERE a.location_id=target;
 UPDATE workload_coverage_segments SET to_utc=least(coalesce(to_utc,observed),observed) WHERE location_id=target AND (to_utc IS NULL OR to_utc>observed);
 SELECT * INTO schedule FROM restaurant_opening_schedules WHERE location_id=target AND valid_to IS NULL;
 IF schedule.id IS NULL OR schedule.timezone<>zone THEN
 INSERT INTO workload_coverage_segments(location_id,from_utc,state,reason,source_revision) VALUES(target,observed,'UNAVAILABLE','OPENING_SCHEDULE_NOT_CONFIRMED',revision::text);RETURN;
 END IF;
 horizon:=restaurant_local_instant((schedule.effective_to+1)::timestamp,zone);
 -- Union overlapping opening windows; subtract closures as actual local calendar days, including overnight spill.
 INSERT INTO resource_capacity_intervals(revision_id,location_id,table_id,local_date,timezone,starts_at,ends_at,source_revision)
 WITH openings AS (
 SELECT range_agg(tstzrange(restaurant_local_instant(d::date+i.local_start,zone),restaurant_local_instant(d::date+i.local_end+CASE WHEN i.ends_next_day THEN interval '1 day' ELSE interval '0 day' END,zone),'[)')) AS spans
 FROM generate_series(schedule.effective_from::timestamp,schedule.effective_to::timestamp,interval '1 day') d
 JOIN restaurant_opening_intervals i ON i.schedule_id=schedule.id AND i.weekday=extract(dow FROM d)
 ), closed AS (
 SELECT range_agg(tstzrange(restaurant_local_instant(c.day::timestamp,zone),restaurant_local_instant((c.day+1)::timestamp,zone),'[)')) AS spans FROM restaurant_opening_closures c WHERE c.schedule_id=schedule.id
 ), available AS (SELECT unnest(coalesce(o.spans,'{}'::tstzmultirange)-coalesce(c.spans,'{}'::tstzmultirange)) AS span FROM openings o CROSS JOIN closed c)
 SELECT r.id,target,r.table_id,(lower(a.span) AT TIME ZONE zone)::date,zone,greatest(lower(a.span),observed),upper(a.span),revision
 FROM resource_capacity_revisions r JOIN dining_tables t ON t.id=r.table_id CROSS JOIN available a
 WHERE r.location_id=target AND r.source_revision=revision AND r.active AND (schedule.area_id IS NULL OR t.area_id=schedule.area_id) AND upper(a.span)>greatest(lower(a.span),observed);
 IF horizon>observed THEN
 INSERT INTO workload_coverage_segments(location_id,from_utc,to_utc,state,reason,source_revision)
 VALUES(target,greatest(observed,restaurant_local_instant(schedule.effective_from::timestamp,zone)),horizon,CASE WHEN schedule.area_id IS NULL THEN 'COMPLETE' ELSE 'UNAVAILABLE' END,CASE WHEN schedule.area_id IS NULL THEN NULL ELSE 'AREA_SCOPE_NOT_FULL_LOCATION' END,revision::text);
 END IF;
END $$;
CREATE FUNCTION confirm_restaurant_opening(target uuid,payload jsonb,actor uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE zone text; sid uuid; a uuid; first_day date; last_day date; item jsonb; d date;
BEGIN
 SELECT timezone INTO STRICT zone FROM locations WHERE id=target FOR UPDATE;
 a:=(payload->>'areaId')::uuid; first_day:=(payload->>'effectiveFrom')::date;last_day:=(payload->>'effectiveTo')::date;
 IF first_day IS NULL OR last_day IS NULL OR first_day>last_day OR last_day-first_day>366 OR last_day<(clock_timestamp() AT TIME ZONE zone)::date THEN RAISE EXCEPTION 'INVALID_EFFECTIVE_DATES'; END IF;
 IF a IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dining_areas WHERE id=a AND location_id=target) THEN RAISE EXCEPTION 'AREA_OUT_OF_SCOPE'; END IF;
 IF jsonb_typeof(payload->'intervals') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'closures') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'intervals')>100 OR jsonb_array_length(payload->'closures')>367 THEN RAISE EXCEPTION 'INVALID_OPENING_PAYLOAD'; END IF;
 UPDATE restaurant_opening_schedules SET valid_to=clock_timestamp() WHERE location_id=target AND valid_to IS NULL;
 INSERT INTO restaurant_opening_schedules(location_id,area_id,timezone,effective_from,effective_to,recorded_by_id) VALUES(target,a,zone,first_day,last_day,actor) RETURNING id INTO sid;
 FOR item IN SELECT * FROM jsonb_array_elements(payload->'intervals') LOOP
 IF (item->>'localStart') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR (item->>'localEnd') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR jsonb_typeof(item->'endsNextDay') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_LOCAL_INTERVAL'; END IF;
 INSERT INTO restaurant_opening_intervals VALUES(sid,(item->>'weekday')::integer,(item->>'localStart')::time,(item->>'localEnd')::time,(item->>'endsNextDay')::boolean);
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(payload->'closures') LOOP
 d:=(item->>'day')::date;
 IF d<first_day OR d>last_day+1 THEN RAISE EXCEPTION 'CLOSURE_OUTSIDE_SCHEDULE'; END IF;
 INSERT INTO restaurant_opening_closures VALUES(sid,d,item->>'reason');
 END LOOP;
 PERFORM capture_restaurant_capacity(target);
 RETURN sid;
END $$;
-- No booking-setting equivalence: edits there must not create capacity revisions.
DROP TRIGGER capacity_period_change ON service_periods;
DROP TRIGGER capacity_closed_day_change ON food_closed_days;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['restaurant_opening_schedules','restaurant_opening_intervals','restaurant_opening_closures'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 IF tab='restaurant_opening_schedules' THEN
 EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()))',tab);
 ELSE
 EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING(EXISTS(SELECT 1 FROM restaurant_opening_schedules s WHERE s.id=schedule_id)) WITH CHECK(EXISTS(SELECT 1 FROM restaurant_opening_schedules s WHERE s.id=schedule_id))',tab);
 END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON restaurant_opening_schedules TO wetop_app;
GRANT SELECT,INSERT ON restaurant_opening_intervals,restaurant_opening_closures,resource_capacity_intervals TO wetop_app;
REVOKE ALL ON FUNCTION confirm_restaurant_opening(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_restaurant_opening(uuid,jsonb,uuid) TO wetop_app;

-- Bind only this migration's owned routines to the actual application schema.
DO $owner_home_search_path$
DECLARE target_schema text := current_schema(); routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=target_schema AND p.proname=ANY(ARRAY['capture_restaurant_capacity','confirm_restaurant_opening','restaurant_local_instant'])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public, pg_temp',routine.signature,target_schema);
  END LOOP;
END
$owner_home_search_path$;
