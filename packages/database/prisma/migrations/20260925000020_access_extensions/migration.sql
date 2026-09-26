-- Доступ к платформе и расширения (DATA_MODEL §16 v1.9, ADR-083; план plans/platform-roles-extensions-2026-09-25.md).
-- Применяет владелец (AGENTS.md §15): бэкап → миграция → проверка → откат (down.sql в этой же папке).
--
-- Три части:
--   • роль человека в организации (`memberships.role`): у самого раннего участника каждой организации — `OWNER`,
--     у остальных — `STAFF`. На стойке роль прав не меняет (ADR-023);
--   • главный администратор платформы (`platform_admins`): пустая, отметку ставит команда на сервере;
--   • платные расширения организации (`organization_extensions`): пустая, включает главный администратор.
-- Денег и данных гостей в новых таблицах нет. Остальные таблицы не меняются.

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "ExtensionKind" AS ENUM ('AI_SELLER');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'OFF');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "role" "MembershipRole" NOT NULL DEFAULT 'STAFF';

-- Владелец существующей организации — самый ранний участник: регистрация заводит организацию и первое членство одной
-- транзакцией (DATA_MODEL §16.1). При равном времени — меньший user_id: владелец ровно один.
UPDATE "memberships" AS m
SET "role" = 'OWNER'
FROM (
  SELECT DISTINCT ON ("organization_id") "organization_id", "user_id"
  FROM "memberships"
  ORDER BY "organization_id", "created_at", "user_id"
) AS first
WHERE m."organization_id" = first."organization_id" AND m."user_id" = first."user_id";

-- CreateTable
CREATE TABLE "platform_admins" (
    "user_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "note" VARCHAR(200),

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "organization_extensions" (
    "organization_id" UUID NOT NULL,
    "extension" "ExtensionKind" NOT NULL,
    "status" "ExtensionStatus" NOT NULL,
    "active_until" TIMESTAMPTZ(6),
    "note" VARCHAR(300),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_extensions_pkey" PRIMARY KEY ("organization_id","extension")
);

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_extensions" ADD CONSTRAINT "organization_extensions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_extensions" ADD CONSTRAINT "organization_extensions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Пробный доступ всегда со сроком (DATA_MODEL §16.3). Prisma CHECK не описывает.
ALTER TABLE "organization_extensions" ADD CONSTRAINT "organization_extensions_trial_until_check"
  CHECK ("status" <> 'TRIAL' OR "active_until" IS NOT NULL);
