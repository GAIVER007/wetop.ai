-- Советник Supabase 02.10.2026, «function_search_path_mutable» (запись CLAUDE.md §2 о чистке Supabase): у 13 функций,
-- тогда ещё без функции кассы, search_path не был закреплён и брался у того, кто вызвал. Таблица или функция с тем же
-- именем в схеме, стоящей в пути раньше, подменила бы нашу; среди функций и RLS (app_current_org,
-- app_property_visible), и защита журнала (audit_logs_immutable).
--
-- Закрепляем путь у всех своих функций схемы: сначала её схема, затем public (там btree_gist), временная схема
-- последней. Функции расширений не трогаем: их путь задаёт расширение. Тела функций не меняются.
-- Идёт и в public, и в pms_test: по current_schema(), как 026/033/042. Новые функции обязаны закреплять путь сами,
-- это держит tests/integration/function-search-path.test.ts.
DO $$
DECLARE
  s text := current_schema();
  path text;
  fn regprocedure;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = s
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %s', fn, path);
  END LOOP;
END $$;
