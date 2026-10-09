-- Закрепляет search_path у membership_scope_guard() из …072_membership_scopes, как у прочих функций схемы
-- (property_media_guard в …073_property_media): функция триггера не ищет имена в чужой схеме.
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.membership_scope_guard() SET search_path = %s', s, path);
END $$;
