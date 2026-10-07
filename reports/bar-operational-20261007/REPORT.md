# BAR financial acceptance candidate

Status: implementation and targeted acceptance complete; final synced-head regression and exact-SHA GitHub CI are still being verified. This report does not authorize merge, release, migration or production deployment.

## Scope and baseline

Work is isolated in `wetop-bar-acceptance-20261007-src`, branch `codex/bar-operational-acceptance-20261007`, with private PostgreSQL 16 on localhost port 55893. The foreign shared checkout and Supabase were not modified. Main `50f04c5ce104bc366d4854e5bf831b81ddfe665f` was merged into repair checkpoint `d51556355ae8f6298b1e1db8052ef8748b520864`, producing `c4178b3fd11f6dd029698d14a1ecc8d2ac8fdfb6`. Upstream changes concerned design, Food test synchronization and CI coverage; no BAR/Finance/schema migrations changed. Main has 69 migration directories through canonical 63; the candidate adds `20261007000064_bar_financial_replay`, making 70. Existing BAR 55-57 are preserved.

## Approved behavior

D1: payment, write-off, retail and Folio operations use a permanent Property/kind/key registry. The same normalized payload replays the original identity and current status; a changed payload returns 409. Effects and accepted key commit together. PostgreSQL advisory locks serialize retries. Four browser forms persist the key and frozen parameters before dispatch, retain them after unknown outcomes, reload and a new authenticated session, and require explicit confirmation to start another intent.

D2: Finance void locks receipt before cash, preserves the original supplier payment and audit, creates one immutable linked compensation and restores debt. Effective paid amounts include only COMPLETED cash. Repeated void is rejected; replaying the original payment returns VOIDED without another expense.

D3: reversing without restock records the original FIFO cost in a separate `nonRestockedLossMinor` indicator. The warehouse is not decremented again. `reversalRestocked` records the choice. Historical backfill validates original sale quantities/costs and complete return evidence, preserving source records and rejecting ambiguous partial restock.

D4/T11: actual SessionGuard, membership roles and AuthorInterceptor are used in acceptance. OWNER/MANAGER have refunds access; STAFF desk operations remain available but refund/settings controls and endpoints are denied; organization READ_ONLY denies all writes. BAR reversal of CLOSED Folios or any positive allocation from a COMPLETED payment returns 409 under the Folio lock, preserving balances and payment history. The earlier PR #279 REVERSED status fix is retained and covered by replay tests.

New financial rows enforce ownership and immutability for both app and BYPASSRLS service roles. UPDATE/DELETE guards survive generic grants restoration. Only a different table-owning administrative role can remove derived records during synthetic cleanup or separately approved rollback. Functions use SECURITY INVOKER and pinned current schema/public/pg_temp.

## Acceptance matrix and evidence

| Cases | Evidence | Result already established |
| --- | --- | --- |
| T01/T03/T06/T07, four operation kinds | `bar-replay-repair.test.ts`, real HTTP and PostgreSQL | one effect; same identity; conflict; intentional new key |
| T02, four kinds | AFTER INSERT failure injection in registry | complete rollback, no accepted key or partial ledger |
| T04/T09, four kinds | real API browser replay and SessionGuard | lost committed response, reload/relogin; frozen intent; one final effect |
| T05, four kinds | PostgreSQL advisory waiters, aborted client and restarted Nest API | controlled concurrency, one operation, persistent replay |
| T08, retail and Folio | persisted replay after reverse | same ID, REVERSED, no new ledger effects |
| T09 roles | `bar-real-auth.test.ts`, browser roles | real membership/session; STAFF/READ_ONLY denied writes; tenant isolation |
| T10 | linked void and no-restock tests | compensation once; restored debt; separate FIFO loss |
| T11 | `bar-reversal-policy.test.ts` | STAFF denied; closed/partially paid denied; allowed open/unpaid OWNER/MANAGER |
| T12 | browser catalog/draft/void and fixture snapshots | reload/readback; discarded unsaved cash form has no effect; original audit retained |
| Populated financial RLS | `bar-financial-rls.test.ts` | A only/B only/unset 0/empty 0/service A+B; ownership and immutability enforced |
| Historical migration | `bar-financial-backfill.test.ts` | source rows unchanged through down/up; exact keys/loss/compensation; partial restock rejects atomically |

RED before GREEN is retained in `tests/runs/logs` and the journal. The old repository reproduced replay/conflict/loss/void failures; browser failures exposed remounted Folio input keys; grants restoration reproduced DELETE access; backfill without classification reproduced missing loss. The final actual-session targeted run `2026-10-07T14-44-34Z-integration-99bc` passed all 30 repair/role/Folio tests. RLS/restore/search-path targeted run passed 13; historical backfill passed one.

Control reconciliation: purchases 280000, supplier payment 60000, remaining debt 220000; retail 12 units leaves FIFO stock cost 148000; Folio 3 leaves 100000; write-off 1 leaves 84000; inventory shortage 1 leaves 68000. Retail no-restock clone preserves 148000 warehouse cost and exposes 132000 separate loss, with cost/revenue/write-off zero after reversal. Supplier void retains payment/cash identity, sets cash VOIDED, increases debt by exactly the voided amount and leaves stock unchanged.

## Regression status

The prior complete integration run `2026-10-07T14-39-51Z-integration-726e` passed 915 tests with five existing Wizard environment skips. Latest targeted actual-session coverage then added two T08 cases; complete regression is being repeated on a fresh UTC database. Existing baseline skip declarations were not changed. No assertions were weakened or timeouts increased.

Strict root/API/web typecheck `2026-10-07T14-51-46Z-typecheck-8996` and lint `2026-10-07T14-51-46Z-lint-81b8` passed. Subsequent schema-default parity and preview-report contract changes require final verification.

First full 70-migration rehearsal applied all migrations and individually rolled back all 70; it correctly failed schema drift because Prisma described client UUID defaults for three SQL-generated UUID IDs. Matching dbgenerated declarations fix the drift; the repeated complete rehearsal is in progress.

The earlier full unit attempt had three host-resource timeouts (3791 passed, four baseline skips); isolated Channex passed, two existing auto-deploy shell tests still timed out. This is not a unit GREEN claim. The unchanged-limit final local run and full GitHub release-checks on the final pushed SHA are required. PR remains draft until all mandatory jobs, including bot/site and separate UI jobs, are GREEN.

## Evidence and boundaries

Synthetic PostgreSQL snapshots and real API browser screenshots are in this directory. Cleanup deletes task-owned operational fixtures and sessions; append-only audit and its required synthetic identity parents are retained. No real guest data or session credentials are included. Traces are disabled because they can contain authentication cookies. Public-site redirect acceptance uses a local site server.

See `MIGRATION-64.md` for backup, guarded backfill, validation and rollback. Old ENOSPC/stale generated-client notes describe earlier failed attempts only; disk was recovered and Prisma regenerated. No production, release, MV8 or unrelated financial feature was changed. Final exact SHA, complete job outcomes and readiness will be recorded in the PR manifest after CI, without changing the tested candidate SHA.

## Final fresh-main impact, 2026-10-07

The next fetch advanced origin/main to `b6db018699fa806060d3e74f8d257ec57a9ff8c2` (MV9). There are no BAR/Finance/schema/migration changes, and 64 remains free upstream. The shared API fetch helper gains an explicit read-only branch report scope; BAR calls must retain ordinary session/scope behavior and the new report field. Synthetic dev caching changes upstream and the existing auto-deploy tests now advance a fixture clock while preserving deadline/rollback assertions. Both sets of changes will be retained in the candidate sync and covered by final regression.

The complete fresh-database run passed 915 with two unchanged 5-second timeouts and five baseline Wizard skips (922 total). Browser whole-suite runs revealed the first-click readiness issue, which was fixed by an added hydrated-control assertion and passed standalone. The later whole suite passed seven but had a transient report-load API_503 in WRITE_OFF and a missed expiry alert in T09. These are retained as failed attempts, not counted as final GREEN. The final browser repetition is sequential with integration.

Additional acceptance: the frozen negative control `2026-10-07T15-19-38Z-integration-d835` failed all three expected cases. Removing the shared Finance receipt lock left zero/one observed waiters instead of one/two; omitting the no-restock loss produced zero instead of 132000 alongside a real 16000 write-off. The preceding attempt `15-16-13Z-integration-b77c` changed its source fingerprint and is explicitly not evidence. Final code was restored before the GREEN run.

The restored-code run `2026-10-07T15-21-14Z-integration-e5d4` passed all 37 BAR cases, including both deterministic pay/void orders and mixed FIFO loss. One of two unchanged MV8 contract tests timed out; the combined run is 38 PASS / 1 FAIL, not full GREEN. Source fingerprints remained unchanged.
