# Final U07 verification, 2026-10-07

Code SHA: e070da7e1bbddf0eef7203977fae2b3963d4e1b0.
Base SHA: 7c101e5e37cb8e908760e2c5d2fd69d2cb42301a.
Branch pushed: codex/onboarding-u07-current-20261007.
Diff: https://github.com/GAIVER007/wetop.ai/compare/7c101e5e37cb8e908760e2c5d2fd69d2cb42301a...e070da7e1bbddf0eef7203977fae2b3963d4e1b0
CI: https://github.com/GAIVER007/wetop.ai/actions/runs/37613211275

## Result

U07 adaptation implemented and verified. NOT release-ready: full CI FAIL. No merge, main, release, production, schema or external production service changed.

RED: baseline signed-in returned anonymous on 503/504/403 (three unit failures); full guarded API 503 did not provide recovery (one browser failure). Test login adapter corrections were not counted as application RED.
GREEN: 29 focused unit tests; final local full API PostgreSQL 17.6 browser suite 24/24; lint and all three typechecks. U01-U12 expected/actual details: README.md. Timeout, offline, 503, lost response, repeat, 409, expired/revoked session, forbidden write and read-only are explicitly covered. Food mobile 390x844 completion preserves FOOD_SERVICE and /today; Hospitality and Beauty retain current landing. No assertion weakening, skips or deleted gates.

| CI job | Result |
| --- | --- |
| Lint, types, unit, public site | PASS |
| Bot pytest | PASS |
| Clean PostgreSQL migration/rollback, integration, browser wizard, full guarded API, general e2e | PASS |
| UI part 1/3 | FAIL, three existing scenarios |
| UI part 2/3 | PASS |
| UI part 3/3 | FAIL, one existing scenario |
| Required aggregate UI | FAIL |

Full guarded wizard in CI: 24 passed. General e2e: 26 passed. Local acceptance not confused with production acceptance: domain deployment remains NOT CHECKED / NOT AUTHORIZED.

## Exact inherited failures

Base CI https://github.com/GAIVER007/wetop.ai/actions/runs/37610534060 independently failed the same four scenarios. Their test files and relevant application modules have zero diff against the base in this U07 commit. Evidence: evidence/base-ci-failures.log, evidence/ci-full.log; separate local diagnostics in evidence/inherited-ui-reproduction.log.

1. `tests/ui/booking-widget-turnstile.spec.ts:244`: new token after rejected verification, same booking key. CI times out clicking disabled submit at line 260. Test checks disabled immediately on submit, then calls the fake new-token callback before awaiting the 403 response/reset. The actual catch subsequently clears that token and disables submit. Local first diagnostic PASS; repeats reproduce instability. Minimal proposed separate test repair: await observed 403 and reset counter, then supply new token, assert enabled and verify both tokens plus unchanged idempotency key. Do not remove token/key assertions or change security behavior. Current U07 plan explicitly excludes Turnstile changes.
2. `tests/ui/branches.spec.ts:82`: expects Current branch before selecting any branch (line 116). Scope-hardening correctly leaves wetop_scope unset when two branches exist. Current marker is conditional on currentId; no automatic selection is allowed. Minimal separate repair: assert initial unselected state, explicitly choose a branch, then assert current marker, scope cookie, retained route and reload. Do not restore implicit first-branch selection.
3. `tests/ui/chessboard-compact-screen.spec.ts:7`: board height 375.203125 versus required >400 (line 13), both baseline and candidate, same local reproduction. Layout regression belongs calendar task. Preserve >400 and no-document-scroll checks; propose correcting layout space allocation after measuring header/toolbars. Do not lower threshold.
4. `tests/ui/roles.spec.ts:118`: expects no Actions column anywhere in main (line 142), finds one. Refund/void button absence for STAFF already passes. Finance card contains a separate charge table with an accessible Actions heading, unrelated to payment refund permission. Minimal separate repair: scope header assertion to the payments table, retain forbidden refund/void assertions and MANAGER positive behavior plus server 403 coverage. Failure does not establish that STAFF can refund. MANAGER part of this failing scenario is NOT REACHED.

These repairs were proposed, not implemented: the confirmed plan restricts this branch to U07. A new plan must cover separate scenarios before changing code (AGENTS.md section 1). Passing U07 does not make the aggregate CI green.

## Cleanup

cleanup.json records actual stop/deletion of synthetic PostgreSQL 17 stand, ports 55933/55823/55824/55825 closed and both exact temporary paths removed. No production data or secrets copied. External dispatch disabled during full API tests. Local synthetic UI fixture processes are also stopped after diagnostics; final repeat cleanup recorded below. Reports are safe local evidence; code candidate remains the CI-tested SHA.

Turnstile unchanged-test repeated diagnostic: 4 PASS, 6 FAIL in ten repetitions. Evidence: evidence/turnstile-repeats.log.
CI unit: 3787 PASS, 7 existing SKIP; integration: 832 PASS, 12 existing SKIP; bot: 1732 PASS. No new skips added by this change. UI totals: 983 PASS, 4 FAIL.

Final diagnostic cleanup verified: PostgreSQL/full API and synthetic UI ports 55933, 55823, 55824, 55825, 3100, 4311, 3002 all closed. Evidence: diagnostic-cleanup.json. Stand data/binary paths remain absent.
