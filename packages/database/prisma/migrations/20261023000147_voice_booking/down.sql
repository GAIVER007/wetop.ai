-- Откат 147: только пока голосовыми котировками не пользовались. Брони, записи и столы с источником VOICE откат переводит
-- в ближайший прежний источник (номера в PHONE, столы и записи в DESK): перечисления пересоздаются без нового значения.
-- Перед откатом снять копию (`docs/deploy.md`).
BEGIN;
LOCK TABLE "seller_booking_intents", "voice_profiles", "reservations", "restaurant_reservations", "appointments" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "seller_booking_intents" WHERE "channel" = 'voice') THEN
    RAISE EXCEPTION 'Voice booking quotes exist: export them before rollback of 147';
  END IF;
END $$;
ALTER TABLE "seller_booking_intents" DROP CONSTRAINT "seller_booking_intents_channel";
ALTER TABLE "seller_booking_intents"
  ADD CONSTRAINT "seller_booking_intents_channel" CHECK ("channel" IN ('whatsapp', 'widget'));
ALTER TABLE "voice_profiles"
  DROP CONSTRAINT "voice_profiles_booking_max_per_phone_day",
  DROP CONSTRAINT "voice_profiles_booking_max_per_call",
  DROP COLUMN "booking_max_per_phone_day",
  DROP COLUMN "booking_max_per_call",
  DROP COLUMN "booking_needs_approval",
  DROP COLUMN "booking_enabled";

UPDATE "reservations" SET "source" = 'PHONE' WHERE "source"::text = 'VOICE';
ALTER TYPE "ReservationSource" RENAME TO "ReservationSource_old";
CREATE TYPE "ReservationSource" AS ENUM ('DESK', 'PHONE', 'WHATSAPP', 'WALK_IN', 'INSTAGRAM', 'OTA', 'WEBSITE');
ALTER TABLE "reservations" ALTER COLUMN "source" TYPE "ReservationSource" USING ("source"::text::"ReservationSource");
DROP TYPE "ReservationSource_old";

UPDATE "restaurant_reservations" SET "source" = 'DESK' WHERE "source"::text = 'VOICE';
ALTER TABLE "restaurant_reservations" ALTER COLUMN "source" DROP DEFAULT;
ALTER TYPE "RestaurantReservationSource" RENAME TO "RestaurantReservationSource_old";
CREATE TYPE "RestaurantReservationSource" AS ENUM ('DESK', 'WALK_IN', 'WEBSITE');
ALTER TABLE "restaurant_reservations" ALTER COLUMN "source" TYPE "RestaurantReservationSource" USING ("source"::text::"RestaurantReservationSource");
ALTER TABLE "restaurant_reservations" ALTER COLUMN "source" SET DEFAULT 'DESK';
DROP TYPE "RestaurantReservationSource_old";

UPDATE "appointments" SET "source" = 'DESK' WHERE "source"::text = 'VOICE';
ALTER TABLE "appointments" ALTER COLUMN "source" DROP DEFAULT;
ALTER TYPE "AppointmentSource" RENAME TO "AppointmentSource_old";
CREATE TYPE "AppointmentSource" AS ENUM ('DESK', 'WEBSITE');
ALTER TABLE "appointments" ALTER COLUMN "source" TYPE "AppointmentSource" USING ("source"::text::"AppointmentSource");
ALTER TABLE "appointments" ALTER COLUMN "source" SET DEFAULT 'DESK';
DROP TYPE "AppointmentSource_old";
COMMIT;
