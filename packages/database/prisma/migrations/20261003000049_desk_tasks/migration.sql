-- DATA_MODEL §22 (утверждено владельцем 03.10.2026): задачи стойки. Повторов и уведомлений в v1 нет.
-- Изоляция — по объекту, как у кассы §21: organization_id не храним, его даёт properties.

CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE "desk_tasks" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "title" text NOT NULL,
  "note" text,
  "due_date" date NOT NULL,
  -- «HH:MM» по часам объекта, как properties.check_in_time; NULL — «весь день»
  "due_time" text,
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "assignee_user_id" uuid,
  "reservation_id" uuid,
  "guest_id" uuid,
  "done_at" timestamptz(6),
  "done_by_id" uuid,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "desk_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "desk_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "desk_tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "desk_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "desk_tasks_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "desk_tasks_done_by_id_fkey" FOREIGN KEY ("done_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "desk_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "desk_tasks_title_length" CHECK (char_length("title") BETWEEN 1 AND 200),
  CONSTRAINT "desk_tasks_note_length" CHECK ("note" IS NULL OR char_length("note") <= 2000),
  CONSTRAINT "desk_tasks_due_time_format" CHECK ("due_time" IS NULL OR "due_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- сделана: время и кто — вместе или никак (кто — может стать NULL при удалении пользователя)
  CONSTRAINT "desk_tasks_done_shape" CHECK ("done_at" IS NOT NULL OR "done_by_id" IS NULL)
);
CREATE INDEX "desk_tasks_property_id_due_date_idx" ON "desk_tasks"("property_id", "due_date");
-- счётчик «Задачи N» читает только открытые
CREATE INDEX "desk_tasks_open_idx" ON "desk_tasks"("property_id", "due_date") WHERE "done_at" IS NULL;
CREATE INDEX "desk_tasks_reservation_id_idx" ON "desk_tasks"("reservation_id");

-- Изоляция организаций (§17): как у кассы (миграция 040)
ALTER TABLE "desk_tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "desk_tasks" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));
