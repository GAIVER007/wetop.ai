# Employee portal grants replay (129)

Pure, idempotent replay of migration 128's ACL, with no new rights or schema/RLS changes.
`db-restore-prod.sh` already selects pure GRANT/REVOKE migrations and skips mixed schema
migration 128. Do not change that stock selector or replay 128 after pg_restore.

- **Backup / production:** follow `docs/ops/backups.md` and owner-approved cutover procedure;
  this change does not authorize production execution. The dump must include migration 128.
- **Apply:** run `migration.sql` through the normal migration runner after 128. No internal
  transaction boundaries, so stock restore retains its single atomic transaction.
- **Validate:** compare all four tables' ACLs and both functions' ACLs before/after stock
  restore, plus RLS/policy definitions. `tests/restore/employee-portal-grants-restore.test.ts`
  rehearses real `pg_dump --no-privileges` → unchanged stock restore with optional roles absent
  and present, repeats 129 twice, and checks its rollback. It uses only disposable databases
  on an explicitly opted-in dedicated loopback cluster (`EMPLOYEE_PORTAL_RESTORE_TEST_URL`),
  never `DATABASE_URL`. Run without shared integration setup or loading `.env`:

  ```sh
  EMPLOYEE_PORTAL_RESTORE_TEST_URL=postgresql://postgres@127.0.0.1:55624/postgres \
    npx vitest run --config tests/restore/employee-portal-grants-restore.config.ts
  ```

  The cluster must initially have no `anon`/`authenticated` roles;
  the test creates/drops these roles only for its present-role case.
- **Rollback:** run `down.sql` (intentional no-op). 128 already owns these ACLs; revoking
  wetop_app or reopening PUBLIC on rollback would violate the pre-129 contract. For full
  feature rollback, continue with `128/down.sql` using its documented procedure.

No roles are created by the migration. Only existing `anon`/`authenticated` roles have
portal-table and public-resolver rights revoked, matching 128 exactly. `wetop_service`
rights inherited from earlier default privileges remain unchanged.
