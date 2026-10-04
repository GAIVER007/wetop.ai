-- Шесть триггерных функций Beauty (миграция …044) остались без закреплённого search_path. Так было сделано
-- намеренно: первая версия с `SET search_path = ''` и именами через `public.` роняла все интеграционные
-- тесты, потому что те же таблицы живут и в схеме pms_test (ADR-042), и одна функция должна работать в
-- обеих. Способ из миграции …043 решает это иначе и лучше: путь закрепляется **по своей схеме**
-- (`current_schema()`), поэтому неквалифицированные имена внутри тела по-прежнему находят таблицы своей
-- схемы, а подменить их таблицей из чужой схемы, стоящей в пути раньше, уже нельзя.
--
-- Приводим функции Beauty к тому же правилу. Тела функций не меняются, только путь.
-- Миграцию …044 править нельзя: она применена, её контрольная сумма записана.
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
      AND p.proname LIKE 'beauty\_%'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %s', fn, path);
  END LOOP;
END $$;
