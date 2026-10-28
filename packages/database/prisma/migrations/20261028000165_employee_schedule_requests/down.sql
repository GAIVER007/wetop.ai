-- Откат 165: только пока запросов графика нет. Историю решений ради отката не удаляют.
BEGIN;
LOCK TABLE "employee_schedule_requests" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "employee_schedule_requests") THEN
    RAISE EXCEPTION 'Schedule requests are in use: export them before rollback of 165';
  END IF;
END $$;
DROP TABLE "employee_schedule_requests";
DROP FUNCTION employee_schedule_requests_guard();
DROP TYPE "ScheduleRequestStatus";
DROP TYPE "ScheduleRequestKind";
COMMIT;
