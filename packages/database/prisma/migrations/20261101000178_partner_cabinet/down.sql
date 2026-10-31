-- Откат 178. Привязки партнёров к учёткам, приглашения и клиентов по ссылке молча не стираем: сначала копия базы.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM platform_partner_invites)
     OR EXISTS (SELECT 1 FROM platform_partners WHERE user_id IS NOT NULL OR organization_id IS NOT NULL OR code IS NOT NULL)
     OR EXISTS (SELECT 1 FROM platform_client_partners WHERE source <> 'MANUAL' OR channel IS NOT NULL) THEN
    RAISE EXCEPTION 'Есть приглашения, входы партнёров или клиенты по ссылке: откат только по копии базы';
  END IF;
END $$;
ALTER TABLE platform_client_partners DROP CONSTRAINT IF EXISTS platform_client_partners_source;
ALTER TABLE platform_client_partners DROP COLUMN IF EXISTS channel;
ALTER TABLE platform_client_partners DROP COLUMN IF EXISTS source;
DROP TABLE IF EXISTS platform_partner_invites;
DROP INDEX IF EXISTS platform_partners_code;
DROP INDEX IF EXISTS platform_partners_organization;
DROP INDEX IF EXISTS platform_partners_user;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS code;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS organization_id;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS user_id;
