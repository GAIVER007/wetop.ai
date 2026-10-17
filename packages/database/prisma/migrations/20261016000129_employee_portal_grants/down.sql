-- 129 only repeats the ACL already established by 128. Rolling back 129 must not
-- widen PUBLIC/optional-role access or remove wetop_app access still required by 128.
-- No ACL changes to undo; a full feature rollback continues with 128/down.sql.
SELECT 1;
