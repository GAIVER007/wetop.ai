-- 178 Кабинет партнёра WETOP (владелец 31.10.2026 «Да, делай этот срез»; ТЗ VTOP 01.11.2026; DATA_MODEL §63.3).
-- Вход партнёра своей учёткой, Partner ID для ссылки, одноразовые приглашения, источник клиента (ссылка или вручную).
-- Ссылки на users и organizations без внешних ключей, как в schema.prisma (связь держит код; гейт сверяет схему).
-- Аддитивно, существующие строки не меняются. Права как у 172: RLS нет, wetop_app без прав, wetop_service без DELETE.
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS code varchar(12);
CREATE UNIQUE INDEX IF NOT EXISTS platform_partners_user ON platform_partners (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS platform_partners_organization ON platform_partners (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS platform_partners_code ON platform_partners (code);

CREATE TABLE IF NOT EXISTS platform_partner_invites (
  id uuid PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES platform_partners(id),
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT platform_partner_invites_accepted CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);
CREATE INDEX IF NOT EXISTS platform_partner_invites_partner ON platform_partner_invites (partner_id);

ALTER TABLE platform_client_partners ADD COLUMN IF NOT EXISTS source varchar(10) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE platform_client_partners ADD COLUMN IF NOT EXISTS channel varchar(30);
ALTER TABLE platform_client_partners DROP CONSTRAINT IF EXISTS platform_client_partners_source;
ALTER TABLE platform_client_partners ADD CONSTRAINT platform_client_partners_source CHECK (source IN ('MANUAL', 'LINK'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_app') THEN
    EXECUTE 'REVOKE ALL ON TABLE platform_partner_invites FROM wetop_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_service') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE platform_partner_invites TO wetop_service';
    EXECUTE 'REVOKE DELETE ON TABLE platform_partner_invites FROM wetop_service';
  END IF;
END $$;
