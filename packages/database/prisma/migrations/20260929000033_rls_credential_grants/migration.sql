-- DATA_MODEL v1.15 §17.2–17.3 (ADR-124), SEC-1b стадия A (аудит 29.09.2026): у роли запросов организации `wetop_app`
-- отзываются права на учётные данные и отметки главного администратора.
--
-- Было: миграция `…026_rls_roles` выдала `wetop_app` SELECT/INSERT/UPDATE/DELETE на все таблицы схемы, хотя §17.3
-- называет десять таблиц без RLS «только `wetop_service` читает по делу». Одна пропущенная проверка или инъекция под
-- организацией отдавала хеши паролей (`users.password_hash`), а запись в `platform_admins` — права главного администратора.
--
-- Стало:
--   password_resets, email_verifications, wizard_sessions, wizard_events, wizard_surveys — никаких прав: их читает и пишет
--     только служебный путь (вход, регистрация, сброс пароля, мастер до входа, фоновые циклы);
--   users — только чтение колонок id, email, name, status, email_verified_at: имена авторов журнала и коллег, статус
--     для проверок прав. Хеш пароля, счётчик попыток и блокировка недоступны, писать в таблицу нельзя;
--   platform_admins — только чтение user_id и revoked_at (бот поддержки спрашивает, главный ли администратор).
-- Внешние ключи на `users` (audit_logs.user_id и др.) проверяются от владельца таблицы и прав на `users` не требуют.
--
-- Код API к этой миграции готов заранее: `whoami` и смена пароля читают `users` служебной ролью, выбор пользователя в
-- агентах ИИ-продавца перечисляет колонки. Порядок выкладки — сначала код, потом миграция (docs/ops/rls.md).
-- Интеграционные таблицы (external_events, channel_outbox, system_incidents) не тронуты — стадия B.
--
-- Идёт и в public, и в pms_test (ADR-042): права выдаются по current_schema(), как в …026.
DO $$
DECLARE s text := current_schema();
BEGIN
  EXECUTE format(
    'REVOKE ALL ON TABLE %1$I.password_resets, %1$I.email_verifications, %1$I.wizard_sessions, %1$I.wizard_events, %1$I.wizard_surveys FROM wetop_app',
    s
  );
  -- REVOKE ALL на таблице снимает и колоночные права; нужные колонки выдаются заново
  EXECUTE format('REVOKE ALL ON TABLE %I.users FROM wetop_app', s);
  EXECUTE format('GRANT SELECT (id, email, name, status, email_verified_at) ON TABLE %I.users TO wetop_app', s);
  EXECUTE format('REVOKE ALL ON TABLE %I.platform_admins FROM wetop_app', s);
  EXECUTE format('GRANT SELECT (user_id, revoked_at) ON TABLE %I.platform_admins TO wetop_app', s);
END $$;
