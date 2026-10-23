-- 146 «Голосовая бронь, гостиница» (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Только добавление.
ALTER TYPE "ReservationSource" ADD VALUE IF NOT EXISTS 'VOICE';
ALTER TYPE "RestaurantReservationSource" ADD VALUE IF NOT EXISTS 'VOICE';
ALTER TYPE "AppointmentSource" ADD VALUE IF NOT EXISTS 'VOICE';

-- Выключатель и лимиты на объект: по умолчанию бронирование по телефону выключено, первую неделю бронь ждёт подтверждения
ALTER TABLE "voice_profiles"
  ADD COLUMN "booking_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "booking_needs_approval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "booking_max_per_call" SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN "booking_max_per_phone_day" SMALLINT NOT NULL DEFAULT 5,
  ADD CONSTRAINT "voice_profiles_booking_max_per_call" CHECK ("booking_max_per_call" BETWEEN 1 AND 20),
  ADD CONSTRAINT "voice_profiles_booking_max_per_phone_day" CHECK ("booking_max_per_phone_day" BETWEEN 1 AND 20);

-- Котировка гостиницы из голосового звонка: conversation_id = внешний ID звонка
ALTER TABLE "seller_booking_intents" DROP CONSTRAINT "seller_booking_intents_channel";
ALTER TABLE "seller_booking_intents"
  ADD CONSTRAINT "seller_booking_intents_channel" CHECK ("channel" IN ('whatsapp', 'widget', 'voice'));
