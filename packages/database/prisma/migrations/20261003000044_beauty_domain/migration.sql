-- Beauty-домен (DATA_MODEL §19 и §19.1, утверждено владельцем 03.10.2026; ADR-104, срез B1).
-- Hospitality не затрагивается ни одним полем: Property, Reservation, InventoryUnit, RatePlan и шахматка
-- остаются как есть, у вертикалей раздельные домены (ADR-104, ARCHITECTURE.md §19).
-- Деньги целыми тиынами (ADR-008), моменты записей в UTC, показ в поясе филиала (AGENTS.md §13).
-- Удаления строк нет, как во всём §13: архив статусом.

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- ── Клиент: канонический на организацию (freeze-решение №2, закрыло Q-198) ──────────────────────────────
CREATE TABLE "customers" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100),
  "phone" varchar(32),
  "email" varchar(320),
  "notes" text,
  "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");
-- один телефон на организацию; без телефона клиентов может быть много
CREATE UNIQUE INDEX "customers_organization_id_phone_key" ON "customers"("organization_id", "phone") WHERE "phone" IS NOT NULL;

-- Видимость клиента в конкретном бизнесе: строка появляется при первом обращении в этот бизнес
CREATE TABLE "customer_businesses" (
  "customer_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "customer_businesses_pkey" PRIMARY KEY ("customer_id", "business_id"),
  CONSTRAINT "customer_businesses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_businesses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "customer_businesses_business_id_idx" ON "customer_businesses"("business_id");

-- ── Мастер: сотрудник сети, не филиала ─────────────────────────────────────────────────────────────────
CREATE TABLE "employees" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" varchar(200) NOT NULL,
  "phone" varchar(32),
  "email" varchar(320),
  -- мастер со входом в систему (ARCHITECTURE.md §13); самого входа фаза 3 не делает
  "user_id" uuid,
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "employees_business_id_idx" ON "employees"("business_id");
CREATE UNIQUE INDEX "employees_business_id_user_id_key" ON "employees"("business_id", "user_id") WHERE "user_id" IS NOT NULL;

-- Один мастер работает в нескольких салонах
CREATE TABLE "employee_locations" (
  "employee_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "employee_locations_pkey" PRIMARY KEY ("employee_id", "location_id"),
  CONSTRAINT "employee_locations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "employee_locations_location_id_idx" ON "employee_locations"("location_id");

-- ── Каталог услуг сети; филиалы его не копируют, а переопределяют ───────────────────────────────────────
CREATE TABLE "beauty_services" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" varchar(200) NOT NULL,
  "category" varchar(100),
  "duration_minutes" integer NOT NULL,
  "price" bigint NOT NULL,
  -- валюта каталога (Q-257): цена филиала в валюте филиала задаётся через price_override
  "currency" varchar(3) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "beauty_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "beauty_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "beauty_services_duration" CHECK ("duration_minutes" > 0),
  CONSTRAINT "beauty_services_price" CHECK ("price" >= 0)
);
CREATE INDEX "beauty_services_business_id_idx" ON "beauty_services"("business_id");

-- Филиал включает услугу и может поставить свои цену и длительность
CREATE TABLE "location_services" (
  "location_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "price_override" bigint,
  "duration_override" integer,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "location_services_pkey" PRIMARY KEY ("location_id", "service_id"),
  CONSTRAINT "location_services_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "location_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "location_services_price" CHECK ("price_override" IS NULL OR "price_override" >= 0),
  CONSTRAINT "location_services_duration" CHECK ("duration_override" IS NULL OR "duration_override" > 0)
);
CREATE INDEX "location_services_service_id_idx" ON "location_services"("service_id");

-- Что мастер умеет
CREATE TABLE "employee_services" (
  "employee_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "employee_services_pkey" PRIMARY KEY ("employee_id", "service_id"),
  CONSTRAINT "employee_services_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "employee_services_service_id_idx" ON "employee_services"("service_id");

-- ── График мастера: всегда в контексте филиала (Q-251: недельный шаблон) ────────────────────────────────
CREATE TABLE "working_hours" (
  "id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  -- 0 воскресенье, как Date.getDay()
  "weekday" smallint NOT NULL,
  "time_from" time NOT NULL,
  "time_to" time NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_hours_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "working_hours_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "working_hours_weekday" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "working_hours_span" CHECK ("time_to" > "time_from")
);
CREATE UNIQUE INDEX "working_hours_employee_id_location_id_weekday_time_from_key"
  ON "working_hours"("employee_id", "location_id", "weekday", "time_from");
CREATE INDEX "working_hours_location_id_weekday_idx" ON "working_hours"("location_id", "weekday");

-- Отпуска и отсутствия: даты включительно с обеих сторон
CREATE TABLE "time_offs" (
  "id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "date_from" date NOT NULL,
  "date_to" date NOT NULL,
  "reason" varchar(200),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "time_offs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "time_offs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "time_offs_range" CHECK ("date_to" >= "date_from")
);
CREATE INDEX "time_offs_employee_id_date_from_idx" ON "time_offs"("employee_id", "date_from");

-- ── Запись клиента к мастеру на услугу ─────────────────────────────────────────────────────────────────
CREATE TABLE "appointments" (
  "id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "starts_at" timestamptz(6) NOT NULL,
  "ends_at" timestamptz(6) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
  -- снимок цены и валюты на момент записи, не ссылка на каталог
  "price" bigint NOT NULL,
  "currency" varchar(3) NOT NULL,
  "notes" text,
  "created_by_id" uuid,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "appointments_span" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "appointments_price" CHECK ("price" >= 0)
);
CREATE INDEX "appointments_location_id_starts_at_idx" ON "appointments"("location_id", "starts_at");
CREATE INDEX "appointments_employee_id_starts_at_idx" ON "appointments"("employee_id", "starts_at");
CREATE INDEX "appointments_customer_id_idx" ON "appointments"("customer_id");

-- Пересечение записей одного мастера запрещает база, как овербукинг у allocations (§2).
-- Отменённая и незаезд место не держат. btree_gist стоит с миграции …003.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap_per_employee"
  EXCLUDE USING gist ("employee_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));

-- ── Принадлежность: FK этого не выражает, проверяют триггеры (как «статья своего объекта» в §21) ────────
-- Имена таблиц внутри функций без схемы и search_path не закреплён, как у остальных триггеров проекта:
-- те же таблицы живут и в схеме pms_test (ADR-042), и одна функция должна работать в обеих.

CREATE OR REPLACE FUNCTION beauty_customer_business_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "customers" c JOIN "businesses" b ON b."id" = NEW."business_id"
    WHERE c."id" = NEW."customer_id" AND c."organization_id" = b."organization_id"
  ) THEN
    RAISE EXCEPTION 'Клиент и бизнес принадлежат разным организациям';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "customer_businesses_guard" BEFORE INSERT OR UPDATE OF "customer_id", "business_id"
  ON "customer_businesses" FOR EACH ROW EXECUTE FUNCTION beauty_customer_business_guard();

CREATE OR REPLACE FUNCTION beauty_employee_location_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "employees" e JOIN "locations" l ON l."id" = NEW."location_id"
    WHERE e."id" = NEW."employee_id" AND l."business_id" = e."business_id"
  ) THEN
    RAISE EXCEPTION 'Филиал принадлежит другому бизнесу, мастер в нём работать не может';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "employee_locations_guard" BEFORE INSERT OR UPDATE OF "employee_id", "location_id"
  ON "employee_locations" FOR EACH ROW EXECUTE FUNCTION beauty_employee_location_guard();

CREATE OR REPLACE FUNCTION beauty_location_service_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "locations" l JOIN "beauty_services" s ON s."id" = NEW."service_id"
    WHERE l."id" = NEW."location_id" AND l."business_id" = s."business_id"
  ) THEN
    RAISE EXCEPTION 'Услуга принадлежит другому бизнесу, филиал включить её не может';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "location_services_guard" BEFORE INSERT OR UPDATE OF "location_id", "service_id"
  ON "location_services" FOR EACH ROW EXECUTE FUNCTION beauty_location_service_guard();

CREATE OR REPLACE FUNCTION beauty_employee_service_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "employees" e JOIN "beauty_services" s ON s."id" = NEW."service_id"
    WHERE e."id" = NEW."employee_id" AND e."business_id" = s."business_id"
  ) THEN
    RAISE EXCEPTION 'Услуга принадлежит другому бизнесу, мастер её не оказывает';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "employee_services_guard" BEFORE INSERT OR UPDATE OF "employee_id", "service_id"
  ON "employee_services" FOR EACH ROW EXECUTE FUNCTION beauty_employee_service_guard();

CREATE OR REPLACE FUNCTION beauty_working_hours_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "employee_locations" el
    WHERE el."employee_id" = NEW."employee_id" AND el."location_id" = NEW."location_id"
  ) THEN
    RAISE EXCEPTION 'Мастер в этом филиале не работает, графика в нём быть не может';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "working_hours_guard" BEFORE INSERT OR UPDATE OF "employee_id", "location_id"
  ON "working_hours" FOR EACH ROW EXECUTE FUNCTION beauty_working_hours_guard();

-- Запись сходится с филиалом по мастеру, услуге и клиенту
CREATE OR REPLACE FUNCTION beauty_appointment_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "employee_locations" el
    WHERE el."employee_id" = NEW."employee_id" AND el."location_id" = NEW."location_id"
  ) THEN
    RAISE EXCEPTION 'Мастер в этом филиале не работает';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "location_services" ls
    WHERE ls."location_id" = NEW."location_id" AND ls."service_id" = NEW."service_id" AND ls."enabled"
  ) THEN
    RAISE EXCEPTION 'Услуга в этом филиале не включена';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "customers" c, "locations" l JOIN "businesses" b ON b."id" = l."business_id"
    WHERE c."id" = NEW."customer_id" AND l."id" = NEW."location_id" AND c."organization_id" = b."organization_id"
  ) THEN
    RAISE EXCEPTION 'Клиент принадлежит другой организации';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "appointments_guard" BEFORE INSERT OR UPDATE OF "location_id", "customer_id", "employee_id", "service_id"
  ON "appointments" FOR EACH ROW EXECUTE FUNCTION beauty_appointment_guard();

-- ── Изоляция организаций (§17.3) ───────────────────────────────────────────────────────────────────────
-- Клиент несёт организацию в строке. Остальное через родителя: его политика и режет, как у locations (…030).
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "customers" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());

ALTER TABLE "customer_businesses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "customer_businesses" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "customer_businesses"."business_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "customer_businesses"."business_id"));

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "employees" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "employees"."business_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "employees"."business_id"));

ALTER TABLE "beauty_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "beauty_services" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "beauty_services"."business_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "beauty_services"."business_id"));

ALTER TABLE "employee_locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "employee_locations" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "employee_locations"."location_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "employee_locations"."location_id"));

ALTER TABLE "location_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "location_services" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "location_services"."location_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "location_services"."location_id"));

ALTER TABLE "working_hours" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "working_hours" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "working_hours"."location_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "working_hours"."location_id"));

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "appointments" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "appointments"."location_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "locations" parent WHERE parent."id" = "appointments"."location_id"));

ALTER TABLE "employee_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "employee_services" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "employee_services"."employee_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "employee_services"."employee_id"));

ALTER TABLE "time_offs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "time_offs" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "time_offs"."employee_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "employees" parent WHERE parent."id" = "time_offs"."employee_id"));
