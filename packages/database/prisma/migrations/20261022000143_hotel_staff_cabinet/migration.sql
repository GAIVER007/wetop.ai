-- 143 Кабинет горничной и ресепшена гостиницы (решение владельца 22.10.2026,
-- docs/decisions/2026-10-22-hotel-staff-cabinet.md, DATA_MODEL §4.1).
-- 1) Журнал уборки знает, кто нажал (user_id → users, до 143 без FK) и чья это уборка (employee_id → employees).
-- 2) Место номерного фонда знает, кто его убирает (housekeeping_assignee_id → employees).
-- 3) Сдельная ставка за уборку в условиях оплаты (per_cleaning_minor, тиыны, по умолчанию 0).
-- Сотрудник уборки и назначения того же бизнеса, что филиал объекта места (триггер).
-- Аддитивно: старый API новые столбцы не читает. GRANT/REVOKE нет: столбцы существующих таблиц покрыты их правами.
BEGIN;

-- user_id писался без FK: до ограничения обнуляем ссылки на несуществующих людей, иначе FK не встанет
UPDATE "housekeeping_events" h SET "user_id" = NULL
 WHERE h."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = h."user_id");
ALTER TABLE "housekeeping_events" ADD CONSTRAINT "housekeeping_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "housekeeping_events" ADD COLUMN "employee_id" UUID;
ALTER TABLE "housekeeping_events" ADD CONSTRAINT "housekeeping_events_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "housekeeping_events_employee_id_created_at_idx" ON "housekeeping_events"("employee_id", "created_at");

ALTER TABLE "inventory_units" ADD COLUMN "housekeeping_assignee_id" UUID;
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_housekeeping_assignee_id_fkey"
  FOREIGN KEY ("housekeeping_assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "inventory_units_housekeeping_assignee_id_idx" ON "inventory_units"("housekeeping_assignee_id");

ALTER TABLE "employee_pay_settings" ADD COLUMN "per_cleaning_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "employee_pay_settings" ADD CONSTRAINT "employee_pay_settings_per_cleaning_minor"
  CHECK ("per_cleaning_minor" >= 0);

-- Уборку делает и номер убирает только сотрудник того же бизнеса, что филиал объекта места
CREATE FUNCTION hotel_housekeeping_employee_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE emp uuid; unit uuid;
BEGIN
 IF TG_TABLE_NAME = 'inventory_units' THEN emp := NEW.housekeeping_assignee_id; unit := NEW.id;
 ELSE emp := NEW.employee_id; unit := NEW.inventory_unit_id; END IF;
 IF emp IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM employees e
     JOIN locations l ON l.business_id = e.business_id
     JOIN properties p ON p.location_id = l.id
     JOIN inventory_units iu ON iu.property_id = p.id
    WHERE e.id = emp AND iu.id = unit
 ) THEN RAISE EXCEPTION 'Housekeeping employee belongs to another business'; END IF;
 RETURN NEW;
END $$;
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.hotel_housekeeping_employee_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER hotel_housekeeping_assignee_guard BEFORE INSERT OR UPDATE OF "housekeeping_assignee_id", "property_id"
  ON "inventory_units" FOR EACH ROW EXECUTE FUNCTION hotel_housekeeping_employee_guard();
CREATE TRIGGER hotel_housekeeping_event_employee_guard BEFORE INSERT OR UPDATE OF "employee_id", "inventory_unit_id"
  ON "housekeeping_events" FOR EACH ROW EXECUTE FUNCTION hotel_housekeeping_employee_guard();

COMMIT;
