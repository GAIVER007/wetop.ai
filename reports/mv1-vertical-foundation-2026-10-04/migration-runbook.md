# FOOD_SERVICE migration procedure

Production execution requires separate owner approval (§14/15). No production commands were executed by this session.

1. Stop application writes and record deployed SHA, migration status, Business count, enum values and PostgreSQL version. Use the direct database connection supplied through secret storage.
2. Take an encrypted `pg_dump --format=custom` backup of the target database. Store outside Git with restricted access. Verify `pg_restore --list` and perform a restore rehearsal in an isolated database before proceeding.
3. Apply reviewed migration through the project's normal Prisma migration deployment procedure. Do not manually mark migration applied without running it.
4. Validate migration status, enum containing HOSPITALITY/BEAUTY/FOOD_SERVICE, unchanged Business count, empty Prisma schema diff and Hospitality smoke tests. Publish no Food self-service entry point.
5. Application rollback: revert to the previous application image. The extra unused enum value is compatible with prior code while no Food businesses exist.
6. Schema rollback, only in a controlled write-free window: verify no FOOD_SERVICE businesses, execute adjacent down.sql. It locks businesses and refuses removal when Food rows exist. Validate the original two values and unchanged counts. Reconcile Prisma migration history with the deployment owner before reapplying; down.sql alone does not reset Prisma's applied history.
7. If Food rows already exist, keep the additive enum and roll back application only. Do not convert or delete product data. A full backup restore requires a separately approved recovery plan because it can lose writes after backup.

Local rehearsal results are in migration-rehearsal.txt.
