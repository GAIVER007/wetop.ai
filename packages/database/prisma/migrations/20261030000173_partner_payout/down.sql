-- Откат 173. Оплаты допов и суммы выплат партнёрам молча не стираем: сначала копия базы.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM platform_payments WHERE kind = 'ADDON') OR EXISTS (SELECT 1 FROM platform_plans WHERE partner_payout_cents IS NOT NULL) THEN
    RAISE EXCEPTION 'Есть оплаты допов или суммы выплат партнёрам: откат только по копии базы';
  END IF;
END $$;
ALTER TABLE platform_payments DROP CONSTRAINT IF EXISTS platform_payments_kind;
ALTER TABLE platform_payments DROP COLUMN IF EXISTS kind;
ALTER TABLE platform_plans DROP CONSTRAINT IF EXISTS platform_plans_partner_payout;
ALTER TABLE platform_plans DROP COLUMN IF EXISTS partner_payout_cents;
