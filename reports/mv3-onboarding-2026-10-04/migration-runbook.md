# MV3 migration 52 runbook

Production is not authorized. This session uses only isolated localhost PostgreSQL.

## Preflight and backup

Record target PostgreSQL version, applied migration list and application SHA. Confirm migration 51 is already applied before rollout of MV2/MV3. Back up using encrypted pg_dump outside Git and validate a restore on an isolated database. Record counts for Business, Location and Property. Verify onboarding_progress does not already exist with an incompatible definition.

## Apply and validation

Apply reviewed 20261004000052_onboarding_progress through the normal migration process. This creates an empty progress table and its RLS policy; there is no Business/Location/Property backfill. Verify unchanged chain counts, primary key/FK, draft size constraint, flow version constraint and wetop_app tenant isolation. Exercise progress save/reload, wrong scope, READ_ONLY, concurrent stale tab and shared completion. Confirm Hospitality provisioning still creates real inventory and rates.

## Rollback

Roll back the application first; an unused additive table can remain. down.sql takes an exclusive lock and refuses to drop any saved progress. When empty, run the reviewed down script in a maintenance window and reconcile Prisma migration history before reapplying. When progress exists, retain the table or obtain an explicit data archival/retention decision; do not silently delete drafts. A database restore requires a separate recovery decision because later writes would be lost.
