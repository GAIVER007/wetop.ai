-- 172 PARTNERS-20261030 (владелец 30.10.2026, «да, делай так»; DATA_MODEL §63.1 и §63 команда).
-- Команда WETOP: телефон человека и «цифровой сотрудник» (только имя и зарплата); должность у цифрового не нужна.
-- Партнёры WETOP: кто приводит клиентов и под какой процент; у подписки клиента отметка партнёра; выплата партнёру это
-- расход компании статьи PARTNERS с отметкой партнёра. Аддитивно, старые строки не меняются; как вся 166: RLS нет,
-- wetop_app прав нет, wetop_service SELECT/INSERT/UPDATE без DELETE.
ALTER TABLE platform_team_members ADD COLUMN IF NOT EXISTS phone varchar(40);
ALTER TABLE platform_team_members ADD COLUMN IF NOT EXISTS kind varchar(10) NOT NULL DEFAULT 'PERSON';
ALTER TABLE platform_team_members DROP CONSTRAINT IF EXISTS platform_team_members_kind;
ALTER TABLE platform_team_members ADD CONSTRAINT platform_team_members_kind CHECK (kind IN ('PERSON', 'DIGITAL'));
ALTER TABLE platform_team_members ALTER COLUMN role DROP NOT NULL;

CREATE TABLE IF NOT EXISTS platform_partners (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  phone varchar(40),
  email varchar(320),
  -- сотые доли процента: 2000 это 20%
  percent_bp integer NOT NULL CHECK (percent_bp BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- чей клиент: отметка в отдельной строке клиента, у клиента без подписки тоже бывает партнёр; снятая отметка это
-- partner_id NULL (строки не удаляются: DELETE нет ни у одной роли)
CREATE TABLE IF NOT EXISTS platform_client_partners (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES platform_partners(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS platform_client_partners_partner ON platform_client_partners (partner_id);

-- выплата партнёру: расход статьи PARTNERS с отметкой партнёра
ALTER TABLE platform_expenses ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES platform_partners(id);
ALTER TABLE platform_expenses DROP CONSTRAINT IF EXISTS platform_expenses_category_check;
ALTER TABLE platform_expenses ADD CONSTRAINT platform_expenses_category_check
  CHECK (category IN ('SERVER', 'DOMAINS', 'ADS', 'AI', 'SALARIES', 'SERVICES', 'PARTNERS', 'OTHER'));
ALTER TABLE platform_expenses DROP CONSTRAINT IF EXISTS platform_expenses_partner;
ALTER TABLE platform_expenses ADD CONSTRAINT platform_expenses_partner
  CHECK ((category = 'PARTNERS') = (partner_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS platform_expenses_partner ON platform_expenses (partner_id) WHERE partner_id IS NOT NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['platform_partners','platform_client_partners'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_app') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM wetop_app', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_service') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO wetop_service', t);
      EXECUTE format('REVOKE DELETE ON TABLE %I FROM wetop_service', t);
    END IF;
  END LOOP;
END $$;
