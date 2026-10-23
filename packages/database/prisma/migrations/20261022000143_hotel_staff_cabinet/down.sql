-- Откат 143: теряются назначения «Кто убирает», сдельные ставки и привязка уборок к сотрудникам.
-- Журнал статусов уборки остаётся; user_id снова без FK (как до 143). Код до 143 эти столбцы не читает.
BEGIN;
DROP TRIGGER IF EXISTS hotel_housekeeping_event_employee_guard ON "housekeeping_events";
DROP TRIGGER IF EXISTS hotel_housekeeping_assignee_guard ON "inventory_units";
DROP FUNCTION IF EXISTS hotel_housekeeping_employee_guard();
ALTER TABLE "employee_pay_settings" DROP CONSTRAINT IF EXISTS "employee_pay_settings_per_cleaning_minor";
ALTER TABLE "employee_pay_settings" DROP COLUMN IF EXISTS "per_cleaning_minor";
DROP INDEX IF EXISTS "inventory_units_housekeeping_assignee_id_idx";
ALTER TABLE "inventory_units" DROP CONSTRAINT IF EXISTS "inventory_units_housekeeping_assignee_id_fkey";
ALTER TABLE "inventory_units" DROP COLUMN IF EXISTS "housekeeping_assignee_id";
DROP INDEX IF EXISTS "housekeeping_events_employee_id_created_at_idx";
ALTER TABLE "housekeeping_events" DROP CONSTRAINT IF EXISTS "housekeeping_events_employee_id_fkey";
ALTER TABLE "housekeeping_events" DROP COLUMN IF EXISTS "employee_id";
ALTER TABLE "housekeeping_events" DROP CONSTRAINT IF EXISTS "housekeeping_events_user_id_fkey";
COMMIT;
