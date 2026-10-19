-- ОТДЕЛЬНЫЙ РЕЛИЗ: BEAUTY-LOCATION-HOURS-20261018, owner-approved model.
BEGIN;

CREATE FUNCTION beauty_location_hours_valid(data jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(data) IS DISTINCT FROM 'array' OR jsonb_array_length(data) > 28 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(data) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'weekday') IS DISTINCT FROM 'number'
      OR (item->>'weekday') !~ '^[0-6]$'
      OR jsonb_typeof(item->'timeFrom') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'timeTo') IS DISTINCT FROM 'string'
      OR (item->>'timeFrom') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (item->>'timeTo') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (item->>'timeTo') <= (item->>'timeFrom') THEN RETURN false; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(data) a, jsonb_array_elements(data) b
    WHERE a <> b AND a->>'weekday' = b->>'weekday'
      AND a->>'timeFrom' < b->>'timeTo' AND b->>'timeFrom' < a->>'timeTo') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(data) a GROUP BY a->>'weekday' HAVING count(*) > 4) THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(data)) <> (SELECT count(DISTINCT value) FROM jsonb_array_elements(data)) THEN RETURN false; END IF;
  RETURN true;
END $$;

CREATE TABLE beauty_location_hours (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  intervals jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT beauty_location_hours_intervals_check CHECK (beauty_location_hours_valid(intervals))
);
CREATE FUNCTION beauty_location_hours_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Salon hours location is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=NEW.location_id AND b.vertical='BEAUTY') THEN
    RAISE EXCEPTION 'Salon hours require a Beauty location';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER beauty_location_hours_guard BEFORE INSERT OR UPDATE ON beauty_location_hours
  FOR EACH ROW EXECUTE FUNCTION beauty_location_hours_guard();

CREATE FUNCTION beauty_time_in_hours(p_start timestamptz, p_end timestamptz, zone text, hours jsonb)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (p_start AT TIME ZONE zone)::date = (p_end AT TIME ZONE zone)::date
    AND p_end > p_start AND COALESCE((
      SELECT range_agg(tsrange((p_start AT TIME ZONE zone)::date + (h->>'timeFrom')::time,
        (p_start AT TIME ZONE zone)::date + (h->>'timeTo')::time, '[)'))
          @> tsrange(p_start AT TIME ZONE zone, p_end AT TIME ZONE zone, '[)')
      FROM jsonb_array_elements(hours) h
      WHERE (h->>'weekday')::integer=extract(dow FROM p_start AT TIME ZONE zone)::integer
    ), false)
$$;

CREATE FUNCTION beauty_appointment_location_hours_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE hours jsonb; zone text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.appointment_id=OLD.appointment_id
    AND NEW.starts_at=OLD.starts_at AND NEW.ends_at=OLD.ends_at THEN RETURN NEW; END IF;
  SELECT h.intervals, l.timezone INTO hours, zone
    FROM appointments a JOIN locations l ON l.id=a.location_id
    LEFT JOIN beauty_location_hours h ON h.location_id=l.id
    WHERE a.id=NEW.appointment_id FOR SHARE OF l;
  IF hours IS NULL THEN RETURN NEW; END IF;
  IF NOT beauty_time_in_hours(NEW.starts_at, NEW.ends_at, zone, hours) THEN
    RAISE EXCEPTION 'Время записи находится вне режима работы салона' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER beauty_appointment_location_hours_guard BEFORE INSERT OR UPDATE ON appointment_lines
  FOR EACH ROW EXECUTE FUNCTION beauty_appointment_location_hours_guard();
ALTER TABLE beauty_location_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_location_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON beauty_location_hours FOR SELECT TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id
  WHERE l.id=beauty_location_hours.location_id AND b.organization_id=app_current_org()
));
REVOKE ALL ON beauty_location_hours FROM wetop_app, wetop_service;
GRANT SELECT ON beauty_location_hours TO wetop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_location_hours TO wetop_service;
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_location_hours_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_appointment_location_hours_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_location_hours_valid(jsonb) SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_time_in_hours(timestamptz,timestamptz,text,jsonb) SET search_path = %s',s,path);
END $$;

COMMIT;
