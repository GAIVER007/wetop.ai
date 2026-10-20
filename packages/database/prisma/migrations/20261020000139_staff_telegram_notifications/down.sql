-- Откат STAFF-TG-20261020 (20261020000139_staff_telegram_notifications). Только пока таблицы пусты: привязки
-- сотрудников и журнал уведомлений ради отката не удаляются (README.md рядом).
BEGIN;
LOCK TABLE staff_notifications, staff_telegram_link_codes, staff_telegram_links IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM staff_notifications) THEN
    RAISE EXCEPTION 'Rollback blocked: staff notifications exist';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_telegram_links) THEN
    RAISE EXCEPTION 'Rollback blocked: staff Telegram links exist';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_telegram_link_codes WHERE used_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback blocked: used staff Telegram link codes exist';
  END IF;
END $$;
DROP TABLE staff_notifications;
DROP TABLE staff_telegram_link_codes;
DROP TABLE staff_telegram_links;
DROP TYPE "StaffNotificationStatus";
DROP TYPE "StaffNotificationKind";
COMMIT;
