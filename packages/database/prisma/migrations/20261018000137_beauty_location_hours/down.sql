BEGIN;
LOCK TABLE beauty_location_hours, appointment_lines IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM beauty_location_hours) THEN
    RAISE EXCEPTION 'Export salon opening hours before rollback';
  END IF;
END $$;
DROP TRIGGER beauty_appointment_location_hours_guard ON appointment_lines;
DROP FUNCTION beauty_appointment_location_hours_guard();
DROP FUNCTION beauty_time_in_hours(timestamptz, timestamptz, text, jsonb);
DROP TABLE beauty_location_hours;
DROP FUNCTION beauty_location_hours_guard();
DROP FUNCTION beauty_location_hours_valid(jsonb);
COMMIT;
