-- DATA_MODEL §25 (контракт утверждён владельцем 30.09.2026, срок котировки 01.10.2026, реализация ADR-144):
-- намерение брони ИИ-продавца. Котировка живёт 30 минут; подтверждение после явного «да» гостя создаёт бронь
-- (повтор по тому же ключу возвращает ту же бронь: reservations.creation_key = id намерения).
CREATE TYPE "SellerBookingIntentState" AS ENUM ('QUOTED', 'CONFIRMED', 'REJECTED');

CREATE TABLE "seller_booking_intents" (
  "id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "conversation_id" varchar(64) NOT NULL,
  "channel" varchar(16) NOT NULL,
  "channel_message_id" varchar(128),
  "accommodation_type_id" uuid NOT NULL,
  "rate_plan_id" uuid NOT NULL,
  "arrival_date" date NOT NULL,
  "departure_date" date NOT NULL,
  "adults" integer NOT NULL,
  "total_minor" bigint NOT NULL,
  "currency" char(3) NOT NULL,
  "expires_at" timestamptz(6) NOT NULL,
  "state" "SellerBookingIntentState" NOT NULL DEFAULT 'QUOTED',
  "reservation_id" uuid,
  "request_hash" varchar(64) NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "seller_booking_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_booking_intents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_booking_intents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_booking_intents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_booking_intents_accommodation_type_id_fkey" FOREIGN KEY ("accommodation_type_id") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_booking_intents_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_booking_intents_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- бронь из чата — только каналы, где у брони есть источник: WhatsApp (WHATSAPP) и чат сайта (WEBSITE)
  CONSTRAINT "seller_booking_intents_channel" CHECK ("channel" IN ('whatsapp', 'widget')),
  CONSTRAINT "seller_booking_intents_dates" CHECK ("departure_date" > "arrival_date"),
  CONSTRAINT "seller_booking_intents_adults" CHECK ("adults" >= 1),
  CONSTRAINT "seller_booking_intents_total" CHECK ("total_minor" > 0),
  -- подтверждено ⇔ есть бронь
  CONSTRAINT "seller_booking_intents_confirmed" CHECK (("state" = 'CONFIRMED') = ("reservation_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "seller_booking_intents_reservation_id_key" ON "seller_booking_intents"("reservation_id");
CREATE UNIQUE INDEX "seller_booking_intents_agent_id_channel_message_id_key"
  ON "seller_booking_intents"("agent_id", "channel_message_id");
CREATE INDEX "seller_booking_intents_agent_id_conversation_id_created_at_idx"
  ON "seller_booking_intents"("agent_id", "conversation_id", "created_at");

-- Изоляция организаций (§17): строка несёт организацию, как seller_agents
ALTER TABLE "seller_booking_intents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "seller_booking_intents" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
