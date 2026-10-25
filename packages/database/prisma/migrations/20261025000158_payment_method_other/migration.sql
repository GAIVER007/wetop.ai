-- 158 Способ оплаты «Другое» в кассе филиала салона и ресторана (DATA_MODEL PAYMENT-OTHER-PROPOSAL-20261025,
-- утверждено владельцем 25.10.2026 «Давай да»; docs/decisions/2026-10-25-payment-method-other.md).
-- Аддитивно: новое значение перечисления, CHECK набора способов филиала расширяется, таблицы гостиницы закрыты для
-- OTHER так же, как для BONUS (миграция 141). Строк настроек не создаётся: без строки «Другое» выключено (домен).
-- ALTER TYPE ... ADD VALUE в транзакции допустим, пока новое значение в ней не используется: проверки ниже
-- сравнивают текст способа.
BEGIN;

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "branch_payment_method_settings" DROP CONSTRAINT "branch_payment_method_settings_method_branch";
ALTER TABLE "branch_payment_method_settings" ADD CONSTRAINT "branch_payment_method_settings_method_branch" CHECK (
  "method"::text IN ('CASH','CARD_TERMINAL','KASPI','HALYK','BANK_TRANSFER_PERSON','BANK_TRANSFER_LEGAL','OTHER')
);

-- гостиница: счёт гостя, касса объекта, сверка, настройки объекта; запросы оплаты уже закрыты payment_requests_method
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_not_other" CHECK ("method"::text <> 'OTHER');
ALTER TABLE "cash_operations" ADD CONSTRAINT "cash_operations_method_not_other"
  CHECK ("method"::text <> 'OTHER' AND ("method_to" IS NULL OR "method_to"::text <> 'OTHER'));
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_method_not_other" CHECK ("method"::text <> 'OTHER');
ALTER TABLE "payment_method_settings" ADD CONSTRAINT "payment_method_settings_method_not_other" CHECK ("method"::text <> 'OTHER');

COMMIT;
