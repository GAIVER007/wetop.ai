BEGIN;
LOCK TABLE beauty_position_permissions, beauty_position_assignments, beauty_positions IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM beauty_positions)
    OR EXISTS (SELECT 1 FROM beauty_position_permissions)
    OR EXISTS (SELECT 1 FROM beauty_position_assignments) THEN
    RAISE EXCEPTION 'Export Beauty positions, permissions and assignments before rollback';
  END IF;
END $$;
DROP TRIGGER beauty_position_assignment_retain ON beauty_position_assignments;
DROP TRIGGER beauty_position_assignment_guard ON beauty_position_assignments;
DROP TRIGGER beauty_position_guard ON beauty_positions;
DROP FUNCTION beauty_position_assignment_retain();
DROP FUNCTION beauty_position_assignment_guard();
DROP FUNCTION beauty_position_guard();
DROP TABLE beauty_position_permissions;
DROP TABLE beauty_position_assignments;
DROP TABLE beauty_positions;
COMMIT;
