# Held expense links: rollout and rollback

Status: unreleased, `EXPENSE_LINKS_ENABLED` must remain unset/disabled. This is a link-only persistence increment, NOT a finished unified accounting release. No production migration has been executed.

## Verified scope

Documents link canonical cash operations without creating a new debit. Current SQL includes
supplier receipt validation, expense_supplier_sync backfill of linked payments and INSERT writer hook,
plus immutability guards. This supersedes the earlier supplier-unavailable note; end-to-end supplier
acceptance and production reconciliation are still separate gates. Hotel currency_snapshot is immutable;
unknown historical currency remains NULL and must not be inferred from current settings.

## Before promotion to the normal migration chain

1. Finish approved writer/read-model changes, category setup, supplier synchronization and runtime-role cross-tenant tests. Add HTTP checks and full release gates. Do not enable merely because table creation passes.
2. On a newly isolated local database, apply the complete baseline then this SQL. Test both newly created and existing data paths. Never use shared Supabase or production for test setup.
3. Review statement timeouts, transaction boundaries and lock order against existing cash/supplier writers. Run concurrent old/new writer and void tests.
4. Owner authorizes the exact tested commit/image. Obtain fresh backup and actual restore verification, not only archive listing. No agent-readable secrets or backups.
5. Apply held SQL only in that approved deployment procedure, then validate the tables, functions, constraints, triggers and FORCE RLS under runtime role. Keep feature disabled until compatible code is deployed and reconciled.
6. Verify app.wetop.ai actual image version and authenticated API/UI reconciliation before enabling. Gate completion, merge, migration and deployment are different states.

## Validation

- expense_paid_minor equals the sum of unique linked COMPLETED EXPENSE cash sources in a single proven currency.
- No source operation is linked twice, cross-location references fail, overpayment fails under concurrent links.
- Hotel branch links known snapshots, unknown historical currency is rejected.
- The actual wetop_app role cannot read or write another organization's rows. Catalog flags alone are insufficient proof.
- Existing cash cancellation must remain compatible with source immutability. Test hotel and restaurant cancellation payloads separately.
- Financial row/source counts and category totals before/after are reconciled with no newly created debit from document/link calls.

## Rollback

First disable `EXPENSE_LINKS_ENABLED` and all clients of the new endpoints. Preserve new records and currency snapshots. Prefer application rollback with additive schema retained; do not drop accounting history after writes.

`down.sql` is now executable for empty schema only; all four owned tables and nonnull currency_snapshot
are guarded. Local synthetic rehearsal covers these refusals and reverse teardown, not production
backup restoration. Sources are locked before checks and retained through teardown. Missing relations,
newer held migrations or any retained data refuse. Never erase populated accounting history to unblock it.

This directory remains held until full migration/rollback acceptance. These instructions do not authorize an untested production rollback.
