\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(16000114);
\ir 20261016000114_expense_links/migration.sql
\ir 20261016000115_table_occupancy/migration.sql
\ir 20261016000116_restaurant_capacity/migration.sql
\ir 20261016000116_restaurant_capacity/opening.sql
\ir 20261016000117_beauty_workload/migration.sql
\ir 20261016000118_hospitality_workload/migration.sql
COMMIT;
