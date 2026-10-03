-- Откат 20261003000047_fiscal_receipts: отметки «чек выдан» теряются, платежи не меняются; перед откатом снять копию.
DROP TABLE IF EXISTS "fiscal_receipts";
