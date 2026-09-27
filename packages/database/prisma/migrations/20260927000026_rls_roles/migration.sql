-- DATA_MODEL v1.13 §17.2 (ADR-103), план plans/rls-2026-09-27.md шаг 2: роли базы для Row Level Security.
--
-- Роли общие на весь кластер, поэтому создаются «если нет»: миграция идёт и в public, и в pms_test (ADR-042).
-- Входа у ролей нет (NOLOGIN) и паролей в git нет: вход и пароль включает владелец руками
-- (ALTER ROLE … LOGIN PASSWORD '…'), пароль живёт только в .env — docs/ops/rls.md.
--
-- wetop_app — роль запросов организации: без BYPASSRLS и не владелец таблиц, поэтому на неё действуют политики.
-- wetop_service — служебная: BYPASSRLS. Если у роли миграций нет права раздать BYPASSRLS, роль заводится без него,
-- а служебное подключение остаётся на прежней роли (DATABASE_URL) — политики на неё не действуют (без FORCE, §17.3).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_app') THEN
    CREATE ROLE wetop_app NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_service') THEN
    BEGIN
      CREATE ROLE wetop_service NOLOGIN BYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'wetop_service без BYPASSRLS: служебное подключение остаётся на DATABASE_URL (docs/ops/rls.md)';
      CREATE ROLE wetop_service NOLOGIN;
    END;
  END IF;
END $$;

-- Права на таблицы и последовательности этой схемы — и на будущие, которые создаст роль миграций
DO $$
DECLARE s text := current_schema();
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO wetop_app, wetop_service', s);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO wetop_app, wetop_service', s);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO wetop_app, wetop_service', s);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wetop_app, wetop_service', s);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO wetop_app, wetop_service', s);
END $$;
