DO $$ BEGIN IF EXISTS (SELECT 1 FROM bar_sales GROUP BY property_id,idempotency_key HAVING count(*)>1) THEN RAISE EXCEPTION 'Legacy key uniqueness cannot be restored; preserve both operations and restore backup'; END IF; END $$;
DROP TRIGGER bar_sales_financial_parent_guard ON bar_sales;
DROP TRIGGER bar_supplier_payments_financial_parent_guard ON bar_supplier_payments;
DROP TABLE bar_operation_intents;
DROP TABLE bar_supplier_payment_reversals;
DROP TABLE bar_cost_losses;
DROP FUNCTION bar_financial_record_guard();
DROP FUNCTION bar_financial_parent_guard();
ALTER TABLE bar_sales DROP COLUMN reversal_restocked;

DROP INDEX bar_sales_property_id_idempotency_key_idx;
CREATE UNIQUE INDEX bar_sales_property_id_idempotency_key_key ON bar_sales(property_id,idempotency_key);
