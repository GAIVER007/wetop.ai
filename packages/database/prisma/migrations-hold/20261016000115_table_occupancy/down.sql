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
IF to_regclass(format('%I.%I',current_schema(),'businesses')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: businesses'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'businesses');
IF to_regclass(format('%I.%I',current_schema(),'dining_areas')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: dining_areas'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'dining_areas');
IF to_regclass(format('%I.%I',current_schema(),'dining_tables')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: dining_tables'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'dining_tables');
IF to_regclass(format('%I.%I',current_schema(),'locations')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: locations'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'locations');
IF to_regclass(format('%I.%I',current_schema(),'restaurant_orders')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: restaurant_orders'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'restaurant_orders');
IF to_regclass(format('%I.%I',current_schema(),'restaurant_reservations')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: restaurant_reservations'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'restaurant_reservations');
IF to_regclass(format('%I.%I',current_schema(),'table_occupancy_commands')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: table_occupancy_commands'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'table_occupancy_commands');
IF to_regclass(format('%I.%I',current_schema(),'table_occupancy_sessions')) IS NULL THEN RAISE EXCEPTION 'ROLLBACK_MISSING_RELATION: table_occupancy_sessions'; END IF;
EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',current_schema(),'table_occupancy_sessions');
IF to_regclass(format('%I.%I',current_schema(),'workload_tracking_coverage')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: workload_tracking_coverage'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'resource_capacity_revisions')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: resource_capacity_revisions'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'resource_capacity_intervals')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: resource_capacity_intervals'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'workload_coverage_segments')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: workload_coverage_segments'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'restaurant_opening_schedules')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: restaurant_opening_schedules'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'restaurant_opening_intervals')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: restaurant_opening_intervals'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'restaurant_opening_closures')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: restaurant_opening_closures'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'beauty_schedule_versions')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: beauty_schedule_versions'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'beauty_capacity_intervals')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: beauty_capacity_intervals'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'appointment_workload_revisions')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: appointment_workload_revisions'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'hospitality_workload_versions')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: hospitality_workload_versions'; END IF;
IF to_regclass(format('%I.%I',current_schema(),'hospitality_workload_sources')) IS NOT NULL THEN RAISE EXCEPTION 'ROLLBACK_NEWER_RELEASE_INSTALLED: hospitality_workload_sources'; END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'table_occupancy_sessions') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: table_occupancy_sessions (including voided/cancelled history)'; END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I)',current_schema(),'table_occupancy_commands') INTO found;
IF found THEN RAISE EXCEPTION 'ROLLBACK_RETAINED_DATA: table_occupancy_commands (including voided/cancelled history)'; END IF;
END $$;
DROP TRIGGER IF EXISTS occupancy_scope ON table_occupancy_sessions;
DROP TRIGGER IF EXISTS occupancy_command_scope ON table_occupancy_commands;
DROP TRIGGER IF EXISTS occupancy_parent ON dining_tables;
DROP TRIGGER IF EXISTS occupancy_parent ON dining_areas;
DROP TRIGGER IF EXISTS occupancy_parent ON restaurant_reservations;
DROP TRIGGER IF EXISTS occupancy_parent ON restaurant_orders;
DROP TRIGGER IF EXISTS occupancy_parent ON locations;
DROP TRIGGER IF EXISTS occupancy_parent ON businesses;
DROP POLICY rls_tenant ON table_occupancy_sessions;
DROP POLICY rls_tenant ON table_occupancy_commands;
DROP INDEX occupancy_one_active;
DROP INDEX occupancy_one_reservation;
DROP INDEX occupancy_one_order;
DROP INDEX occupancy_history_page;
DROP FUNCTION occupancy_command(uuid,text,text,uuid,uuid,uuid,uuid,uuid);
DROP FUNCTION occupancy_parent_guard();
DROP FUNCTION occupancy_scope_guard();
DROP TABLE table_occupancy_commands;
DROP TABLE table_occupancy_sessions;
-- Table-owned constraints and identity sequences leave with their owning empty table.
-- Shared btree_gist extension, business sources and their RLS remain installed.
COMMIT;
