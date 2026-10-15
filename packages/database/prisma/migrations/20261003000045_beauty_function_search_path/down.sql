-- Откат 20261003000045_beauty_function_search_path: снять закрепление пути у функций Beauty.
-- Возвращает их в состояние после миграции …044, где путь брался у вызывающего.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = current_schema()
      AND p.prokind = 'f'
      AND p.proname LIKE 'beauty\_%'
  LOOP
    EXECUTE format('ALTER FUNCTION %s RESET search_path', fn);
  END LOOP;
END $$;
