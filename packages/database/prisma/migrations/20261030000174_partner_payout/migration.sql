-- 174 PARTNER-PAYOUT-20261030 (владелец 30.10.2026: «с 19$ 10», годовой $199 ровно $100, «30% с допов: ИИ-продавец,
-- таргетолог, контент и т. д., всё что связано с допами, с продвижением»; DATA_MODEL §63.2).
-- Выплата партнёру разовая за тариф с первого чека клиента + процент партнёра с допов. Аддитивно, старые строки не
-- меняются: оплаты без отметки считаются тарифом, тарифы без суммы выплаты дают 0. Права как у 166.
ALTER TABLE platform_plans ADD COLUMN IF NOT EXISTS partner_payout_cents bigint;
ALTER TABLE platform_plans DROP CONSTRAINT IF EXISTS platform_plans_partner_payout;
ALTER TABLE platform_plans ADD CONSTRAINT platform_plans_partner_payout CHECK (partner_payout_cents IS NULL OR partner_payout_cents >= 0);

ALTER TABLE platform_payments ADD COLUMN IF NOT EXISTS kind varchar(10) NOT NULL DEFAULT 'PLAN';
ALTER TABLE platform_payments DROP CONSTRAINT IF EXISTS platform_payments_kind;
ALTER TABLE platform_payments ADD CONSTRAINT platform_payments_kind CHECK (kind IN ('PLAN', 'ADDON'));
