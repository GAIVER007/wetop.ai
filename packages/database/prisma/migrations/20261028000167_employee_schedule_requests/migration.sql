-- DATA_MODEL SCHEDULE-REQUESTS-20261028 (владелец 28.10.2026: кабинет мастера, «График» через руководителя).
-- Запрос мастера на изменение своей недели или отсутствие; решает руководитель. Аддитивно: старый код таблицу не читает,
-- графики и записи не меняются до одобрения.
BEGIN;

CREATE TYPE "ScheduleRequestKind" AS ENUM ('WEEK', 'TIME_OFF');
CREATE TYPE "ScheduleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "employee_schedule_requests" (
  "id" UUID NOT NULL, -- id задаёт Prisma (@default(uuid())), как у остальных таблиц: без DEFAULT в базе
  "employee_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "kind" "ScheduleRequestKind" NOT NULL,
  "payload" JSONB NOT NULL,
  "base_revision" VARCHAR(100),
  "status" "ScheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_by_id" UUID,
  "decided_at" TIMESTAMPTZ(6),
  "decision_note" VARCHAR(300),
  CONSTRAINT "employee_schedule_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_schedule_requests_employee_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "employee_schedule_requests_location_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "employee_schedule_requests_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "employee_schedule_requests_decided_by_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "employee_schedule_requests_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "employee_schedule_requests_decision" CHECK (
    ("status" = 'PENDING' AND "decided_by_id" IS NULL AND "decided_at" IS NULL AND "decision_note" IS NULL)
    OR ("status" IN ('APPROVED', 'REJECTED') AND "decided_by_id" IS NOT NULL AND "decided_at" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "decided_by_id" = "created_by_id" AND "decided_at" IS NOT NULL)
  )
);
-- не больше одного ожидающего запроса недели на мастера в филиале
CREATE UNIQUE INDEX "employee_schedule_requests_one_pending_week"
  ON "employee_schedule_requests" ("employee_id", "location_id") WHERE "status" = 'PENDING' AND "kind" = 'WEEK';
CREATE INDEX "employee_schedule_requests_employee_idx" ON "employee_schedule_requests" ("employee_id", "created_at");

-- Ключ запроса не меняется; решённый запрос больше не меняется
CREATE FUNCTION employee_schedule_requests_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.employee_id, NEW.location_id, NEW.kind, NEW.payload, NEW.created_by_id, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.employee_id, OLD.location_id, OLD.kind, OLD.payload, OLD.created_by_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Schedule request key is immutable';
  END IF;
  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Schedule request is already decided';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employee_schedule_requests_guard BEFORE UPDATE ON "employee_schedule_requests"
  FOR EACH ROW EXECUTE FUNCTION employee_schedule_requests_guard();

-- RLS через родителя-сотрудника, как у time_offs; DELETE нет: история решений не стирается
ALTER TABLE "employee_schedule_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_schedule_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "employee_schedule_requests" FOR SELECT TO wetop_app
  USING (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "employee_schedule_requests"."employee_id"));
CREATE POLICY rls_tenant_insert ON "employee_schedule_requests" FOR INSERT TO wetop_app
  WITH CHECK (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "employee_schedule_requests"."employee_id"));
CREATE POLICY rls_tenant_update ON "employee_schedule_requests" FOR UPDATE TO wetop_app
  USING (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "employee_schedule_requests"."employee_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "employee_schedule_requests"."employee_id"));

REVOKE ALL ON "employee_schedule_requests" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "employee_schedule_requests" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON "employee_schedule_requests" TO wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.employee_schedule_requests_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
