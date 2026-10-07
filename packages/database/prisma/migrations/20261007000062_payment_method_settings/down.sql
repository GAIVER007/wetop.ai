-- Откат 20261007000062_payment_method_settings: настройки способов оплаты теряются, объект возвращается
-- к умолчаниям (все восемь включены). Перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "payment_method_settings";
