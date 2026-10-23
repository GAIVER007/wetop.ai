-- Откат 146: только пока голосовыми котировками не пользовались. Значения VOICE в enum PostgreSQL не удаляет:
-- они остаются неиспользуемыми (брони с источником VOICE ради отката не переписываются).
BEGIN;
LOCK TABLE "seller_booking_intents", "voice_profiles" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "seller_booking_intents" WHERE "channel" = 'voice') THEN
    RAISE EXCEPTION 'Voice booking quotes exist: export them before rollback of 146';
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
COMMIT;
