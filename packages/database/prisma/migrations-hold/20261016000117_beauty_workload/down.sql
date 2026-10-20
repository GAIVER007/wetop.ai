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
IF to_regclass(format('%I.%I',current_schema(),'appointment_workload_revisions')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: appointment_workload_revisions'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'appointment_workload_revisions');
IF to_regclass(format('%I.%I',current_schema(),'appointments')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: appointments'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'appointments');
IF to_regclass(format('%I.%I',current_schema(),'beauty_capacity_intervals')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: beauty_capacity_intervals'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'beauty_capacity_intervals');
IF to_regclass(format('%I.%I',current_schema(),'beauty_schedule_versions')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: beauty_schedule_versions'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'beauty_schedule_versions');
IF to_regclass(format('%I.%I',current_schema(),'employee_locations')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: employee_locations'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'employee_locations');
IF to_regclass(format('%I.%I',current_schema(),'employees')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: employees'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'employees');
IF to_regclass(format('%I.%I',current_schema(),'locations')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: locations'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'locations');
IF to_regclass(format('%I.%I',current_schema(),'time_offs')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: time_offs'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'time_offs');
IF to_regclass(format('%I.%I',current_schema(),'working_hours')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: working_hours'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'working_hours');
IF to_regclass(format('%I.%I',current_schema(),'hospitality_workload_versions')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: hospitality_workload_versions'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'hospitality_workload_sources')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: hospitality_workload_sources'; END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'beauty_schedule_versions') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: beauty_schedule_versions (including voided/cancelled history)'; END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'beauty_capacity_intervals') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: beauty_capacity_intervals (including voided/cancelled history)'; END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'appointment_workload_revisions') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: appointment_workload_revisions (including voided/cancelled history)'; END IF;
END $$;
DROP TRIGGER IF EXISTS beauty_appointment_history ON appointments;
DROP TRIGGER IF EXISTS beauty_hours_history ON working_hours;
DROP TRIGGER IF EXISTS beauty_absence_history ON time_offs;
DROP TRIGGER IF EXISTS beauty_assignment_history ON employee_locations;
DROP TRIGGER IF EXISTS beauty_employee_history ON employees;
DROP TRIGGER IF EXISTS beauty_zone_history ON locations;
DROP TRIGGER beauty_history_guard ON beauty_schedule_versions;
DROP POLICY rls_tenant ON beauty_schedule_versions;
DROP TRIGGER beauty_history_guard ON beauty_capacity_intervals;
DROP POLICY rls_tenant ON beauty_capacity_intervals;
DROP TRIGGER beauty_history_guard ON appointment_workload_revisions;
DROP POLICY rls_tenant ON appointment_workload_revisions;
DROP INDEX beauty_capacity_window;
DROP INDEX beauty_appointment_history;
DROP FUNCTION beauty_history_tenant_guard();
DROP FUNCTION beauty_capacity_changed();
DROP FUNCTION beauty_appointment_changed();
DROP FUNCTION capture_beauty_schedule(uuid);
DROP TABLE appointment_workload_revisions;
DROP TABLE beauty_capacity_intervals;
DROP TABLE beauty_schedule_versions;
-- Table-owned constraints and identity sequences leave with their owning empty table.
-- Shared btree_gist extension, business sources and their RLS remain installed.
COMMIT;
