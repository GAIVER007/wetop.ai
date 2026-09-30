-- Аудит 30.09.2026 (п. 2, Supabase): у ролей Data API Supabase `anon` и `authenticated` остались права на схему
-- (SECURITY.md §12, вариант Б плана plans/a0-server-and-supabase-2026-09-22.md §4 — «отобрать права» так и не
-- выполнен). Data API выключен владельцем 22.09.2026, и это единственное, что закрывало таблицы без RLS
-- (`users`, `password_resets`, `external_events`, …) от публичного ключа проекта: включи кто-нибудь Data API снова —
-- они читались бы через PostgREST в обход приложения.
--
-- Стало: у `anon` и `authenticated` нет прав ни на таблицы, ни на последовательности, ни на функции схемы, ни на
-- будущие объекты (умолчания роли миграций). Роли — платформы Supabase, не приложения: на локальном стенде и на
-- ps.kz их нет, и миграция там ничего не делает. Приложение ходит ролями `wetop_app`/`wetop_service` и владельцем
-- таблиц — их права не трогаются.
--
-- Идёт и в public, и в pms_test (ADR-042): по current_schema(), как …026 и …033. Умолчания на будущие объекты
-- снимаются у роли, которой идёт миграция (`postgres` на Supabase — те же, что ставит платформа); умолчания
-- `supabase_admin` отсюда недоступны, их проверяет советник безопасности Supabase.
DO $$
DECLARE
  s text := current_schema();
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', s, r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', s, r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', s, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I', s, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %I', s, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM %I', s, r);
    ELSE
      RAISE NOTICE 'роли % нет — это не Supabase, прав снимать нечего', r;
    END IF;
  END LOOP;
END $$;
