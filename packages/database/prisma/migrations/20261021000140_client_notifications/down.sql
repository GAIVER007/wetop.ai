-- Откат 140: только пока очередь напоминаний и настройки пусты. Историю отправок ради отката не удаляют.
BEGIN;
LOCK TABLE "client_notifications", "beauty_reminder_settings" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "client_notifications") OR EXISTS (SELECT 1 FROM "beauty_reminder_settings") THEN
    RAISE EXCEPTION 'Client notifications are in use: export them before rollback of 140';
  END IF;
END $$;
DROP TABLE "client_notifications";
DROP TABLE "beauty_reminder_settings";
DROP FUNCTION client_notifications_guard();
DROP FUNCTION client_notifications_no_delete();
DROP FUNCTION beauty_reminder_settings_guard();
DROP TYPE "ClientNotificationState";
DROP TYPE "ClientNotificationChannel";
DROP TYPE "ClientNotificationKind";
COMMIT;
