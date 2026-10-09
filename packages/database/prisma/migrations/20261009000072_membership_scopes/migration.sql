-- STAFF2.3b (ADR-155, DATA_MODEL §30, ответы владельца по Q-286…Q-290 от 09.10.2026): область доступа сотрудника по бизнесам и
-- филиалам, приостановка членства, данные приглашения. Нет строк в membership_scopes: вся организация, поэтому данные
-- существующих людей не переносятся и поведение не меняется до первого назначения. Права приложения отдельной миграцией 071.
-- Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspended_at" TIMESTAMPTZ(6),
ADD COLUMN     "suspended_by" UUID;

-- Приостановка: время и автор заполнены вместе, у активного пусты
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_suspension_consistent" CHECK (
  ("status" = 'ACTIVE' AND "suspended_at" IS NULL AND "suspended_by" IS NULL)
  OR ("status" = 'SUSPENDED' AND "suspended_at" IS NOT NULL)
);

-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "first_name" VARCHAR(100),
ADD COLUMN     "last_name" VARCHAR(100),
ADD COLUMN     "phone" VARCHAR(16),
ADD COLUMN     "position" VARCHAR(100),
ADD COLUMN     "scopes" JSONB;

-- Телефон приглашения в том же виде, что у членства (+E.164, миграция 044)
ALTER TABLE "invites" ADD CONSTRAINT "invites_phone_e164" CHECK ("phone" IS NULL OR "phone" ~ '^\+[0-9]{10,15}$');
-- Назначения приглашения это список (или пусто)
ALTER TABLE "invites" ADD CONSTRAINT "invites_scopes_is_array" CHECK ("scopes" IS NULL OR jsonb_typeof("scopes") = 'array');

-- CreateTable
CREATE TABLE "membership_scopes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "membership_scopes_pkey" PRIMARY KEY ("id")
);

-- Владельцу область не назначают: он работает во всей организации
ALTER TABLE "membership_scopes" ADD CONSTRAINT "membership_scopes_role_not_owner" CHECK ("role" <> 'OWNER');

-- CreateIndex
CREATE INDEX "membership_scopes_organization_id_user_id_idx" ON "membership_scopes"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "membership_scopes_business_id_idx" ON "membership_scopes"("business_id");

-- CreateIndex
CREATE INDEX "membership_scopes_location_id_idx" ON "membership_scopes"("location_id");

-- Без повторов: бизнес целиком один раз, филиал один раз (частичные индексы, Prisma их не описывает)
CREATE UNIQUE INDEX "membership_scopes_business_key" ON "membership_scopes"("organization_id", "user_id", "business_id") WHERE "location_id" IS NULL;
CREATE UNIQUE INDEX "membership_scopes_location_key" ON "membership_scopes"("organization_id", "user_id", "business_id", "location_id") WHERE "location_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "membership_scopes" ADD CONSTRAINT "membership_scopes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_scopes" ADD CONSTRAINT "membership_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_scopes" ADD CONSTRAINT "membership_scopes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_scopes" ADD CONSTRAINT "membership_scopes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Страж: бизнес из организации строки, филиал из этого бизнеса, членство человека в организации существует
CREATE FUNCTION membership_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = NEW.business_id AND b.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'membership_scopes: бизнес не принадлежит организации';
  END IF;
  IF NEW.location_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'membership_scopes: филиал не принадлежит бизнесу';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = NEW.user_id AND m.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'membership_scopes: человека нет в организации';
  END IF;
  RETURN NEW;
END $$;
-- search_path функции закреплён за схемой, как у остальных (tests/integration/function-search-path.test.ts)
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.membership_scope_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER membership_scope_guard BEFORE INSERT OR UPDATE ON "membership_scopes"
  FOR EACH ROW EXECUTE FUNCTION membership_scope_guard();

-- RLS по организации, как у memberships (DATA_MODEL §17.3: ENABLE, без FORCE)
ALTER TABLE "membership_scopes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "membership_scopes" TO wetop_app
  USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());
