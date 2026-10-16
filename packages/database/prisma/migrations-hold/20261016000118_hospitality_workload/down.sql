-- EMPTY, NEVER-OBSERVED rollback only. Populated state requires forward repair.
-- Strict contract: missing owned/source relations REFUSE; not an idempotent repair script.
BEGIN;
-- Fresh snapshots after waiting for source locks; inherited REPEATABLE READ is unsafe.
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL row_security=off;
SELECT pg_advisory_xact_lock(16000114);
DO $$ DECLARE t text; found boolean; BEGIN
IF current_schema() IS NULL THEN RAISE EXCEPTION 'ROLLBACK_SCHEMA_REQUIRED'; END IF;
-- Pin all subsequent unqualified teardown to the exact schema being locked.
PERFORM pg_catalog.set_config('search_path',format('%I,pg_catalog,pg_temp',current_schema()),true);
IF to_regclass(format('%I.%I',current_schema(),'allocations')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: allocations'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'allocations');
IF to_regclass(format('%I.%I',current_schema(),'hospitality_workload_sources')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: hospitality_workload_sources'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'hospitality_workload_sources');
IF to_regclass(format('%I.%I',current_schema(),'hospitality_workload_versions')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: hospitality_workload_versions'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'hospitality_workload_versions');
IF to_regclass(format('%I.%I',current_schema(),'inventory_blocks')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: inventory_blocks'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'inventory_blocks');
IF to_regclass(format('%I.%I',current_schema(),'inventory_units')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: inventory_units'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'inventory_units');
IF to_regclass(format('%I.%I',current_schema(),'properties')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: properties'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'properties');
IF to_regclass(format('%I.%I',current_schema(),'reservation_items')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: reservation_items'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'reservation_items');
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'hospitality_workload_versions') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: hospitality_workload_versions (including voided/cancelled history)'; END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'hospitality_workload_sources') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: hospitality_workload_sources (including voided/cancelled history)'; END IF;
END $$;
DROP TRIGGER IF EXISTS hospitality_units ON inventory_units;
DROP TRIGGER IF EXISTS hospitality_allocations ON allocations;
DROP TRIGGER IF EXISTS hospitality_blocks ON inventory_blocks;
DROP TRIGGER IF EXISTS hospitality_stays ON reservation_items;
DROP TRIGGER IF EXISTS hospitality_zone ON properties;
DROP TRIGGER hospitality_immutable ON hospitality_workload_versions;
DROP POLICY rls_tenant ON hospitality_workload_versions;
DROP TRIGGER hospitality_immutable ON hospitality_workload_sources;
DROP POLICY rls_tenant ON hospitality_workload_sources;
DROP INDEX hospitality_history_scope;
DROP INDEX hospitality_source_version;
DROP FUNCTION hospitality_history_guard();
DROP FUNCTION hospitality_workload_changed();
DROP FUNCTION capture_hospitality_workload(uuid);
DROP TABLE hospitality_workload_sources;
DROP TABLE hospitality_workload_versions;
-- Table-owned constraints and identity sequences leave with their owning empty table.
-- Shared btree_gist extension, business sources and their RLS remain installed.
COMMIT;
