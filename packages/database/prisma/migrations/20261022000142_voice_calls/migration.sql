-- 142 Журнал голосовых звонков (docs/decisions/2026-10-22-voice-stage2-storage.md, DATA_MODEL VOICE-OWNER-APPROVAL-20261022).
-- Звонки пишет только служебная роль (воркер голоса через API платформы); приложение читает звонки и профиль своей
-- организации и закрывает просьбы о звонке. Полный телефон только в voice_callbacks, в voice_calls маска.
-- Время событий ставит приложение (AGENTS.md §13): у received_at нет DEFAULT.
BEGIN;

CREATE TYPE "VoiceCallState" AS ENUM ('RECEIVED', 'ANSWERED', 'ENDED', 'REJECTED', 'FAILED');
CREATE TYPE "VoiceCallbackStatus" AS ENUM ('NEW', 'DONE');
CREATE TYPE "VoiceDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "voice_calls" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "location_id" UUID,
  "agent_id" UUID NOT NULL,
  "external_call_id" VARCHAR(128) NOT NULL,
  "direction" "VoiceDirection" NOT NULL DEFAULT 'INBOUND',
  "dialed_number" VARCHAR(16),
  "caller_masked" VARCHAR(12),
  "state" "VoiceCallState" NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL,
  "answered_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  "duration_seconds" INTEGER,
  "end_reason" VARCHAR(40),
  "transfer_requested" BOOLEAN NOT NULL DEFAULT false,
  "callback_requested" BOOLEAN NOT NULL DEFAULT false,
  "consent_announced" BOOLEAN NOT NULL DEFAULT true,
  "error_code" VARCHAR(40),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_calls_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_calls_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_calls_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_calls_agent_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_calls_agent_call_key" UNIQUE ("agent_id", "external_call_id"),
  CONSTRAINT "voice_calls_external_id" CHECK (btrim("external_call_id") <> ''),
  CONSTRAINT "voice_calls_dialed" CHECK ("dialed_number" IS NULL OR "dialed_number" ~ '^\+[0-9]{10,15}$'),
  CONSTRAINT "voice_calls_masked" CHECK ("caller_masked" IS NULL OR "caller_masked" ~ '^\*\*\*[0-9]{0,4}$'),
  CONSTRAINT "voice_calls_times" CHECK (
    ("answered_at" IS NULL OR "answered_at" >= "received_at") AND ("ended_at" IS NULL OR "ended_at" >= "received_at")
  ),
  CONSTRAINT "voice_calls_duration" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  CONSTRAINT "voice_calls_retry" CHECK ("retry_count" >= 0)
);
CREATE INDEX "voice_calls_org_received_idx" ON "voice_calls" ("organization_id", "business_id", "received_at" DESC);
CREATE INDEX "voice_calls_agent_idx" ON "voice_calls" ("agent_id", "received_at" DESC);

CREATE TABLE "voice_callbacks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "voice_call_id" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "name" VARCHAR(100) NOT NULL DEFAULT '',
  "note" VARCHAR(500) NOT NULL DEFAULT '',
  "status" "VoiceCallbackStatus" NOT NULL DEFAULT 'NEW',
  "done_at" TIMESTAMPTZ(6),
  "done_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "voice_callbacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_callbacks_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_callbacks_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_callbacks_call_fkey" FOREIGN KEY ("voice_call_id") REFERENCES "voice_calls"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_callbacks_done_by_fkey" FOREIGN KEY ("done_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "voice_callbacks_call_phone_key" UNIQUE ("voice_call_id", "phone"),
  CONSTRAINT "voice_callbacks_phone" CHECK ("phone" ~ '^\+[0-9]{10,15}$'),
  CONSTRAINT "voice_callbacks_done" CHECK ("status" <> 'DONE' OR "done_at" IS NOT NULL)
);
CREATE INDEX "voice_callbacks_queue_idx" ON "voice_callbacks" ("organization_id", "business_id", "status", "created_at" DESC);

CREATE TABLE "voice_profiles" (
  "agent_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "greeting_tail" VARCHAR(300) NOT NULL DEFAULT '',
  "voice_name" VARCHAR(40) NOT NULL DEFAULT 'Leda',
  "handoff_phone" VARCHAR(16),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("agent_id"),
  CONSTRAINT "voice_profiles_agent_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_profiles_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_profiles_business_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "voice_profiles_handoff" CHECK ("handoff_phone" IS NULL OR "handoff_phone" ~ '^\+[0-9]{10,15}$'),
  CONSTRAINT "voice_profiles_revision" CHECK ("revision" > 0)
);
CREATE INDEX "voice_profiles_org_idx" ON "voice_profiles" ("organization_id", "business_id");

-- Принадлежность: бизнес, филиал, агент и звонок одной организации (запись идёт служебной ролью, RLS её не
-- ограничивает, поэтому чужую связь режет сама база).
CREATE FUNCTION voice_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = NEW.business_id AND b.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Voice row business belongs to another organization';
  END IF;
  IF TG_TABLE_NAME = 'voice_callbacks' THEN
    IF NOT EXISTS (SELECT 1 FROM voice_calls c WHERE c.id = NEW.voice_call_id
        AND c.organization_id = NEW.organization_id AND c.business_id = NEW.business_id) THEN
      RAISE EXCEPTION 'Callback call belongs to another organization or business';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = NEW.agent_id AND a.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Voice agent belongs to another organization';
    END IF;
    -- поля NEW читаются только своей таблицы: PL/pgSQL не сокращает AND, у voice_profiles нет location_id
    IF TG_TABLE_NAME = 'voice_calls' THEN
      IF NEW.location_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.business_id = NEW.business_id) THEN
        RAISE EXCEPTION 'Voice call location belongs to another business';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Состояние звонка идёт только вперёд: конечные ENDED, REJECTED, FAILED не меняются; идентичность строки неизменна.
CREATE FUNCTION voice_call_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id OR NEW.business_id <> OLD.business_id OR NEW.agent_id <> OLD.agent_id
     OR NEW.external_call_id <> OLD.external_call_id OR NEW.received_at <> OLD.received_at THEN
    RAISE EXCEPTION 'Voice call identity is immutable';
  END IF;
  IF OLD.state IN ('ENDED', 'REJECTED', 'FAILED') AND NEW.state <> OLD.state THEN
    RAISE EXCEPTION 'Voice call is already final';
  END IF;
  IF OLD.state = 'ANSWERED' AND NEW.state = 'RECEIVED' THEN
    RAISE EXCEPTION 'Voice call state cannot go back';
  END IF;
  RETURN NEW;
END $$;

-- Просьба: после создания меняются только статус и отметка закрытия; закрытая просьба не открывается заново.
CREATE FUNCTION voice_callback_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id OR NEW.business_id <> OLD.business_id OR NEW.voice_call_id <> OLD.voice_call_id
     OR NEW.phone <> OLD.phone OR NEW.name <> OLD.name OR NEW.note <> OLD.note OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Voice callback content is immutable';
  END IF;
  IF OLD.status = 'DONE' AND NEW.status <> 'DONE' THEN
    RAISE EXCEPTION 'Voice callback is already done';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER voice_calls_scope BEFORE INSERT OR UPDATE ON "voice_calls" FOR EACH ROW EXECUTE FUNCTION voice_scope_guard();
CREATE TRIGGER voice_calls_state BEFORE UPDATE ON "voice_calls" FOR EACH ROW EXECUTE FUNCTION voice_call_state_guard();
CREATE TRIGGER voice_callbacks_scope BEFORE INSERT ON "voice_callbacks" FOR EACH ROW EXECUTE FUNCTION voice_scope_guard();
CREATE TRIGGER voice_callbacks_guard BEFORE UPDATE ON "voice_callbacks" FOR EACH ROW EXECUTE FUNCTION voice_callback_guard();
CREATE TRIGGER voice_profiles_scope BEFORE INSERT OR UPDATE ON "voice_profiles" FOR EACH ROW EXECUTE FUNCTION voice_scope_guard();

-- RLS: приложение видит звонки и профиль своей организации и закрывает просьбы; события и профиль пишет служебная роль.
ALTER TABLE "voice_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voice_calls" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "voice_calls" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());
ALTER TABLE "voice_callbacks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voice_callbacks" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "voice_callbacks" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_update ON "voice_callbacks" FOR UPDATE TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
ALTER TABLE "voice_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voice_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "voice_profiles" FOR SELECT TO wetop_app USING ("organization_id" = app_current_org());

REVOKE ALL ON "voice_calls", "voice_callbacks", "voice_profiles" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "voice_calls", "voice_callbacks", "voice_profiles" TO wetop_service;
GRANT SELECT ON "voice_calls", "voice_profiles" TO wetop_app;
GRANT SELECT ON "voice_callbacks" TO wetop_app;
GRANT UPDATE ("status", "done_at", "done_by_id") ON "voice_callbacks" TO wetop_app;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.voice_scope_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.voice_call_state_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.voice_callback_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
