-- 140 Напоминания клиентам салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md, §1).
-- Очередь client_notifications: строка на каждое сообщение клиенту по записи, без текста и без контактов
-- (текст собирается в момент отправки). Натуральный ключ (запись, вид, плановое время): повтор не создаёт дубль.
-- Настройки филиала beauty_reminder_settings. Аддитивно: старый API новые таблицы не читает.
BEGIN;

CREATE TYPE "ClientNotificationKind" AS ENUM ('REMINDER', 'CONFIRMATION', 'REVIEW_REQUEST');
CREATE TYPE "ClientNotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'MANUAL');
CREATE TYPE "ClientNotificationState" AS ENUM ('PENDING', 'SENT', 'MANUAL', 'FAILED', 'CANCELLED');

CREATE TABLE "client_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "kind" "ClientNotificationKind" NOT NULL,
  "due_at" TIMESTAMPTZ(6) NOT NULL,
  "channel" "ClientNotificationChannel",
  "state" "ClientNotificationState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(500),
  "sent_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_notifications_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "client_notifications_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  -- записи не удаляются приложением; служебная очистка записи уносит и её очередь
  CONSTRAINT "client_notifications_appointment_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "client_notifications_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "client_notifications_values" CHECK (
    "attempts" >= 0
    AND ("state" <> 'SENT' OR ("sent_at" IS NOT NULL AND "channel" IS NOT NULL))
    AND ("state" <> 'MANUAL' OR "channel" = 'MANUAL')
  )
);
CREATE UNIQUE INDEX "client_notifications_natural_key" ON "client_notifications" ("appointment_id", "kind", "due_at");
-- воркер: созревшие строки, ожидающие отправки
CREATE INDEX "client_notifications_state_due_idx" ON "client_notifications" ("state", "due_at");
CREATE INDEX "client_notifications_location_due_idx" ON "client_notifications" ("location_id", "due_at");

-- Принадлежность: филиал записи, клиент записи, организация бизнеса филиала. Ключ строки не меняется.
CREATE FUNCTION client_notifications_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.organization_id, NEW.location_id, NEW.appointment_id, NEW.customer_id, NEW.kind, NEW.due_at, NEW.created_at)
     IS DISTINCT FROM (OLD.organization_id, OLD.location_id, OLD.appointment_id, OLD.customer_id, OLD.kind, OLD.due_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Client notification key is immutable';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM appointments a JOIN locations l ON l.id = a.location_id JOIN businesses b ON b.id = l.business_id
    WHERE a.id = NEW.appointment_id AND a.location_id = NEW.location_id AND a.customer_id = NEW.customer_id
      AND b.organization_id = NEW.organization_id AND b.vertical = 'BEAUTY'
  ) THEN
    RAISE EXCEPTION 'Client notification belongs to another appointment, location or organization';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER client_notifications_guard BEFORE INSERT OR UPDATE ON "client_notifications"
  FOR EACH ROW EXECUTE FUNCTION client_notifications_guard();

CREATE TABLE "beauty_reminder_settings" (
  "location_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "hours_before" INTEGER[] NOT NULL DEFAULT '{24,2}',
  "template" TEXT,
  "whatsapp_template_name" VARCHAR(100),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "beauty_reminder_settings_pkey" PRIMARY KEY ("location_id"),
  CONSTRAINT "beauty_reminder_settings_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "beauty_reminder_settings_values" CHECK (
    "revision" > 0
    AND cardinality("hours_before") BETWEEN 1 AND 3
    AND 1 <= ALL ("hours_before") AND 168 >= ALL ("hours_before")
    AND ("template" IS NULL OR char_length("template") BETWEEN 1 AND 1000)
    AND ("whatsapp_template_name" IS NULL OR "whatsapp_template_name" ~ '^[a-z0-9_]{1,100}$')
  )
);
CREATE FUNCTION beauty_reminder_settings_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Reminder settings location is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = NEW.location_id AND b.vertical = 'BEAUTY') THEN
    RAISE EXCEPTION 'Reminder settings require a Beauty location';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER beauty_reminder_settings_guard BEFORE INSERT OR UPDATE ON "beauty_reminder_settings"
  FOR EACH ROW EXECUTE FUNCTION beauty_reminder_settings_guard();

-- RLS: организация читает свои строки. Очередь пишется в транзакции записи (роль wetop_app), поэтому вставка и
-- смена состояния разрешены своей организации; права DELETE нет ни у одной роли приложения (отмена = CANCELLED). Настройки пишет служебная роль (как режим работы, 137).
ALTER TABLE "client_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "client_notifications" FOR SELECT TO wetop_app
  USING ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_insert ON "client_notifications" FOR INSERT TO wetop_app
  WITH CHECK ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_update ON "client_notifications" FOR UPDATE TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());

ALTER TABLE "beauty_reminder_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beauty_reminder_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "beauty_reminder_settings" FOR SELECT TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
  WHERE l.id = beauty_reminder_settings.location_id AND b.organization_id = app_current_org()
));

REVOKE ALL ON "client_notifications", "beauty_reminder_settings" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "client_notifications" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON "client_notifications" TO wetop_service;
GRANT SELECT ON "beauty_reminder_settings" TO wetop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "beauty_reminder_settings" TO wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.client_notifications_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.beauty_reminder_settings_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
