-- 152 Напоминания гостям ресторана о брони (DATA_MODEL §61, docs/decisions/2026-10-23-restaurant-reminders.md;
-- решение владельца 23.10.2026 «Да, делай по этой схеме (миграция 152, 2 новые таблицы)»).
-- Очередь restaurant_reservation_notifications: строка на сообщение гостю по брони, без текста и контактов (текст
-- собирается при отправке). Натуральный ключ (бронь, вид, плановое время). Виды и состояния те же, что у очереди
-- салона (типы из 140, не меняются): только REMINDER и CONFIRMATION. Настройки филиала food_reminder_settings.
-- Очередь и настройки салона (140) не трогаются. Аддитивно: старый API новые таблицы не читает.
BEGIN;

CREATE TABLE "restaurant_reservation_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
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
  CONSTRAINT "restaurant_reservation_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_reservation_notifications_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "restaurant_reservation_notifications_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  -- брони приложением не удаляются; служебная очистка брони уносит и её очередь
  CONSTRAINT "restaurant_reservation_notifications_reservation_fkey" FOREIGN KEY ("reservation_id") REFERENCES "restaurant_reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "restaurant_reservation_notifications_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "restaurant_reservation_notifications_values" CHECK (
    "kind" IN ('REMINDER', 'CONFIRMATION')
    AND "attempts" >= 0
    AND ("state" <> 'SENT' OR ("sent_at" IS NOT NULL AND "channel" IS NOT NULL))
    AND ("state" <> 'MANUAL' OR "channel" = 'MANUAL')
  )
);
CREATE UNIQUE INDEX "restaurant_reservation_notifications_natural_key" ON "restaurant_reservation_notifications" ("reservation_id", "kind", "due_at");
CREATE INDEX "restaurant_reservation_notifications_state_due_idx" ON "restaurant_reservation_notifications" ("state", "due_at");
CREATE INDEX "restaurant_reservation_notifications_location_due_idx" ON "restaurant_reservation_notifications" ("location_id", "due_at");

-- Принадлежность: филиал брони, гость брони, организация бизнеса ресторана. Ключ строки не меняется.
CREATE FUNCTION restaurant_reservation_notifications_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.organization_id, NEW.location_id, NEW.reservation_id, NEW.customer_id, NEW.kind, NEW.due_at, NEW.created_at)
     IS DISTINCT FROM (OLD.organization_id, OLD.location_id, OLD.reservation_id, OLD.customer_id, OLD.kind, OLD.due_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Restaurant notification key is immutable';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM restaurant_reservations r JOIN locations l ON l.id = r.location_id JOIN businesses b ON b.id = l.business_id
    WHERE r.id = NEW.reservation_id AND r.location_id = NEW.location_id AND r.customer_id = NEW.customer_id
      AND b.organization_id = NEW.organization_id AND b.vertical = 'FOOD_SERVICE'
  ) THEN
    RAISE EXCEPTION 'Restaurant notification belongs to another reservation, location or organization';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER restaurant_reservation_notifications_guard BEFORE INSERT OR UPDATE ON "restaurant_reservation_notifications"
  FOR EACH ROW EXECUTE FUNCTION restaurant_reservation_notifications_guard();

CREATE TABLE "food_reminder_settings" (
  "location_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "hours_before" INTEGER[] NOT NULL DEFAULT '{24,2}',
  "template" TEXT,
  "whatsapp_template_name" VARCHAR(100),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_reminder_settings_pkey" PRIMARY KEY ("location_id"),
  CONSTRAINT "food_reminder_settings_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "food_reminder_settings_values" CHECK (
    "revision" > 0
    AND cardinality("hours_before") BETWEEN 1 AND 3
    AND 1 <= ALL ("hours_before") AND 168 >= ALL ("hours_before")
    AND ("template" IS NULL OR char_length("template") BETWEEN 1 AND 1000)
    AND ("whatsapp_template_name" IS NULL OR "whatsapp_template_name" ~ '^[a-z0-9_]{1,100}$')
  )
);
CREATE FUNCTION food_reminder_settings_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Reminder settings location is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = NEW.location_id AND b.vertical = 'FOOD_SERVICE') THEN
    RAISE EXCEPTION 'Reminder settings require a Food Service location';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER food_reminder_settings_guard BEFORE INSERT OR UPDATE ON "food_reminder_settings"
  FOR EACH ROW EXECUTE FUNCTION food_reminder_settings_guard();

-- RLS как у 140: организация читает свои строки; очередь пишется в транзакции брони (wetop_app), без удаления
-- (отмена = CANCELLED). Настройки пишет служебная роль.
ALTER TABLE "restaurant_reservation_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restaurant_reservation_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "restaurant_reservation_notifications" FOR SELECT TO wetop_app
  USING ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_insert ON "restaurant_reservation_notifications" FOR INSERT TO wetop_app
  WITH CHECK ("organization_id" = app_current_org());
CREATE POLICY rls_tenant_update ON "restaurant_reservation_notifications" FOR UPDATE TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());

ALTER TABLE "food_reminder_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_reminder_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "food_reminder_settings" FOR SELECT TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
  WHERE l.id = food_reminder_settings.location_id AND b.organization_id = app_current_org()
));

REVOKE ALL ON "restaurant_reservation_notifications", "food_reminder_settings" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "restaurant_reservation_notifications" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON "restaurant_reservation_notifications" TO wetop_service;
GRANT SELECT ON "food_reminder_settings" TO wetop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "food_reminder_settings" TO wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.restaurant_reservation_notifications_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.food_reminder_settings_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
