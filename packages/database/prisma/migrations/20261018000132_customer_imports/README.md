# Customer import journal, release procedure

Model: DATA_MODEL.md SL4-M4B-OWNER-APPROVAL-20261018. Plan: plans/salons-m4b2-2026-10-18.md. This additive migration does not rewrite customers, appointments or money. Production application is owner-operated.

## Before applying (owner)

1. Stop starting new imports and disable the import worker during application/rollback. Confirm the running release and migration132 are the intended versions.
2. Create a database backup and verify restoration on a separate environment according to docs/ops/backups.md. Keep the backup in approved storage, never logs or Git.
3. Record only aggregate customer/link/history counts; no names, phones or input payloads in the release log. Check catalog for pre-existing customer_imports/customer_import_rows; do not drop or overwrite an existing journal to retry a migration.
4. Apply migration.sql with stop-on-error, in the intended schema. It has its own transaction and 5 second lock timeout. Do not apply it through the agent to production.

## Validation

Both tables exist; FORCE RLS and tenant policy are enabled; wetop_app can SELECT/INSERT/UPDATE but cannot DELETE journal rows; public/anonymous roles have no access. Scope trigger rejects cross-organization business, parent identity changes and source row reparenting. Unique request key and row ordinal reject repeats. The journal has no FK to Customer, so safe undo can delete only newly created customers without erasing the journal. Aggregate customer/link/history counts from before the additive migration remain unchanged.

After code release, check one synthetic sandbox import (stage/submit/retry/process/read/undo), role denials, durable restart and retention. A merge, migration success or local test is not deployment proof; verify deployed SHA and runtime per docs/deploy.md.

## Rollback

Roll back/disable the application feature and worker first. If the journal is empty, down.sql removes only the new empty tables and helper functions, preserving all existing customer/business data. It takes an exclusive lock, checks emptiness again inside the same transaction and refuses a nonempty journal.

If any imports exist, keep the additive schema and roll back application code only. Never DROP a populated journal or delete imported customers as a schema rollback. Reconcile pending/partial jobs using the journal and approved undo rules. Data recovery from backup is a separate owner decision, not an automatic down migration. Preserve journal and audit when investigating a failed release.
