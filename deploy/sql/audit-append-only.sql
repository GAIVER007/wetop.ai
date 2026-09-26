-- Журнал действий только дописывается (DATA_MODEL §10, v1.7 — ADR-082).
-- Выполняет владелец на базе в Казахстане (plans/server-kz-2026-09-17.md, шаг 2), когда у приложения
-- появляется своя непривилегированная роль. На базе с одной ролью (как сейчас) правило вводить не к чему:
-- владелец схемы обходит любые GRANT.
--
-- Роли подставить своими именами:
--   pms_app     — роль, под которой ходит API (DATABASE_URL приложения);
--   pms_ops     — роль уборки и восстановления тестовых данных
--                 (scripts/reconciliation/src/cli-purge-test-data.ts и cli-restore-test-data.ts);
--   миграции выполняет роль владельца схемы, как сейчас, — её этот файл не трогает.
--
-- Проверка после выполнения (под pms_app):
--   INSERT в audit_logs — проходит;
--   UPDATE audit_logs SET action = action WHERE false; — ERROR: permission denied;
--   DELETE FROM audit_logs WHERE false;               — ERROR: permission denied.

BEGIN;

-- У роли приложения журнал открыт только на чтение и дозапись: неизменность держит база, а не привычка кода.
REVOKE ALL ON TABLE audit_logs FROM pms_app;
GRANT SELECT, INSERT ON TABLE audit_logs TO pms_app;

-- Уборка тестовых данных — единственный законный путь удаления строк журнала (фаза auditLogs):
-- она ходит отдельной ролью, которой API не пользуется.
GRANT SELECT, INSERT, DELETE ON TABLE audit_logs TO pms_ops;

COMMIT;
