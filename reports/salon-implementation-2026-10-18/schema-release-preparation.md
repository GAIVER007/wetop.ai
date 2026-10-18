# Beauty schema release preparation: source package, not production cutover

## Owner scope and current remote state

Owner explicitly approved preparation of the five Beauty migrations and reconciliation with existing SQL, with production unchanged until a green full gate, verified backup/restore and exact separate approval. Starting head: f6751e30971b56df22856e245466c77781243437.

During preparation GitHub reported PR677 already MERGED by zapoinov13 at2026-10-18T18:51:46Z, merge SHA2a8f7aab9c8405e03999c005d99b61ffbe8efacf. This worker did not run that merge, reopen/revert it, or claim a pre-merge full green gate. git diff HEAD origin/main was empty at that point: it was a merge-metadata advance of the already published source, not an additional migration-number collision. Full main run39156107469 was in_progress when observed, not a green result for this new preparation package. The preparation belongs in a separate new draft PR.

## Exact source delta

- Whole original heldBeauty131-135 block moved to ordinary133-137, preserving all ten migration.sql/down.sql files byte-for-byte. Source JSON manifest records each original canonical SHA256. Unrelated held114-118 remain held.
- Prisma declarations now mirror existing SQL defaults, constraint/index names and FK update actions. No new business/financial/booking rule, source SQL rewrite or generated diff execution.
- PREPARED_NOT_APPLIED is separate from the untouched historical actual-production RELEASED_SEPARATELY list. Only the exact five approved names, complete unique block, ten correct hashes and strict gate/backup/approval/runner/no-auto-apply requirements are admitted. Invalid, missing, duplicated, unrelated or altered manifest/SQL fails closed. Auto-deploy refusal on new migrations is unchanged.
- Three executable down-file references follow their canonical released paths. A stale customer-name-conflict assertion was aligned with the explicitly approved DATA_MODEL SL4-M4A4621-4629: reuse the organization phone identity without rewriting names/contacts, one identity, and reject archived identity without resurrection. No production customer method was changed.
- A new owned canonical public-schema test creates a uniquely named synthetic child DB, applies136ordinary predecessors, inserts one synthetic legacy appointment, then applies the five prepared migrations. It preserves that proof database, not deleting a donor/shared database.

## Actual database evidence

Recorded final integration `2026-10-18T19-07-15Z-integration-26c0`:79/79 across8files, no skips, no source mutation. Includes9release-proof cases,27appointment-line cases,10position-storage cases and current customer/schedule/RLS/API/stock contracts.

The new nine cases prove:
1. All141canonical migrations actually apply and preserve exact legacy line money/time/master/service snapshots on populated backfill.
2. Actual Prisma7.10 datasource-vs-schema diff exits0 on the ordinary-chain public schema, with no fake migration ledger or ignored missing tables.
3. All ten new tables have ENABLE/FORCE RLS; restricted wetop_app sees0foreign and1own line.
4. Each of the five down scripts actually refuses representative retained configuration/history/price data.
5. Dependency-safe reverse order restores the predecessor column/constraint/index signature and keeps the legacy appointment and price. This is not a promise of rollback after using new models; retained-data guards remain mandatory.

## Review and isolation fix

Initial review found a real test-fixture issue: pg URL query options can override URL authority. Reproduced using pure parsing only, no unsafe connection: RED `2026-10-18T19-02-26Z-unit-eeba`10failed/6passed. The shared pure guard now rejects unsupported protocol, any query and fragment BEFORE constructing pg.Client, then admits only the exact owned local endpoint or dedicated ephemeral CI fixture. GREEN `2026-10-18T19-02-59Z-unit-855a`:38/38 (16endpoint,18manifest,4hold). Final independent rereview `deleg_729ce239` passed with empty security/logic findings; original required finding is preserved in schema-review-initial-required-fix.json.

Only owned local loopback55983/PGDATA and synthetic data were used. Root .env was absent; no production credential/session/PII files opened or copied. Production health remained OK through the approved read-only helper. No production migration, maintenance, service restart, deployment or release movement by this worker.

## Final frozen-source local gate

- Full unit:6232passed,0failed,7preexisting skips out of6239, `2026-10-18T19-03-32Z-unit-3b58`.
- Targeted real DB:79/79, `2026-10-18T19-07-15Z-integration-26c0`.
- Root/API/web typecheck PASS, `2026-10-18T19-07-35Z-typecheck-f6c2`.
- Lint PASS, `2026-10-18T19-08-38Z-lint-b7fe`.
- All four final entries have codeChangedDuringRun=false. Failed RED and successful intermediate logs are retained too.
- Visual review: desktop shows Monday10:00-18:00 and the saved-status text with a visible save button. Mobile390viewport shows legible time fields and no apparent horizontal clipping; lower days/footer are below the initial viewport, so this image alone is not a mobile save-button/touch acceptance test.
- Strict real UI/API/DB on141ordinary chain PASS1/1, `2026-10-18T19-11-07Z-e2e-310e`: registration, wetop_app(false/false/0),09:00save,4/4onboarding,reload,10:00save,stale409,demoted403. Independent SQL aggregate:1synthetic master,1Monday interval,10:00-18:00persisted=true. Desktop/mobile viewport screenshots retained as schema-prep-schedule-desktop/mobile.png; mobile is not a separate touch project.

## Outstanding production gates

This is preparation, not deployment and not completion of all94scenarios. Exact candidate must pass full release-checks, with independent review of the resulting main if merged. Then current production migration status, immutable code/image provenance, fresh trusted backup/isolated restore check, compatible old/new writers, maintenance/backfill/validation and separately pinned migration/cutover authorization are required. Existing no-arg migration helper alone grants neither approval nor the cutover call. Clone/deployed markers and current mixed package matches do not prove image contents. Do not use --migrations-applied until the actual approved migration and validation succeeded.

All private diagnostics and owned PGDATA remain preserved. Tree ACTIVE/KEEP; original dirty .gitignore, premium screenshot and older untracked work untouched. No cleanup/slot release implied.
