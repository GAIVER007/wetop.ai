-- Откат 168: записи с новыми источниками (Instagram, WhatsApp, звонок, пришёл сам) становятся DESK («Администратор»):
-- сама запись, клиент, деньги и время не теряются, теряется только отметка источника. Убрать значение из перечисления
-- PostgreSQL не умеет: тип пересоздаётся с прежними тремя значениями (как откат 139).
BEGIN;
LOCK TABLE "appointments" IN ACCESS EXCLUSIVE MODE;
UPDATE "appointments" SET "source" = 'DESK' WHERE "source"::text IN ('INSTAGRAM', 'WHATSAPP', 'PHONE', 'WALK_IN');
ALTER TABLE "appointments" ALTER COLUMN "source" DROP DEFAULT;
ALTER TYPE "AppointmentSource" RENAME TO "AppointmentSource_old";
CREATE TYPE "AppointmentSource" AS ENUM ('DESK', 'WEBSITE', 'VOICE');
ALTER TABLE "appointments" ALTER COLUMN "source" TYPE "AppointmentSource" USING ("source"::text::"AppointmentSource");
ALTER TABLE "appointments" ALTER COLUMN "source" SET DEFAULT 'DESK';
DROP TYPE "AppointmentSource_old";
COMMIT;
