-- 148 Котировки голосовой брони, салон и ресторан (DATA_MODEL VOICE-BOOKING-PROPOSAL-20261023, п. 3; утверждено 23.10.2026).
-- Котировку пишет только служебная роль (API голоса); приложение читает котировки своей организации.
-- Звонок хранится внешним ID текстом: события звонка приходят из воркера очередью и могут опоздать относительно первой котировки.
BEGIN;

CREATE TABLE "voice_booking_quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "agent_id" UUID NOT NULL,
  "call_ref" VARCHAR(64) NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "selection" JSONB NOT NULL,
  "total_minor" BIGINT,
  "currency" CHAR(3),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "state" VARCHAR(16) NOT NULL DEFAULT 'QUOTED',
  "result_id" UUID,
  "request_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "voice_booking_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_booking_quotes_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_booking_quotes_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_booking_quotes_agent_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_booking_quotes_kind" CHECK ("kind" IN ('APPOINTMENT', 'TABLE')),
  CONSTRAINT "voice_booking_quotes_state" CHECK ("state" IN ('QUOTED', 'CONFIRMED', 'REJECTED', 'EXPIRED')),
  CONSTRAINT "voice_booking_quotes_total" CHECK ("total_minor" IS NULL OR "total_minor" >= 0),
  CONSTRAINT "voice_booking_quotes_confirmed" CHECK (("state" = 'CONFIRMED') = ("result_id" IS NOT NULL)),
  CONSTRAINT "voice_booking_quotes_call_key" UNIQUE ("agent_id", "call_ref", "request_hash")
);
CREATE UNIQUE INDEX "voice_booking_quotes_result_key" ON "voice_booking_quotes" ("result_id") WHERE "result_id" IS NOT NULL;
CREATE INDEX "voice_booking_quotes_call_idx" ON "voice_booking_quotes" ("agent_id", "call_ref", "state");
CREATE INDEX "voice_booking_quotes_org_idx" ON "voice_booking_quotes" ("organization_id", "location_id");

ALTER TABLE "voice_booking_quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voice_booking_quotes" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "voice_booking_quotes" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());

REVOKE ALL ON "voice_booking_quotes" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "voice_booking_quotes" TO wetop_service;
GRANT SELECT ON "voice_booking_quotes" TO wetop_app;

COMMIT;
