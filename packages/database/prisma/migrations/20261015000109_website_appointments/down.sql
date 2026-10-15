-- Откат SITE-4 (20261015000109_website_appointments). Источник и ключ записей теряются (записи остаются). Брони столов
-- с источником WEBSITE откат переводит в DESK: перечисление пересоздаётся без нового значения.
-- Перед откатом снять копию (`docs/deploy.md`).
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_creation_pair";
DROP INDEX IF EXISTS "appointments_location_id_creation_key_key";
ALTER TABLE "appointments" DROP COLUMN IF EXISTS "creation_fingerprint";
ALTER TABLE "appointments" DROP COLUMN IF EXISTS "creation_key";
ALTER TABLE "appointments" DROP COLUMN IF EXISTS "source";
DROP TYPE IF EXISTS "AppointmentSource";

UPDATE "restaurant_reservations" SET "source" = 'DESK' WHERE "source"::text = 'WEBSITE';
ALTER TABLE "restaurant_reservations" ALTER COLUMN "source" DROP DEFAULT;
ALTER TYPE "RestaurantReservationSource" RENAME TO "RestaurantReservationSource_old";
CREATE TYPE "RestaurantReservationSource" AS ENUM ('DESK', 'WALK_IN');
ALTER TABLE "restaurant_reservations" ALTER COLUMN "source" TYPE "RestaurantReservationSource" USING ("source"::text::"RestaurantReservationSource");
ALTER TABLE "restaurant_reservations" ALTER COLUMN "source" SET DEFAULT 'DESK';
DROP TYPE "RestaurantReservationSource_old";
