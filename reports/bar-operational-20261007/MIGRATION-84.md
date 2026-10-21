# BAR financial replay migration 84

Approved scope: D1/D2/D3 and T11, 2026-10-07. Migration: `20261011000084_bar_financial_replay`. Fresh main `5c52340a90d52e3344f81300a5c2a0f04ecf5253` contains Restaurant cash 86/87 and customer VIP/birthday 88; BAR 84 is verified free and retained. The final synced chain has 93 directories. Prior 70/74/90-directory rehearsals are historical evidence; the complete 93-directory rehearsal is mandatory on the final candidate. BAR migrations 55-57 remain unchanged.

## Backup and deployment boundary

Only the isolated localhost PostgreSQL at port 55893 is authorized in this task. Production readiness and domain verification are requested. AGENTS.md §18 reserves code merge and production migration application for the owner; the agent does not manually advance release. No production migration has been applied. Before a separately authorized production rollout: take a complete database backup and schema dump with the existing secret-managed connection, verify restore to a separate database, retain the deployment SHA and migration ledger. Do not print credentials.

## Owner-controlled production order

Before a production action, read the actual deployed SHA and migration ledger. Do not assume that only migration 84 is pending. Reconcile the ordered pending list against fresh main and the approved rollout. Take and verify a complete backup restore in a separate environment. Ensure an interval without BAR writes while the migration backfills history and the matching application version is deployed.

The owner merges only the fully green PR. The owner applies the approved pending migrations and acknowledges the exact release candidate to `wetop-auto-deploy --migrations-applied <sha>` according to docs/deploy.md. The agent does not manually advance release. Re-enable BAR writes only after the deployed SHA, images, health, authenticated BAR routes and debt/warehouse reconciliation are verified. If historical validation fails, keep the prior application and reconcile the named rows under an approved plan; do not delete history or bypass the validation.

## Preflight and backfill

The migration requires an administrative BYPASSRLS role for historical validation. Each legacy sale must have exactly one sale line, a complete SALE movement quantity and FIFO cost matching the persisted sale, a valid existing client key and the expected retail/Folio relation. A partial restock fails the migration. Stop and reconcile the named synthetic/production rows rather than inventing a financial policy or deleting history.

Existing real sale keys are carried into permanent intent records with normalized parameters. Legacy payment/write-off keys are not invented. Existing REVERSED sales are classified from complete BAR_SALE_RETURN evidence. No-restock loss records preserve the original FIFO cost. Existing VOIDED supplier expenses receive a linked reversal record; the original supplier payment, cash row and original audit remain unchanged. The migration ledger and backup preserve evidence of this historical enrichment.

## Validation

Verify unique intent scope `(property_id,kind,key)` and immutable request/result records, app/service DELETE denial that survives rights restoration, exact linked payment/sale ownership and amounts, FORCE RLS for the three new tables, app A/B/unset/empty visibility and service A+B reads, cross-property service writes denied. Functions are SECURITY INVOKER with the current schema, public and pg_temp pinned. Replay success and original effects must commit atomically; rollback leaves no key. Compare warehouse totals, original payments and retained audit before/after. Run the full declared repair suite, schema drift and every down rehearsal.

## Rollback

Use the checked-in `down.sql` only with a complete backup and an application version that no longer queries the new tables/column. Stop BAR writes during a separately authorized rollback. The down migration removes derived replay/reversal/loss records and the reversalRestocked column, preserving original sales, payments, cash operations, movements and audit. The registry scopes keys by operation kind. Before restoring the legacy sale unique index, down.sql rejects a client key reused across RETAIL and FOLIO in the same Property. It does this before removing repaired objects. Resolve that case under a separately approved reconciliation plan; do not delete original sales to force rollback. Export the three derived tables before rollback so client intent identities and financial evidence can be restored. Re-applying from the original backup is preferred; do not pretend schema rollback alone preserves the repaired replay contract.

Local rehearsal uses only disposable databases owned by `scripts/ops/check-migrations.sh`. Test-schema migration tracking is maintained by the integration harness, not Prisma's production migration ledger.

Schema parity: the three derived record IDs use PostgreSQL `gen_random_uuid()` defaults. Prisma uses the matching `dbgenerated` declaration. The first 70-migration rehearsal reproduced the three default mismatches; the corrected schema drift check passes without removing database defaults.
