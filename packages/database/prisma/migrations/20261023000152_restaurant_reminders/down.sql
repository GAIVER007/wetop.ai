-- Откат 152: только пока очередь напоминаний ресторана и настройки пусты. Историю отправок ради отката не удаляют.
-- Типы ClientNotification* принадлежат 140 и остаются.
BEGIN;
LOCK TABLE "restaurant_reservation_notifications", "food_reminder_settings" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "restaurant_reservation_notifications") OR EXISTS (SELECT 1 FROM "food_reminder_settings") THEN
    RAISE EXCEPTION 'Restaurant reminders are in use: export them before rollback of 152';
  END IF;
END $$;
DROP TABLE "restaurant_reservation_notifications";
DROP TABLE "food_reminder_settings";
DROP FUNCTION restaurant_reservation_notifications_guard();
DROP FUNCTION food_reminder_settings_guard();
COMMIT;
