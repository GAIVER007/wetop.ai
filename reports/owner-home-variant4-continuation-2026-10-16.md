# WETOP: approved variant4 continuation, 2026-10-16

Production has NOT been changed. Continue this branch; do not restart or duplicate running gates.

## Source continuity
- Worktree: `/opt/data/workspace/wetop-unified-owner-data`, branch `feat/unified-owner-data-20261016`.
- Preserved original work and approved UI in checkpoint `4cf28b7ee`, feature branch pushed and ls-remote verified. This was NOT release approval.
- Merged upstream `961423ee7` into working/index state, resolved all eight conflicts preserving upstream supplier keys/replay and our gated payment intents. Merge remains uncommitted pending checks. No reset/stash or main/release push.
- Sole writers ran sequentially, never concurrently. No active writer is needed while current test/static jobs run.

## Implemented and exercised
- Restored composition: four KPI, visible chart with real metric tabs, attention right, expense categories below. Removed extra pseudo-task/developer API paragraph. Missing data remains unknown, not fabricated zero.
- Actual browser exposed undefined `--space-3`/`--space-5`, collapsing card padding. Regression RED `15-10-55Z-unit-f2b7`; fixed to existing tokens, responsive scale 600/960/1280, neutral surface. GREEN `15-11-26Z-unit-46a7`,20tests.
- Reviewed chart: compact BigInt-safe axis labels, exact values retained in title/table, explicit partial previous series. RED `15-02-12Z-unit-ba4a`, GREEN combined money/UI33tests `15-03-04Z-unit-8a3f`.
- Existing beauty appointment payment ledger connected to gross receipts; canonical paid expenses and settlement guard exclude appointment/order customer refunds. Revenue policy unchanged. Writer RED/GREEN14tests `14-57-59Z-unit-9737`.
- New-main fixture contracts reconciled: required supplier keys, OFF cross-connection replay still no extra debit, missing key/changed payload rejection retained; marketing campaignId:null.
- Actual latest129 baseline + revised held package on owned55516: expense integration12/12, journal `2026-10-16T15-22-22Z-integration-1b43`, unchanged code during run must be checked in journal before release claims.
- Bounded hospitality SQL→API→DOM3periods, anonymous401/foreign403, main landmark and keyboard tabs passed on private preview. Does NOT cover all verticals or release E2E.

## Visual evidence and limits
Private preview `/opt/data/workspace/wetop-variant4-build-20261016`, actual synthetic API3101/Next3251, not production.
Latest light desktop screenshot sent in chat: `screenshots-final/owner-v4-light-1440.png`. Correct padding16/24px, no horizontal overflow. Light five widths passed after concise copy.
Initial screenshot/a11y batch was compromised by normal onboarding modal. Do NOT treat scans behind that modal as completed accessibility acceptance. New dark collector dismisses onboarding through its real Skip button, requires no open dialog, writes `screenshots-final/dark-acceptance.json`. Check actual result.

## Running jobs at checkpoint (inspect before launching anything)
- Full unit after actual main/UI changes: `proc_8f2742b127ab`. One pool-query-deadline test already failed under load; final result pending. Do NOT call full unit green or modify source while it runs.
- Actual main payment/refund/supplier/tenant integration four files: `proc_77d27bcc3efb`, owned55516.
- Dark five-width acceptance: `proc_7c1277bb0bf7`.
- Resource-serialized final static/default-build queue: `proc_77c76e99ed02`, script `/opt/data/workspace/wetop-owner-integration-20261016/final-gates.py`. Waits for the above OWN jobs, verifies frozen source manifest, stops only obsolete own preview API/Web, then root/API/web types, lint, DEFAULT build. Network sockets denied, one CPU, own process-group RSS watchdog3072MiB, core dumps disabled. Status/logs: `final-gates/status.json`. No application source writes. This queue is NOT release authorization.
- Initial root types at1536MiB hit heap limit; API/Web stages completed without diagnostics. Standalone root2304MiB exposed only old fixture contracts above, now fixed. Need actual new queue result; never report earlier aggregate as green.
- An interrupted old default preview build has NO result; webpack fallback failed on existing node:crypto barrel. Neither is final build acceptance.

## Owned databases / artifacts
PG16 binary `/srv/hermes/opt/postgresql-16/root/usr/lib/postgresql/16/bin/postgres` (NOT /usr/lib server path).
-55617, data `wetop-build-rootcause-20261016/integration-stand/pgdata`, synthetic prior E2E DB, existing auth storage.
-55618, data `wetop-build-rootcause-20261016/migration-stand/pgdata`, isolated rehearsal DBs.
-55516, data `wetop-owner-integration-20261016/pgdata`, newly initialized solely for hardcoded standalone tests, DBwetop_owner_home/schema pms_test, baseline129 + all held scripts, synthetic seed only.
All bind127.0.0.1. Do not delete locks or touch production. Earlier gateway/session interruption stopped all old test servers; only owned stands were restored, no gateway restart.
Latest baseline129 empty held down: `/opt/data/workspace/wetop-main125-rehearsal-20261016/baseline129-empty-down.json`:18empty forced-RLS tables,5downs,0remaining held tables. This used held checkpoint BEFORE revised refund guard; bounded proof, not populated/runtime/full migration acceptance.

## Still required before production
Full final-source green gates including integration/E2E and feature-ON filled/error/empty/partial states; all vertical numeric reconciliation; remaining populated/runtime-role/RLS/race/restore migration matrix; immutable candidate/image approval and trusted production backup/restore helper. Existing reports discuss additional workload coverage/attention gaps; do not invent history, tasks or demo numbers.
At last production inspection: permitted sudo only status/health/package-check and exact approved migration helper. Trusted `/usr/local/libexec/wetop-pre-migration-backup` absent, production image lacked revision label. Recheck read-only at cutover. No bypass, direct release movement or guessed root privileges.
