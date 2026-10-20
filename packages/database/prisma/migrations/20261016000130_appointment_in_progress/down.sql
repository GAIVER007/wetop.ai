-- Откат §58: значение из перечисления PostgreSQL не убирает, поэтому тип пересобирается без него.
-- Отказ, если начатые записи уже есть: без 130 им нет статуса.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM appointments WHERE status::text = 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Appointments in progress exist: rollback of 130 would lose their status';
  END IF;
END $$;
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_overlap_per_employee";
ALTER TABLE "appointments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_before_130";
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED');
ALTER TABLE "appointments" ALTER COLUMN "status" TYPE "AppointmentStatus" USING ("status"::text::"AppointmentStatus");
ALTER TABLE "appointments" ALTER COLUMN "status" SET DEFAULT 'BOOKED';
DROP TYPE "AppointmentStatus_before_130";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap_per_employee"
  EXCLUDE USING gist ("employee_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));
