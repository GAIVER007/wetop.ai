-- Откат 20261003000046_payment_requests: убрать запросы оплаты. Платежи, созданные кнопкой «Оплачено», остаются
-- обычными платежами; сами запросы теряются — перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "payment_requests";
DROP TYPE IF EXISTS "PaymentRequestStatus";
