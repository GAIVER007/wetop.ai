BEGIN;
LOCK TABLE appointments, appointment_lines, employee_service_prices IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM employee_service_prices) THEN
    RAISE EXCEPTION 'Rollback blocked: employee service prices exist';
  END IF;
  IF EXISTS (
    SELECT a.id FROM appointments a
    LEFT JOIN appointment_lines l ON l.appointment_id = a.id
    GROUP BY a.id HAVING count(l.id) <> 1
  ) THEN RAISE EXCEPTION 'Rollback blocked: multi-line or missing-line appointments exist'; END IF;
  IF EXISTS (
    SELECT 1 FROM appointments a JOIN appointment_lines l ON l.appointment_id = a.id
    WHERE l.position <> 0 OR l.employee_id <> a.employee_id OR l.service_id <> a.service_id
      OR l.starts_at <> a.starts_at OR l.ends_at <> a.ends_at OR l.price_minor <> a.price
      OR l.currency <> a.currency OR l.discount_minor <> 0 OR l.surcharge_minor <> 0
  ) THEN RAISE EXCEPTION 'Rollback blocked: appointment line history cannot be represented by legacy appointments'; END IF;
END $$;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap_per_employee
  EXCLUDE USING gist (employee_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

DROP TRIGGER "appointments_status_overlap_guard" ON appointments;
DROP FUNCTION beauty_appointment_status_overlap_guard();
DROP TRIGGER "appointments_legacy_line_sync" ON appointments;
DROP FUNCTION beauty_appointment_legacy_sync();
DROP TRIGGER "appointment_lines_guard" ON appointment_lines;
DROP FUNCTION beauty_appointment_line_guard();
DROP TRIGGER "employee_service_prices_guard" ON employee_service_prices;
DROP FUNCTION beauty_employee_service_price_guard();
DROP TABLE appointment_lines;
DROP TABLE employee_service_prices;
DROP TYPE "EmployeeServicePriceType";
COMMIT;
