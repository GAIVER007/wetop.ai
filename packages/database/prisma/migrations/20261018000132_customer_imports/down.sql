-- Roll back application first. Nonempty journal must stay for audit/undo; never erase imported customers.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE customer_imports,customer_import_rows IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM customer_imports) OR EXISTS(SELECT 1 FROM customer_import_rows) THEN
  RAISE EXCEPTION 'Import journal contains history; keep additive schema and roll back application only';
 END IF;
END $$;
DROP TABLE customer_import_rows;
DROP TABLE customer_imports;
DROP FUNCTION customer_import_scope_guard();
DROP FUNCTION customer_import_row_identity_guard();
COMMIT;
