# Approved owner-home variant4: candidate progress, 2026-10-16

NOT A PRODUCTION RELEASE. No production application, database or gateway service was changed by this continuation. Feature branch must not be mistaken for publication.

## Source preservation

Continue `/opt/data/workspace/wetop-unified-owner-data`, branch `feat/unified-owner-data-20261016`. Checkpoint `4cf28b7ee` was pushed earlier. Upstream reconciliation is against pinned `961423ee7`, 129 canonical migrations; no merge conflicts remain. Preserve all existing work and history.

## Implemented and exercised

- Restored approved composition: four KPI, open metric-tab chart, right-side concise data issues, paid-expense categories below. No demo amounts, no occupancy ring.
- Corrected undefined spacing tokens, project breakpoint/copy rules and mobile SVG sizing. Browser-measured chart label size was 4.6475px before correction and 13px at 320/390/768/1440 after it.
- Monetary display remains BigInt-safe; compact chart ticks have exact-value titles and an exact table.
- Partial previous series is explicitly identified. A real `projectDailyMoney` regression reproduced an unknown-currency day incorrectly drawn as zero. Such days now break the line and show incomplete data in the table, for both series. No accounting calculation or currency was invented.
- Owner reader uses existing canonical beauty appointment INCOME records. Customer refunds linked to appointments/orders do not become paid operating expenses or expense settlements. Main payment/replay semantics are retained.
- Six held SQL components pin only their explicitly owned routines to their actual schema, public, pg_temp. 26 distinct owned routines covered. No RLS, authorization or retained-history guard was relaxed.
- RLS integration fixtures create a fresh own unit instead of moving an already-observed seed unit to a new tenant. Optional held inventory must be completely absent or contain all 18 tables; partial installation fails. Every actual tenant table remains covered. Beauty registry likewise strictly supports the six-function baseline or the complete nine-function opt-in mode.
- Three runtime advisories patched without a major-version change: Next 16.3.8, proxy-addr 2.0.8, source-map-js 1.2.2. Parent independently checked matching source/snapshot manifests, installed versions, zero runtime audit vulnerabilities, zero missing/invalid NPM signatures. Shared source-worktree dependencies were not overwritten; final validation uses an isolated secure install.

## Completed evidence

Evidence base: `/opt/data/workspace/wetop-owner-integration-20261016`.
Secure source-identical candidate: `/opt/data/workspace/wetop-owner-dependency-patch-20261016`.

- `patched-unit-aggregate.json`: eight exclusive unit shards, 5,297 total, 5,290 passed, 7 skipped, 0 failed, 0 flaky. Skips are not PASS. The last shard was rerun with the authentic 16,980,374-byte legacy journal fixture copied byte-for-byte, not fabricated data. The earlier missing-fixture and incorrect APP_URL harness runs remain recorded as failures.
- Root/API/web types and full lint passed on secure dependencies; the last isolated integration-fixture change additionally passed root typecheck and targeted lint.
- Default web build on Next16.3.8 passed, not a compiler fallback. It produced 108 pages. Only the exact framework-generated next-env dev-to-production type-reference rewrite is accepted by the immutable-code checker; arbitrary declaration changes still fail.
- Baseline without held schema: `2026-10-16T17-46-05Z-integration-f1eb`, 29/29 passed.
- Complete held schema: `2026-10-16T17-47-16Z-integration-4b70`, 29/29 passed, including strict RLS/FORCE and foreign/no-context isolation.
- Existing canonical money/security repairs: `2026-10-16T16-24-34Z-integration-9455`, 13/13 passed. UI/domain/rollback delta: `2026-10-16T16-26-16Z-unit-00d6`, 27/27 passed; review regression separately rechecked after its type correction.
- `fresh-public-package/result.json`: fresh canonical129 public baseline, all six components atomically applied, 18 tables with RLS/FORCE, 26 owned paths pinned. All five empty down scripts executed independently in the prescribed reverse order. Baseline routine definitions and security/configuration metadata restored exactly.
- `populated-restore-current/result.json`: real dump/restore reconciled counts and logical row hashes for all151 tables. All18 held tables populated. On every held table the application role read its own sample and could not read it under another tenant.
- `utf8-stand-repair.json`: own test DB was originally C locale, verified not to case-fold Cyrillic; it was preserved and cloned with C.utf8. All151 logical tables reconciled. Only own PG55516 restarted with a sufficient shared-lock budget; production PG and Hermes were untouched.
- Real test-stand screenshots in both themes and widths320/390/768/1024/1440, normal dismissal of onboarding, zero main-region axe violations. Screen samples are synthetic owned DB data, NOT production financial figures. Earlier DB/API/DOM today/7days/month comparison and keyboard-tab evidence is retained with its source boundary.

## Still pending, do not overclaim

- Secure candidate site build and complete integration re-run are running under `patched-final-gates-after-web`. Do not repeat already-passing unchanged suites. Earlier full integration failure is historical, not a current PASS.
- Final production-style/authenticated E2E and domain acceptance, official CI, final release review and operator authorization remain required. Earlier 26-pass/36-opt-in-skipped E2E belongs to an earlier source state and is not promoted to current acceptance.
- Main/release must not advance to publication while these gates or operator prerequisites are unresolved.

## Actual operator boundary

Current Unix permissions allow only diagnostic wetop-ops commands and exact no-argument wetop-migrate-approved. Do not seek a sudo/Docker bypass.

- `/usr/local/libexec/wetop-pre-migration-backup` is absent. Root must provide a trusted, root-owned executable that really backs up AND verifies restore before the protected migration command.
- The protected command is fixed to `npm run migrate:deploy --workspace=@pms/database`, i.e. canonical Prisma migrations. The six opt-in SQL components are still in migrations-hold; do not pretend that this command applies them. Root/operator must approve an explicit atomic held-package execution path after verified backup and exact source/image approval.
- Migration image must be immutable, carry `org.opencontainers.image.revision` matching the actual approved commit, and pass the nonce/audit/postvalidation protocol. A partial nine-file live hash match is not full image provenance.
- Actual runtime activation must use `APP_UNIFIED_OWNER_HOME=true` (not 1). Backend capture/link flags must follow their documented exact values and approved schema state, never an invented historical backfill.
- Populated rollback is restore-based. Do not force destructive down scripts through retained-data refusals.

This is an administrative execution prerequisite, not a request for the user to authorize the same publication again. Until it is satisfied, report the site as unchanged.
