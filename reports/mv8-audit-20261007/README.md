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

The second full unit run on final source (`2026-10-07T09-26-40Z-unit-d605.log`) had 3508 passed, 4 existing conditional skips and four unchanged auto-deploy test deadlines exceeded. The isolated same-file rerun passed 16/16 with original 5-second thresholds (`2026-10-07T09-39-06Z-unit-db72.log`). Lint passed (`2026-10-07T09-37-12Z-lint-274f.log`). That attempt was not GREEN; the later single full merged-source run below is GREEN.

## Final source verification

- Real API branch/Today matrix: **28/28 GREEN**, log `2026-10-07T09-47-26Z-e2e-1225.log`. Includes all 12 screenshots, axe zero violations, keyboard navigation and no sideways overflow. Images retained in this report's `screenshots/`; previous merged evidence is preserved. Representative Beauty desktop, Food mobile dark and Hotel desktop images visually inspected.
- Full integration: **791 passed, 16 conditional skips, zero failures**, log `2026-10-07T09-45-49Z-integration-ec02.log`. Seven conditional skips check public-schema metadata although the entire migrated local test schema is pms_test; nine require unrelated configured backup/production-restore/wizard environments. No skip was added by this PR.

- Hospitality owner regression: **15/15 GREEN**, log `2026-10-07T09-49-10Z-e2e-f558.log`. Own browser/API ports 55973/55974. Includes operational widgets, unavailable/slow API recovery, finance recovery and mobile/dark accessibility. Generated prior owner screenshots restored after verification.

- Beauty regression: **10/10 GREEN**, log `2026-10-07T09-51-17Z-e2e-d808.log`. Real appointment CRUD/status/persistence, overlap, scope and role isolation, calendar/mobile/dark/axe, archived entities and onboarding. Generated prior Beauty evidence restored.

Fresh-main recheck advanced to ddb5da41d21611eb1d827e873bfbb0269303f7d6 (PRs #260/#262/#265 plus #261). Changes include upstream Finance and Sites code, but none of this PR's touched web source and no migrations. The previous docs-only note describes the earlier snapshot, not the final sync. Preserve all upstream decisions and code; repeat common checks after merge without adding Finance/Sites implementation to this task.

## Fresh-main synchronization

Merged origin/main ddb5da41d21611eb1d827e873bfbb0269303f7d6 into audit branch (merge 03dfec171). Only appended ADR text conflicted; both upstream and MV8 ADR retained. No source conflicts. Dependency install refreshed the newly added Sites workspace without altering lockfile. Relative PR diff has no apps/api, packages, scripts, schema or migration changes. No owner-approved Finance/Sites behavior changed by this audit.

Self-review: shared resolver validates authenticated context before shell reads; identity remains available for branch recovery. Pending state uses existing events, removes listeners on cleanup, disables old freshness interval and preserves new scope key remount. Existing current-branch choice merely closes the selector, so it cannot leave the new boundary pending on the same key. Existing failure event restores content. Both hidden and visible landmarks have unique IDs and the skip link targets visible main. Hospitality body/loaders and Beauty/Food calculations remain byte-identical to main. Added texts contain no U+2014, and no assertions, timeouts or skips weakened.

Local integration preflight expanded for the final merged-source run: PostgreSQL16 client binaries added to PATH so real backup/restore tests can execute on their disposable databases. Empty structural copy of the already migrated pms_test schema placed in this same private database's public schema, because seven legacy tests inspect public metadata while their actual writes use pms_test. No shared/production database touched. Wizard tests hard-code local port 55432; that foreign/default port remains untouched and its existing five skips are retained on own port 55983.

- Full unit on synchronized main: **3739 passed, 4 existing conditional skips, zero failures**, 400 files passed plus one conditionally skipped file. Log `2026-10-07T09-53-43Z-unit-8356.log`. Single-worker threads reduce OS process overhead; assertions, default timeouts and skip conditions unchanged. All prior timing failures passed within this one complete run.

- Full integration on synchronized main: **828 passed, 5 existing hard-coded Wizard-port skips, zero failures**, 102 files passed and four skipped. Log `2026-10-07T09-59-33Z-integration-86ef.log`. Real local backup/restore and public-metadata-dependent checks executed successfully.

Migration evidence remains applicable after sync: schema.prisma, all 67 migration/down files and check-migrations.sh are byte-identical between c7e63d76 and synchronized ddb5da41. No repeated recreation needed; original 67 apply/drift/down GREEN retained.

- Typecheck root/API/Web after sync: **GREEN**, `2026-10-07T10-01-11Z-typecheck-3f84.log`.
- Full lint after sync: **GREEN**, `2026-10-07T10-01-48Z-lint-36ca.log`.

- Final real API matrix after synchronization: **28/28 GREEN**, `2026-10-07T10-02-25Z-e2e-c58b.log`. All 12 screenshots updated from this merged-source run; axe zero violations, keyboard, pending skip-link, no overflow and no foreign calls passed. Previous main report images restored.

Food regression first attempt after sync: 12/13 passed (`2026-10-07T10-04-53Z-e2e-5ef7.log`). The stale-token test's ordinary click hit the original 15-second action deadline: document intercepted the pointer and the confirm button then detached. No changed timeout, forced click or weakened assertion. Entire unchanged Food set repeated; earlier failed log retained.

Final remote refresh still reports origin/main ddb5da41d21611eb1d827e873bfbb0269303f7d6.

- Full unchanged Food rerun: **13/13 GREEN**, `2026-10-07T10-09-04Z-e2e-dc4b.log`, including ordinary stale-token click, all registered foreign routes, real persisted walk-in/status/assignment/overlap and mobile/axe. No source or test changes between failed and successful runs. Prior Food evidence restored.

Final Hospitality rerun initially aborted with ENOSPC/Turbopack cache writes (`2026-10-07T10-13-29Z-e2e-8f48.log`, exit130, 4 failed/11 not run). Host disk had ~117MiB free. Only own Playwright runner interrupted and own regenerated apps/web/.next plus .next-ui removed. No foreign resources cleaned. This attempt is not GREEN; rerun follows.

- Final Hospitality owner regression after sync and own-cache cleanup: **15/15 GREEN**, `2026-10-07T10-14-20Z-e2e-e8c9.log`. Unchanged 45-second test/15-second assertions, full mobile/dark/keyboard/axe and failure recovery. Earlier ENOSPC attempt retained, not counted as GREEN.

## Acceptance

| Gate | Result |
| --- | --- |
| Focused Today/shell | 43/43; all repeated in full unit |
| Final real API matrix | 28/28 |
| Screenshots / accessibility | 12; axe zero violations; keyboard and overflow GREEN |
| Hospitality / Beauty / Food regression | 15/15, 10/10, 13/13 |
| Full unit | 3739 passed, 4 existing conditional skips |
| Full integration | 828 passed, 5 existing hard-coded Wizard-port skips |
| Root/API/Web typecheck, lint | GREEN |
| Migration apply / drift / all downs | 67, GREEN; chain unchanged after sync |
| Fresh-main sync | ddb5da41d21611eb1d827e873bfbb0269303f7d6 |
| Source stability | final recorded runs codeChangedDuringRun=false |

No outstanding MV8 API contract gap. Stop at review PR. Do not merge, release, deploy or begin MV9.
