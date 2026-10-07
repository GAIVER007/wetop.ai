# MV8 audit after PR #259

Base: c7e63d76a2687fdec387d89b1c718c3387a009e3, merged PR #259.
Branch: codex/mv8-audit-20261007.
Checkout: /Users/urijzapojnov/wetop-mv8-audit-20261007.
Own PostgreSQL 16 UTF8: /Users/urijzapojnov/wetop-mv8-audit-runtime-20261007/pgdata, localhost 55983, pmslocal/pms_test.
Browser/API: localhost 55863/55864, verified free before start. No shared database or foreign process operations.

## Remaining work and plan

Continue the previously approved MV8 DoD against the implementation now merged in main. Preserve its recorded owner decisions and formulas; do not restore the superseded parallel implementation.

1. Audit unresolved scope and pending branch selection using existing real API harness, synthetic identities and own DB.
2. Reproduce confirmed gaps with recorded RED tests before minimal frontend fixes. Keep shared scope resolver, no backend/schema/migration/financial changes.
3. Run focused tests, complete real branch/Today matrix, 12 screenshots with axe and keyboard checks, Hospitality regression, full unit/integration, typecheck/lint and migrations/drift/all downs.
4. Review fresh main impact, commit/push, open a focused follow-up PR and stop. No merge, production/release or MV9.

This carries forward original approved requirements: verified server scope before domain calls and no stale previous-business data during switching. New feature architecture or business formulas are outside this audit.

Runtime note: disposable local PG uses fsync=off, synchronous_commit=off and full_page_writes=off to avoid repeated flush cost while recreating migration-check databases. Tests verify schema, transactions and browser reload, not crash durability. No production configuration changed.

## Confirmed fixes

- Unresolved authenticated shell suppresses Hotel settings/timezone/freshness and preserves identity for the existing branch selector. Production anonymous requests also suppress domain reads even when the login lock is explicitly disabled. The approved non-production open-stand exception stays.
- Branch options use only real /auth/me plus /branches, with currentId=null until the server-selected Location matches. Opening the selector no longer guesses a Hotel through /hotel/settings.
- Branch selection hides previous page data and property metadata immediately, closes overlays and cancels old Hospitality freshness polling. The keyed Today boundary keeps old streamed content hidden independently of layout arrival order. Selection failure restores the previous view; selection success gets a new Business/Location key.

Hotel Today body, Beauty/Food metrics/loaders and owner-approved formulas are unchanged. No backend/packages/schema/migrations or permission-engine change.

## RED evidence

- `2026-10-07T07-26-23Z-e2e-2ff1.log`: previous Beauty records visible while the real action was held; unselected shell sent Hotel settings and system freshness reads.
- `2026-10-07T07-35-51Z-e2e-227e.log`: old Hotel freshness polling continued after a pending branch switch (browser clock advanced one poll interval, actual HTTP delivery awaited).
- `2026-10-07T07-42-42Z-e2e-39f3.log`: opening the existing branch selector while scope was unresolved still invoked /hotel/settings.

The earlier polling attempt `...07-34-29Z...` passed before its HTTP call reached the API journal, so it is not RED evidence. The test now waits for delivery before asserting absence. Recorded failed/interrupted attempts remain, without new skips or timeout increases.

## Harness notes

Domain responses are real Next transport -> Nest guards/controllers/services -> own PostgreSQL. Only identity and fictional rows are fixtures. The browser clock advances client polling in the dedicated test, not server domain time.

The branches regression now completes the separate introductory Hotel tour with its real Skip button before switching. Tour behavior still has its own unchanged test. Assertions and timeouts are retained. Two branch timing assertions failed during the concurrent migration recreation run; rerun results must be recorded before claiming GREEN.

Generic Hotel finance/channel modules are absent from this browser harness, as documented by merged MV8: Hotel screenshots can show unavailable diagnostic/finance subfields. The real Hotel domain widgets and separate owner UI regression are distinguished from that limitation.

## Migration verification

67 migrations applied to an empty local database, schema.prisma drift check clean, each of 67 down.sql files restored the prior schema, RESULT: OK. Log: [migrations.log](migrations.log). This is validation of the current main chain, not a migration authored by this PR.

Fresh main check found 33f3014a87d19334277df2ce74d2a7605b1c7dc4 (PR #261). Relative to c7e63d76a it adds only the MV8.5 audit/plan Markdown files; no apps/packages/scripts change. They will be preserved by synchronization. MV8.5 implementation is outside this audit.

## Verification triage

First full unit run (`...07-46-43Z-unit-b059.log`) executed all 3516 cases: 3509 passed, 3 failed, 4 existing conditional skips. Two shell errors were Bash UTF-8 locale identifier parsing (no script change in this PR); the third was the unchanged 25 ms asynchronous scrypt timing guard. Correct locale C plus isolated rerun of all three files passed 88/88 (`...09-23-05Z-unit-86d3.log`). No assertions or timeouts changed.

Typecheck root/API/Web passed (`2026-10-07T09-23-31Z-typecheck-0b29.log`).

The earlier 28/28 real matrix is `2026-10-07T08-02-50Z-e2e-40ee.log`. A later 69-minute wall-time attempt hit three 90-second test/hook deadlines (`...08-07-40Z-e2e-1e9e.log`), while 25 cases passed. It is not claimed GREEN. Final checks use a process-scoped caffeinate wrapper to inhibit idle sleep, without changing power preferences. Full unchanged-threshold checks are being repeated.

Pending keyboard review caught duplicate main-content IDs in the new hidden/visible composition (`...08-06-18Z-e2e-7014.log`). The visible pending landmark now has its own ID; the skip link targets it while selection is pending. Its regression checks unique IDs and actual keyboard focus.

Local database preflight correction: its initial C collation/ctype did not case-fold Cyrillic, and default server timezone was Asia/Dubai. The first full integration run had 789 passed, 2 failed, 16 conditional skips (`2026-10-07T09-41-51Z-integration-4134.log`). Dump/restore of this disposable database into UTF8/en_US.UTF-8 plus database timezone UTC preserved all fixtures. Both previously failed cases passed in the next full run. No test or domain code changed.

The second full unit run on final source (`2026-10-07T09-26-40Z-unit-d605.log`) had 3508 passed, 4 existing conditional skips and four unchanged auto-deploy test deadlines exceeded. The isolated same-file rerun passed 16/16 with original 5-second thresholds (`2026-10-07T09-39-06Z-unit-db72.log`). Lint passed (`2026-10-07T09-37-12Z-lint-274f.log`). A single full unit GREEN is still pending.

## Final source verification

- Real API branch/Today matrix: **28/28 GREEN**, log `2026-10-07T09-47-26Z-e2e-1225.log`. Includes all 12 screenshots, axe zero violations, keyboard navigation and no sideways overflow. Images retained in this report's `screenshots/`; previous merged evidence is preserved. Representative Beauty desktop, Food mobile dark and Hotel desktop images visually inspected.
- Full integration: **791 passed, 16 conditional skips, zero failures**, log `2026-10-07T09-45-49Z-integration-ec02.log`. Seven conditional skips check public-schema metadata although the entire migrated local test schema is pms_test; nine require unrelated configured backup/production-restore/wizard environments. No skip was added by this PR.

- Hospitality owner regression: **15/15 GREEN**, log `2026-10-07T09-49-10Z-e2e-f558.log`. Own browser/API ports 55973/55974. Includes operational widgets, unavailable/slow API recovery, finance recovery and mobile/dark accessibility. Generated prior owner screenshots restored after verification.

- Beauty regression: **10/10 GREEN**, log `2026-10-07T09-51-17Z-e2e-d808.log`. Real appointment CRUD/status/persistence, overlap, scope and role isolation, calendar/mobile/dark/axe, archived entities and onboarding. Generated prior Beauty evidence restored.

Fresh-main recheck advanced to ddb5da41d21611eb1d827e873bfbb0269303f7d6 (PRs #260/#262/#265 plus #261). Changes include upstream Finance and Sites code, but none of this PR's touched web source and no migrations. The previous docs-only note describes the earlier snapshot, not the final sync. Preserve all upstream decisions and code; repeat common checks after merge without adding Finance/Sites implementation to this task.
