-- Третья роль в организации и роль у приглашения (DATA_MODEL §13.6, §16.1, §16.5 v1.14; ADR-106, решение владельца
-- 27.09.2026; план plans/roles-manager-admin-2026-09-27.md).
-- Применяет владелец (AGENTS.md §15): бэкап → миграция → проверка → откат (down.sql в этой же папке). Миграция идёт
-- ДО выкладки кода: новый код пишет invites.role, и без колонки приглашения не создаются.
--
-- Номер 29: №26–28 заняты миграциями Row Level Security (ADR-103), а на ветке ролей эта миграция называлась
-- 20260927000026_manager_role (до того — 20260927000025). Каждая команда идемпотентна: если миграцию уже применили под
-- прежним именем, эта пройдёт без изменений.
--
-- Значение MANAGER в этой же миграции не используется: PostgreSQL не даёт брать значение перечисления, добавленное в
-- незавершённой транзакции. Существующие строки не меняются: владельцы остаются владельцами, сотрудники — STAFF (на
-- экране — «администратор»), ожидающие приглашения — STAFF, как они и принимались до этой миграции.

-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'MANAGER' BEFORE 'STAFF';

-- AlterTable
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "role" "MembershipRole" NOT NULL DEFAULT 'STAFF';

-- Владельца приглашением не назначают: его назначает только команда на сервере (§16.1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invites_role_not_owner' AND conrelid = '"invites"'::regclass
  ) THEN
    ALTER TABLE "invites" ADD CONSTRAINT "invites_role_not_owner" CHECK ("role" <> 'OWNER');
  END IF;
END $$;
