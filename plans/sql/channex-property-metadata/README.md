# Channex property metadata migration 041

Scope: nullable `properties.country_code`, `city`, `channex_property_type`; known Luxx Aparts
backfill only. Other properties remain unset until their owner fills the form. No reservation,
pricing, or OTA rows change.

1. Before production migration, take a timestamped encrypted database backup using
   `docs/ops/backups.md`. Record backup path and successful `pg_restore --list` exit code.
   Export the current `properties` IDs and a digest of the existing columns. Do not print
   contact data in logs or reports.
2. Apply `migration.sql` through the normal deploy migration runner in `docs/deploy.md`.
   Confirm Prisma reports migration 041 applied once.
3. Run `validate.sql`: three columns exist, only the known Luxx ID received default metadata,
   existing property count and IDs did not change. Check the saved digest of old columns.
4. Roll back application code first if necessary. If no owner has yet edited the new fields,
   apply `down.sql` and mark the migration rolled back through Prisma's documented process.
   Once any owner edits metadata, first export those rows to the protected backup, then
   decide between forward fix and column removal; `down.sql` discards the three fields.
