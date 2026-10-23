-- 151 Хэш телефона голосовой брони для суточного лимита (DATA_MODEL VOICE-PHONE-LIMIT-OWNER-APPROVAL-20261023). Только добавление.
-- Хэш: HMAC-SHA256 канонического номера с серверным секретом (VOICE_PHONE_HASH_KEY), номер в открытом виде сюда не пишется.
-- Ставится вместе с подтверждением брони, обнуляется приложением через 7 дней. Окно лимита: скользящие 24 часа на агента.
BEGIN;

ALTER TABLE "seller_booking_intents"
  ADD COLUMN "guest_phone_hash" CHAR(64),
  ADD CONSTRAINT "seller_booking_intents_phone_hash_format" CHECK ("guest_phone_hash" IS NULL OR "guest_phone_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "seller_booking_intents_phone_hash_confirmed" CHECK ("guest_phone_hash" IS NULL OR "state" = 'CONFIRMED');
CREATE INDEX "seller_booking_intents_phone_hash_idx" ON "seller_booking_intents" ("agent_id", "guest_phone_hash", "updated_at") WHERE "guest_phone_hash" IS NOT NULL;

ALTER TABLE "voice_booking_quotes"
  ADD COLUMN "guest_phone_hash" CHAR(64),
  ADD CONSTRAINT "voice_booking_quotes_phone_hash_format" CHECK ("guest_phone_hash" IS NULL OR "guest_phone_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "voice_booking_quotes_phone_hash_confirmed" CHECK ("guest_phone_hash" IS NULL OR "state" = 'CONFIRMED');
CREATE INDEX "voice_booking_quotes_phone_hash_idx" ON "voice_booking_quotes" ("agent_id", "guest_phone_hash", "updated_at") WHERE "guest_phone_hash" IS NOT NULL;

COMMIT;
