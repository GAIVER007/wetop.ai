-- Откат 172. Партнёров с записями и выплаты партнёрам молча не стираем: сначала копия базы.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM platform_partners) OR EXISTS (SELECT 1 FROM platform_expenses WHERE category = 'PARTNERS')
     OR EXISTS (SELECT 1 FROM platform_team_members WHERE kind = 'DIGITAL' OR role IS NULL) THEN
    RAISE EXCEPTION 'Есть партнёры, выплаты партнёрам или цифровые сотрудники: откат только по копии базы';
  END IF;
END $$;
ALTER TABLE platform_expenses DROP CONSTRAINT IF EXISTS platform_expenses_partner;
DROP INDEX IF EXISTS platform_expenses_partner;
ALTER TABLE platform_expenses DROP COLUMN IF EXISTS partner_id;
ALTER TABLE platform_expenses DROP CONSTRAINT IF EXISTS platform_expenses_category_check;
ALTER TABLE platform_expenses ADD CONSTRAINT platform_expenses_category_check
  CHECK (category IN ('SERVER', 'DOMAINS', 'ADS', 'AI', 'SALARIES', 'SERVICES', 'OTHER'));
DROP TABLE IF EXISTS platform_client_partners;
DROP TABLE IF EXISTS platform_partners;
ALTER TABLE platform_team_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE platform_team_members DROP CONSTRAINT IF EXISTS platform_team_members_kind;
ALTER TABLE platform_team_members DROP COLUMN IF EXISTS kind;
ALTER TABLE platform_team_members DROP COLUMN IF EXISTS phone;
