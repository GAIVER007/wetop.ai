-- 168 Источник записи салона (владелец 28.10.2026: «источник ещё типа инстаграм, ватсап»), DATA_MODEL
-- APPOINTMENT-SOURCE-20261028. Аддитивно: новые значения перечисления, существующие записи не меняются.
ALTER TYPE "AppointmentSource" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "AppointmentSource" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "AppointmentSource" ADD VALUE IF NOT EXISTS 'PHONE';
ALTER TYPE "AppointmentSource" ADD VALUE IF NOT EXISTS 'WALK_IN';
