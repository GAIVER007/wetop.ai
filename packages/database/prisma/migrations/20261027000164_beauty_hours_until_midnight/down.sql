-- Откат 20261027000164: прежние функции 20261018000137 (конец до 23:59, запись в пределах одной даты).
-- Если в каком-то салоне уже сохранён конец «24:00», сначала поменяйте его в «Настройках салона» на 23:59:
-- иначе строка beauty_location_hours не пройдёт прежнюю проверку при следующем сохранении.
BEGIN;

CREATE OR REPLACE FUNCTION beauty_location_hours_valid(data jsonb) RETURNS boolean
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

CREATE OR REPLACE FUNCTION beauty_time_in_hours(p_start timestamptz, p_end timestamptz, zone text, hours jsonb)
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

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_location_hours_valid(jsonb) SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_time_in_hours(timestamptz,timestamptz,text,jsonb) SET search_path = %s',s,path);
END $$;

COMMIT;
