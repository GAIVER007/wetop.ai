# Channex property metadata migration 041

Scope: nullable `properties.country_code`, `city`, `channex_property_type`; known Luxx Aparts
backfill only. Other properties remain unset until their owner fills the form. No reservation,
pricing, or OTA rows change.

1. Before production migration, take a timestamped database backup in the protected backup directory using
   `docs/ops/backups.md`. Record backup path and successful `pg_restore --list` exit code.
   Export the current `properties` IDs and a digest of the existing columns. Do not print
   contact data in logs or reports.
2. Apply `migration.sql` through the normal deploy migration runner in `docs/deploy.md`.
   Confirm Prisma reports migration 041 applied once.
3. Run `validate.sql`: three columns exist, only the known Luxx ID received default metadata,
   existing property count and IDs did not change. Check the saved digest of old columns.
4. Application rollback: redeploy the previous verified image; the nullable added columns can
   remain and do not affect the previous version. Database rollback was tested with `down.sql`
   followed by `migration.sql` on a separate database. In production, export any edited metadata
   to the protected backup before column removal. For an already successful Prisma migration,
   use a new compensating migration or restore the verified backup; do not mark a completed
   migration as failed and do not edit its history in place.

Applied 04.10.2026 with owner approval. Five unrelated pending migrations (046-050) were excluded
from the temporary migration snapshot; existing migration history and repository files were retained.
Result: 3 metadata columns; 2 properties; old-column digest unchanged. Backup and validation
evidence: reports/channex-multi-property-2026-10-04/report.md.
