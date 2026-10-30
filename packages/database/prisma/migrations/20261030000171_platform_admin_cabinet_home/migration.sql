-- 171 Кабинет WETOP по умолчанию (владелец 30.10.2026: «zapoinov@bk.ru видит только кабинет WETOP по умолчанию,
-- а Вячеслав как сейчас»), DATA_MODEL §16.2, PLATFORM-CABINET-HOME-20261030. Колонка-отметка у главного администратора:
-- при входе и открытии приложения вести в Кабинет WETOP. По умолчанию false: у всех как раньше.
ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "cabinet_home" BOOLEAN NOT NULL DEFAULT false;
-- Учётка компании (профиль компании zapoinov@bk.ru, ADR кабинета 28.10.2026): отметку ставит владелец этим решением.
-- Только если такая учётка есть и она главный администратор; иначе ничего (новая установка, тесты).
UPDATE "platform_admins" pa SET "cabinet_home" = true
FROM "users" u
WHERE u.id = pa.user_id AND lower(u.email) = 'zapoinov@bk.ru' AND pa.revoked_at IS NULL;
-- Читать отметку роли организации (как user_id и revoked_at, миграция 033): кто вошёл, решает экран входа
DO $$
DECLARE s text := current_schema();
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_app') THEN
    EXECUTE format('GRANT SELECT (cabinet_home) ON TABLE %I.platform_admins TO wetop_app', s);
  END IF;
END $$;
