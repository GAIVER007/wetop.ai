-- Откат 150: суточный лимит на телефон перестаёт считаться (остаётся лимит за звонок). На брони не влияет.
BEGIN;
DROP INDEX "voice_booking_quotes_phone_hash_idx";
ALTER TABLE "voice_booking_quotes"
  DROP CONSTRAINT "voice_booking_quotes_phone_hash_confirmed",
  DROP CONSTRAINT "voice_booking_quotes_phone_hash_format",
  DROP COLUMN "guest_phone_hash";
DROP INDEX "seller_booking_intents_phone_hash_idx";
ALTER TABLE "seller_booking_intents"
  DROP CONSTRAINT "seller_booking_intents_phone_hash_confirmed",
  DROP CONSTRAINT "seller_booking_intents_phone_hash_format",
  DROP COLUMN "guest_phone_hash";
COMMIT;
