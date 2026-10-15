-- Откат 20261002000041_cash_reconciliations: убрать сверки кассы. Операции кассы и счета не
-- затрагиваются; записи сверок теряются — перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "cash_reconciliations";
