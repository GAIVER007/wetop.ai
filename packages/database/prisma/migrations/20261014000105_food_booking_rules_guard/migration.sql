-- Стража правил брони столов (DATA_MODEL §43, ADR-182): миграция 101 вышла без неё.
-- Локация обеих таблиц принадлежит бизнесу FOOD_SERVICE, родительский филиал неизменяем
-- (образец: food_ownership_guard миграции 58). Чинится вперёд: 101 уже применена на рабочей базе.

CREATE FUNCTION food_booking_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org uuid;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN
  RAISE EXCEPTION 'Food parent is immutable';
 END IF;
 SELECT b.organization_id INTO org
   FROM locations l JOIN businesses b ON b.id = l.business_id
  WHERE l.id = NEW.location_id AND b.vertical = 'FOOD_SERVICE';
 IF org IS NULL THEN RAISE EXCEPTION 'Food location required'; END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text; t text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.food_booking_guard() SET search_path = %s',s,path);
 FOREACH t IN ARRAY ARRAY['food_booking_rules','food_closed_days'] LOOP
  EXECUTE format('CREATE TRIGGER food_booking_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION food_booking_guard()',t);
 END LOOP;
END $$;
