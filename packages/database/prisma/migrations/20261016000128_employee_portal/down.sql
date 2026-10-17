-- HELD rollback: disable portal code first; back up these tables before dropping user content.
-- Apply with exactly the same explicit search_path as migration.sql. No CASCADE.
BEGIN;
DROP FUNCTION resolve_public_employee(text);
DROP TRIGGER employee_portfolio_scope ON employee_portfolio_items;
DROP FUNCTION employee_portfolio_scope_guard();
DROP TABLE employee_portfolio_items;
DROP TABLE employee_media;
DROP TABLE employee_public_profiles;
DROP TABLE beauty_payroll_policies;
DROP INDEX employees_active_business_user_unique;
COMMIT;
