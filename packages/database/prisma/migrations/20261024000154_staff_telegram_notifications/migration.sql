-- STAFF-TG-20261020 (DATA_MODEL, утверждено владельцем 20.10.2026; план plans/staff-telegram-notifications-2026-10-20.md):
-- уведомления сотрудникам о бронях с сайта в Telegram. Три таблицы: привязка чата, одноразовые коды привязки, очередь
-- уведомлений (AGENTS.md §11). Аддитивная миграция: старый код таблиц не читает. Применяет агент после бэкапа
-- (README.md рядом); откат down.sql только пока таблицы пусты.


-- CreateEnum
CREATE TYPE "StaffNotificationKind" AS ENUM ('SITE_BOOKING_HOTEL', 'SITE_APPOINTMENT', 'SITE_TABLE', 'SITE_LEAD');

-- CreateEnum
CREATE TYPE "StaffNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "staff_telegram_links" (
    "user_id" UUID NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "username" VARCHAR(64),
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(6),
    "site_bookings" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "staff_telegram_links_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "staff_telegram_link_codes" (
    "code_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_telegram_link_codes_pkey" PRIMARY KEY ("code_hash")
);

-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "kind" "StaffNotificationKind" NOT NULL,
    "source_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "status" "StaffNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_telegram_links_chat_id_idx" ON "staff_telegram_links"("chat_id");

-- CreateIndex
CREATE INDEX "staff_telegram_link_codes_user_id_idx" ON "staff_telegram_link_codes"("user_id");

-- CreateIndex
CREATE INDEX "staff_notifications_status_next_attempt_at_idx" ON "staff_notifications"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "staff_notifications_organization_id_created_at_idx" ON "staff_notifications"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_notifications_location_id_idx" ON "staff_notifications"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_notifications_kind_source_id_recipient_user_id_key" ON "staff_notifications"("kind", "source_id", "recipient_user_id");

-- AddForeignKey
ALTER TABLE "staff_telegram_links" ADD CONSTRAINT "staff_telegram_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_telegram_link_codes" ADD CONSTRAINT "staff_telegram_link_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "staff_telegram_links" ADD CONSTRAINT "staff_telegram_links_values"
  CHECK ("chat_id" > 0 AND ("username" IS NULL OR btrim("username") <> ''));
ALTER TABLE "staff_telegram_link_codes" ADD CONSTRAINT "staff_telegram_link_codes_hash"
  CHECK ("code_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_values"
  CHECK ("attempts" >= 0 AND ("status" <> 'SENT' OR "sent_at" IS NOT NULL));

-- Изоляция (§17): привязка и коды видны организации, где у сотрудника есть членство; очередь по своей организации и
-- филиалу этой организации. Вебхук бота и отправщик работают служебной ролью.
ALTER TABLE "staff_telegram_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_telegram_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "staff_telegram_links" TO wetop_app
  USING (EXISTS (SELECT 1 FROM memberships m
                  WHERE m.user_id = staff_telegram_links.user_id AND m.organization_id = app_current_org()))
  WITH CHECK (EXISTS (SELECT 1 FROM memberships m
                  WHERE m.user_id = staff_telegram_links.user_id AND m.organization_id = app_current_org()));

ALTER TABLE "staff_telegram_link_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_telegram_link_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "staff_telegram_link_codes" TO wetop_app
  USING (EXISTS (SELECT 1 FROM memberships m
                  WHERE m.user_id = staff_telegram_link_codes.user_id AND m.organization_id = app_current_org()))
  WITH CHECK (EXISTS (SELECT 1 FROM memberships m
                  WHERE m.user_id = staff_telegram_link_codes.user_id AND m.organization_id = app_current_org()));

ALTER TABLE "staff_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "staff_notifications" TO wetop_app
  USING (organization_id = app_current_org() AND EXISTS (
    SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
     WHERE l.id = staff_notifications.location_id AND b.organization_id = app_current_org()))
  WITH CHECK (organization_id = app_current_org() AND EXISTS (
    SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
     WHERE l.id = staff_notifications.location_id AND b.organization_id = app_current_org()));

-- Права по фактическим операциям API. Организация: читает и меняет свою привязку (переключатель, отключение),
-- выдаёт коды, пишет очередь в транзакции брони. Служебная роль: привязка по вебхуку, отправщик. Удаления нет.
REVOKE ALL ON TABLE "staff_telegram_links", "staff_telegram_link_codes", "staff_notifications" FROM wetop_app, wetop_service;
GRANT SELECT, UPDATE ON TABLE "staff_telegram_links" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "staff_telegram_link_codes" TO wetop_app;
GRANT SELECT, INSERT ON TABLE "staff_notifications" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "staff_telegram_links", "staff_telegram_link_codes", "staff_notifications" TO wetop_service;
