# WETOP continuation: integration, E2E and migration evidence

Source `/opt/data/workspace/wetop-unified-owner-data`. Continuation of existing branch, not a restart. Production unchanged; no commit/push/merge/helper/gateway restart. Application code unchanged in this continuation. Six inventory/category integration fixtures adjusted only.

## Integration root causes and RED/GREEN

- `13-35-16Z-integration-94b0`: business-agents passes7/7 at pool5; category-price reproduces403. Previous business-agents error was a beforeAll hook timeout, not module-load failure. Exact prior timeout causality not isolated; no timeout/source change made.
- `13-35-50Z-integration-3c0d`: other five category/inventory specs reproduce403.
- First root cause: fixtures supplied only user/org, while verifiedLocationProperty now requires real business/location and property permission. Derived OWNER LOCATION/HOSPITALITY actor from each fixture's actual Property/Location; no security guard removed.
- Intermediate `13-36-55Z-integration-aa8c`:10/13 passes. Remaining three fixtures create default TRIAL organizations without trialEndsAt; canWrite correctly denies. Marked only those three synthetic organizations ACTIVE.
- `13-38-09Z-integration-2e6e`:13/13 passes across7files.
- Aggregate `tests/runs/entries/2026-10-16T13-38-49Z-integration-7035.json`:164 selected files,1188passed/90skipped/0failed, exit0, codeChangedDuringRun=false. Eight environment-gated files account for90skips. Ten separate hardcoded55516 files are not in this selection. This is NOT the full release integration matrix.
- Bare ESLint on six changed specs exit0; root typecheck heap1536 exit0. An earlier heap768 attempt exhausted V8 heap, not TypeScript errors. API/web types, full unit and build not unnecessarily repeated because application code unchanged.

## Accepted build and authenticated E2E

1989 app/package source/config/SQL files matched accepted build snapshot. Reused build ID `GxdHLSg311QvTLocJBefM`; copied .next to source runtime location and verified2599file hashes, no rebuild.

Initial E2E `13-44-48Z-e2e-10ed` correctly remains failed/interrupted. Integration left synthetic properties; auth setup picked alphabetical BPM hotel while service helpers picked seed hotel. Stopped ONLY own Playwright runner with SIGINT, no unrelated jobs stopped. No test timeout inflated.

Created separate owned DB `wetop_e2e_continuation_20261016` on127.0.0.1:55617. `prisma migrate deploy` unavailable because installed CLI missing. Supported `npm run test:schema` applied117actual migrations and synthetic seed into fresh pms_test. No previous schema reset.

`tests/runs/entries/2026-10-16T13-49-00Z-e2e-c31a.json`:26passed/36opt-in-skipped/0failed,62total,exit0,codeChangedDuringRun=false. Auth/schema guard ON; API3101/Web3100 only. General E2E green does not cover feature-ON owner-home or skipped suites.

## Feature-ON live owner-home check

Actual accepted Next production artifact, authenticated real API, synthetic pms_test, `APP_UNIFIED_OWNER_HOME=true`; held writer flags OFF. External executable evidence script: `/opt/data/workspace/wetop-build-rootcause-20261016/integration-stand/owner-live-acceptance.cjs`.

- Today/week/month: independent SQL charge/payment sums equal API currencies and visible DOM amounts; daily rows sum to KPI. Fixture has zero canonical manual cash rows, checked explicitly, so no cash source silently omitted. Observed1350000minor KZT revenue and2050000minor KZT receipts. Synthetic values only.
- Anonymous owner-summary401; foreign business/location pointer403, all three periods.
- Eight screenshots at320/390/768/1440, light/dark, measured horizontal overflow0. Files `owner-live-{theme}-{width}.png` in integration-stand.
- **BLOCKED**: actual new owner-home renders no main landmark, count0. External check exits1, `owner-live-acceptance.json` status BLOCKED_MISSING_MAIN_LANDMARK. Do not substitute body-based numeric checks for accessibility success. Application fix not made in this continuation; next slice needs RED→GREEN and relevant rebuild/rechecks.
- Screenshot/UI observations: raw NO_MONEY_DATA reason is exposed; workload explicitly unavailable and expense classification disconnected with flags OFF. Header can be captured before async selected-property metadata settles; screenshots are not full keyboard/axe or settled-state acceptance. Existing visual screenshot is not a numeric production acceptance.
- Not covered: real beauty/restaurant owner reconciliation, populated paid-expense category/settlement flow, complete empty/error/partial/no-access matrices, keyboard/axe, multi-branch comparison.

## Fresh actual migration gate, isolated cluster55618

Artifacts `/opt/data/workspace/wetop-build-rootcause-20261016/migration-stand/`.

- New own PostgreSQL cluster on127.0.0.1:55618, distinct from integration/E2E/production. No shared role modifications.
- Applied117sorted baseline migration.sql files with original FK/triggers intact. Then actual `owner-home-release.sql`, six files including116/opening.sql, one transaction:exit0.
-18expected held tables present with FORCE RLS/policies; no unvalidated constraints or disabled source triggers in public. This metadata inventory does NOT prove runtime permissions.
- Actual custom pg_dump and pg_restore to two fresh DBs with ACL retained. First restore setup erroneously dropped public; PG16 dump requires existing public for extension, so restored schema and retried successfully. No production implications.
- Original empty held_gate:5standalone psql down processes,118→114, no outer transaction or stripped statements, all exit0. Normalized full schema dump EXACTLY equals pre-held baseline. Only pg_dump comments/random restrict lines/blank lines excluded. `baseline-after-down.diff` empty.
- Restored held DB populated via real seed-local (88units/2580rates/10stays), real capture_hospitality_workload called, no triggers/checks disabled. Actual second populated dump/restore: all142public tables have identical sorted full-row SHA256 fingerprints, not only counts. `populated-restore-row-hashes.json`.
- Standalone wrong-order down114–117 each specifically refuses ROLLBACK_NEWER_RELEASE_INSTALLED. Down118 specifically refuses retained hospitality_workload_versions. All142table row hashes unchanged after five refusals.
- Raw schema dump restore comparison is NOT byte-identical: PostgreSQL reserializes some baseline CHECK expressions/casts and public comment. Differences saved `restore-schema.diff`; no blanket semantic-equivalence claim.

## Remaining publication blockers

1. New owner-home missing main landmark, raw internal reason text and complete UI/accessibility/state acceptance.
2.10hardcoded55516 integration suites +90integration/36E2E opted-out tests not proven here.
3. Complete populated valid fixtures for all18held tables; source/held writer races and two-connection down contention; runtime-role same/cross-tenant write/RLS matrix. Conservative row/refusal checks do not replace these.
4. Broader business completeness items in existing unified-owner-release-blockers.md, including workload coverage and beauty payment ledger, remain open. Do not silently close them from this report.
5. Immutable release approval/backup runner/cutover acknowledgement remain separate owner/operations gates. No production deployment/migration authorized or executed here.

Status: substantial tested progress, publication remains blocked. Prior all-green build/unit evidence preserved; only corresponding application changes would justify repeating them.
