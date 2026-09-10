-- Путь доставки входящего события (DATA_MODEL §8, ExternalEvent).
-- Один и тот же обработчик работает и по webhook, и по опросу ленты каждые 5 минут: без этого поля
-- «бронь приходит сама» доказать нечем — в журнале обе записи выглядят одинаково.
CREATE TYPE "ExternalEventVia" AS ENUM ('WEBHOOK', 'PULL', 'MANUAL');
ALTER TABLE "external_events"
  ADD COLUMN "received_via" "ExternalEventVia" NOT NULL DEFAULT 'PULL';
