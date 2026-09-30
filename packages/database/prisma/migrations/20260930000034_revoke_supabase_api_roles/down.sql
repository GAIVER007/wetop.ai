-- Откат …034: вернуть ролям Data API права, какие даёт Supabase по умолчанию (ALL на таблицы, последовательности
-- и функции схемы и на будущие объекты). Нужен только если Data API снова открывают для `public` намеренно.
DO $$
DECLARE
  s text := current_schema();
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO %I', s, r);
      EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO %I', s, r);
      EXECUTE format('GRANT ALL ON ALL FUNCTIONS IN SCHEMA %I TO %I', s, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', s, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', s, r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON FUNCTIONS TO %I', s, r);
    END IF;
  END LOOP;
END $$;
