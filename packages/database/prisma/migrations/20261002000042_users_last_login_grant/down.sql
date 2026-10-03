-- Откат: снять колоночный грант last_login_at, остальные гранты SEC-1b (033) не трогаются
DO $$
DECLARE s text := current_schema();
BEGIN
  EXECUTE format('REVOKE SELECT (last_login_at) ON TABLE %I.users FROM wetop_app', s);
END $$;
