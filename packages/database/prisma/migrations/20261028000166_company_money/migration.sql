-- COMPANY-MONEY-20261028 (владелец 28.10.2026: кабинет компании WETOP, «считаем в долларах»; DATA_MODEL §63).
-- Деньги самой компании WETOP: тарифы, подписки клиентов, оплаты от клиентов, расходы компании, команда WETOP.
-- Кто записал, хранится uuid без внешнего ключа, как автор в audit_logs: учётку можно удалить, история денег остаётся.
-- Это не данные организаций: RLS нет, `wetop_app` прав не получает вовсе, читает и пишет только `wetop_service`
-- (раздел «Платформа», ServiceDatabaseInterceptor). Суммы целыми центами USD. Аддитивно: существующие таблицы не меняются.
CREATE TABLE platform_plans (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  period_months smallint NOT NULL DEFAULT 1 CHECK (period_months IN (1, 12)),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_plans_name ON platform_plans (name);

-- одна подписка на клиента: тариф, договорная цена в месяц и «оплачено до»
CREATE TABLE platform_subscriptions (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES platform_plans(id),
  monthly_cents bigint NOT NULL CHECK (monthly_cents >= 0),
  paid_until date,
  note varchar(300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- оплата клиента компании; ошибочная не удаляется, а отменяется (voided_at)
CREATE TABLE platform_payments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  paid_on date NOT NULL,
  note varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid
);
CREATE INDEX platform_payments_day ON platform_payments (paid_on DESC);
CREATE INDEX platform_payments_org ON platform_payments (organization_id, paid_on DESC);

-- расход компании по статье; ошибочный отменяется
CREATE TABLE platform_expenses (
  id uuid PRIMARY KEY,
  category varchar(20) NOT NULL CHECK (category IN ('SERVER', 'DOMAINS', 'ADS', 'AI', 'SALARIES', 'SERVICES', 'OTHER')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  spent_on date NOT NULL,
  note varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid
);
CREATE INDEX platform_expenses_day ON platform_expenses (spent_on DESC);

-- команда компании WETOP; ушедший остаётся в истории с active = false
CREATE TABLE platform_team_members (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  role varchar(100) NOT NULL,
  email varchar(320),
  monthly_salary_cents bigint CHECK (monthly_salary_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['platform_plans','platform_subscriptions','platform_payments','platform_expenses','platform_team_members'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_app') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM wetop_app', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_service') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO wetop_service', t);
      EXECUTE format('REVOKE DELETE ON TABLE %I FROM wetop_service', t);
    END IF;
  END LOOP;
END $$;
