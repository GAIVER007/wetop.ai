-- Откат COMPANY-MONEY-20261028. Деньги компании с записями не стираются молча: сначала копия базы.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM platform_payments) OR EXISTS (SELECT 1 FROM platform_expenses)
     OR EXISTS (SELECT 1 FROM platform_subscriptions) OR EXISTS (SELECT 1 FROM platform_team_members)
     OR EXISTS (SELECT 1 FROM platform_plans) THEN
    RAISE EXCEPTION 'В кабинете WETOP уже есть записи: откат только по копии базы';
  END IF;
END $$;
DROP TABLE platform_team_members, platform_expenses, platform_payments, platform_subscriptions, platform_plans;
