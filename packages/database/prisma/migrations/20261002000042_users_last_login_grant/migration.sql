-- «Был в системе» на экране «Сотрудники» (TEAM1, ADR-136): список членов организации читает
-- users.last_login_at. SEC-1b (миграция 033) выдала роли wetop_app только id, email, name, status,
-- email_verified_at, и на проде выборка падала «permission denied» (найдено владельцем 02.10.2026).
-- Дата последнего входа не учётные данные (хеш пароля, счётчик попыток и блокировка остаются закрыты),
-- поэтому колонка добавляется к открытым. Идёт и в public, и в pms_test: по current_schema(), как 026/033.
DO $$
DECLARE s text := current_schema();
BEGIN
  EXECUTE format('GRANT SELECT (last_login_at) ON TABLE %I.users TO wetop_app', s);
END $$;
