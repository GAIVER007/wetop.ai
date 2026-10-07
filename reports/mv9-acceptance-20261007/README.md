# MV9 acceptance, 2026-10-07

Owner requested continuation of MV9. Existing approved plan: plans/mv9-analytics-finance-2026-10-07.md. Existing PR: https://github.com/GAIVER007/wetop.ai/pull/269.

## Isolation and synchronization

Private checkout /Users/urijzapojnov/wetop-mv9-acceptance-20261007, starting PR head 41b9c8bdbef3477f2d4b179dff47550fe7f1e6ac. Fresh origin/main 867a3914ca065f1c452c8613adc8aa8a53c39032 synchronized in merge 15ff58749f. Only appended DECISIONS.md conflicted; both decisions retained. MV8 scope protections retained. No foreign checkout, process, shared Supabase or production touched.

Private PostgreSQL16: UTF8, en_US.UTF-8, database timezone UTC, PGDATA /Users/urijzapojnov/wetop-mv9-acceptance-runtime-20261007/pgdata, loopback port 56083. Branch browser/API ports 56063/56064. Node24.15, LC_ALL=C, original test thresholds.

## Confirmed test-harness repairs

Recorded RED 2026-10-07T12-53-23Z-e2e-6d31: 35 passed / 4 failed. Beauty exact reconciliation and organization overview failed because the shared Food fixture date in Pacific/Kiritimati did not match the salon's Asia/Almaty date. API and independent SQL consistently returned zero for the requested salon date; expected 1200000 minor units were outside it. Analytics now explicitly requests an isolated stable fixture: both test branches use the same timezone, appointment times are anchored inside their local date. Operational Today fixtures remain unchanged. Assertions and expected money are unchanged.

The switching test also attempted to dismiss a training modal disabled by its existing beforeEach. Removed the contradictory click; actual branch/cookie/screen assertions retained. A fourth failure involved an unresolved-scope redirect timeout and ENOSPC writing evidence, and requires repeat before acceptance. No timeout increase, skip or weakened assertion.

Focused metrics/load/params: 15/15 GREEN, log tests/runs/logs/2026-10-07T12-53-11Z-unit-8d88.log.

## Delivery boundary

Update PR #269 after completed acceptance checks, then STOP. No merge, production/release or MV10.

Second matrix: 37/39 passed, log 2026-10-07T12-58-52Z-e2e-9d3b. All 11 MV9 scenarios and previous unresolved-scope test passed. One Today fixture populated the wrong restaurant: saved reset response listed Center 68464094-43cb-4b0f-8616-a64278316533 first, while seed response selected Park a62792b6-bb7a-4dff-9296-472c662d556b. Their createdAt timestamps can tie. Seed now identifies Center by its explicit synthetic name and vertical, and salon by its vertical, rather than creation-order positions. No product query or API changed. One screenshot scenario failed writing Playwright traces with ENOSPC; Next disk cache reported the same error. Removed only this checkout's generated .next cache before a full repeat.

Third matrix: 38/39 passed, 2026-10-07T13-03-36Z-e2e-11f1. All assertions passed except a test whose browser context close and trace writes failed with ENOSPC. Added explicit opt-in APP_UI_TEST_NO_DISK_CACHE=1 to disable Next's dev filesystem cache for isolated acceptance. Default configuration remains enabled. No timeout, browser trace or assertion changed; recorded RED is the repeatable ENOSPC failure. Cache removed only after own runner stopped.

## Current acceptance

Real API/SQL/browser matrix: **39/39 GREEN**, log 2026-10-07T13-08-32Z-e2e-866e. Includes 11 MV9 scenarios, branch scope/security checks, all MV8 Today scenarios, eight MV9 screenshots and twelve Today screenshots with axe/keyboard/overflow assertions. Current MV9 screenshots saved in this report's screenshots/; historical screenshot directories restored. Browser uses real local Food/Beauty controllers and Prisma reads, synthetic identity and invented guests. No shared/production calls.

Fresh-main follow-up: c22aeae9a0a06e76a666fce67d34cc79c5f88afd (PR #280) adds two unrelated UI regression assertions and documentation/evidence. No apps/packages/schema change. Current Today screenshots preserved under screenshots/today/ (12 files); all historical report screenshots restored.

Full unit first pass: 3800 passed / 1 failed / 4 existing conditional skips, 2026-10-07T13-11-02Z-unit-56d0. Failure: deploy-server environment allowlist correctly rejected the new cache-only flag. Replaced it with the existing synthetic-data opt-in APP_ALLOW_TEST_DATA=1, which is already passed by all browser fixtures. Removed the new flag from final source. Focused unchanged deploy gate: 40/40 GREEN, 2026-10-07T13-17-48Z-unit-a190. A full repeat remains required. Browser cache setting evaluates identically for the successful matrix (existing APP_ALLOW_TEST_DATA=1), no browser assertion changed.

Integration uses fresh mv9integration database on the same isolated server, UTC, fully migrated public schema and a seeded pms_test schema. Browser-created archived branches are not copied. PostgreSQL client tools are available so local backup/restore integration scenarios execute.

Full integration: **864 passed / 5 existing conditional skips / zero failures**, 105 passed files and 4 skipped files, log 2026-10-07T13-17-59Z-integration-6298. The five Wizard tests require their hard-coded default localhost:55432 environment; this acceptance owns :56083 and does not touch that port. No skip added. Original test timeouts, no testTimeout override.

Documentation synchronization repaired duplicate question identifiers: upstream Finance already owns Q-277/Q-278, so the unchanged MV9 no-show/repeat questions are now Q-280/Q-281. Their OPEN status and product restrictions are unchanged.

Second full unit attempted two thread workers at original thresholds. Several pre-existing shell harness tests exceeded their deadlines under host load; interrupted only this acceptance's verified Vitest PID33907 with SIGINT. Exit130 is recorded in 2026-10-07T13-23-26Z-unit-66bb, not counted GREEN. Repeating one worker, the same mode as the first full run where all tests except the corrected environment gate passed. No foreign process interrupted.

Third full unit (one worker): 3800 passed / 1 failed / 4 conditional skips, log 2026-10-07T13-28-05Z-unit-067f. Exact failure: unchanged auto-deploy rollback test at tests/unit/auto-deploy.test.ts:271 timed out at original5000ms. Focused single-test repeat also timed out, 2026-10-07T13-37-15Z-unit-a267. Focused filtering skips15 other tests by selection, not new code-level skips. No production deployment is performed by these tests: their git repositories and commands are synthetic local fixtures. This full run is not GREEN.

Root/API/Web typecheck: **GREEN**, 2026-10-07T13-37-52Z-typecheck-78ba. Lint: **GREEN**, 2026-10-07T13-37-52Z-lint-3f40. No suppression, assertion change or dependency upgrade.

For the later destructive migration-chain acceptance only, this disposable private PG cluster switches fsync/synchronous_commit/full_page_writes off to avoid repeated flush costs. Full integration above ran with the original durability settings. This local optimization proves schema apply/drift/rollback and does not claim crash durability or change production configuration.

Hospitality analytics/navigation/branches: **41/41 GREEN**, 2026-10-07T13-40-04Z-e2e-f79f. This regression uses real Next/server actions with a synthetic loopback Hotel API, not Hotel DB reconciliation. Beauty operations: **10/10 GREEN**, 2026-10-07T13-51-11Z-e2e-abdf. Food operations/isolation/foreign-route protection: **13/13 GREEN**, 2026-10-07T13-53-48Z-e2e-83b5. Food listeners verified by lsof: both belonged to this acceptance checkout (NextPID30860/API30002); no foreign process used or interrupted. Historical screenshot directories restored; new regression images preserved in this report.

Git repair: the former completed MV8 clone's object directory became unavailable during acceptance. Removed only this checkout's alternate pointer, refetched remote reachable objects, regenerated indexed tree objects and matching file blobs. Reconstructed HEAD tree exactly d9979d2d722fce551b7d28272df1e196ae5bfeab. Two missing indexed versions (QUESTIONS.md and branches.spec.ts) recovered only after exact SHA assertions. git fsck --connectivity-only --no-reflogs --no-dangling GREEN. No working source changed by recovery, no reset of foreign checkout.

Shell harness determinism: retry health WAIT2/STEP1 used real sleep inside an otherwise synthetic Docker/HTTP stand. Added BASH_ENV fixture clock: unset Bash's special SECONDS, use a normal counter, advance it by sleep's requested interval. Production auto-deploy.sh unchanged. All rollback/image/refusal assertions retained; added exact two sleep1 steps and three health probes (two failed, one after rollback). New assertions recorded RED 2026-10-07T14-05-13Z-unit-a5d5 (clock missing), then full affected file **16/16 GREEN**, 2026-10-07T14-05-59Z-unit-d5e3, original5000ms threshold. Unrelated formatting churn removed before final full repeat.

Migration acceptance: **69 apply / schema.prisma drift / each69 down.sql GREEN**, RESULT: OK, migrations.log. No schema or migration authored by MV9. Includes latest upstream MKT6 migrations62/63.

Synchronized main c22aeae9a0a06e76a666fce67d34cc79c5f88afd into acceptance merge817287df48a72aaf58ba4c8bba42b337b0eb6b27 after source/harness evidence commit6343df9c. No source conflict. Final full unit runs from this clean checkout with original thresholds and one thread worker. Production/release not touched.
