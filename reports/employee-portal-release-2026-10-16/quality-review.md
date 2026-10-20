# Independent QUALITY rereview after Q1/Q2

## Verdict: APPROVED

Q1 and Q2 are resolved in the inspected frozen candidate. No remaining Critical or Important issue was identified in this focused rereview. This is source-quality approval, not a full-gate pass, deployment authorization or production publication claim.

## Scope and method

- Read-only repository: `/srv/hermes/workspace/wetop-portal-release-61af7b90`.
- Read repository instructions, previous `final-quality-review.md`, independent `final-spec-rereview.md` and implementer `quality-fixes-report.md`.
- Independently read the complete current lead script, Beauty helper, booking browser suite, portability unit suite and actual Playwright config; inspected the tracked diff and existing backend admission/replay control flow.
- Verified the three current file SHA-256 values against the implementer's frozen-source table. All three match exactly (table below).
- Independently read the five recorder JSON entry artifacts and checked counts, exit codes, skip/flaky counts and `codeChangedDuringRun`. These are existing execution records, not tests rerun by this reviewer.
- No source/test/DB/Git mutations, test executions, builds, environment/auth-state/secret reads or production operations were performed. Generic skill mutation-test instructions were intentionally not followed under the explicit read-only freeze. Only this external report was written. Parent final gates are separate and were not interrupted.

## Required finding closure

### Q1: Consumed CAPTCHA recovery - RESOLVED

`apps/sites/src/render/lead-script.ts:112-144` distinguishes received non-success HTTP responses from rejected fetches and unvalidated successful responses:

- On a received failed response, the Beauty branch clears the old token and calls `turnstile.reset(widget)` when available (`:126-130`). This covers both 409 and 403, including failed JSON parsing on an otherwise received response.
- Reset does not clear or regenerate `attempt`. The booking request key remains stable until a validated success (`:86-87,116-118`). Clearing consumed CAPTCHA is therefore not used to bypass unresolved request identity.
- A received 409 still calls `beauty.clear()` (`:131`), so stale availability cannot be submitted without a fresh selection. A 403 retains the chosen slot and permits recovery after obtaining a new token.
- Rejected fetches go to the existing error handler, without the new reset branch. Invalid successful booking responses throw before key clearing or success reporting. These ambiguous paths preserve retry identity and do not falsely report a booking.
- Existing validated success handling and generic CALLBACK/TABLE_RESERVATION finalization remain intact. The added reset is confined to the Beauty received-failure branch and introduces no new authorization, booking, financial or storage rule.

The real-browser regression source is meaningful, not a status-message-only assertion:

- `tests/employee-portal-ui/site-booking.spec.ts:51-77` tracks consumed tokens and rejects missing/reused tokens; widget reset issues a distinct token.
- `:204-233` expands to two cases. The 409 case consumes T, checks the cleared slot, refreshes availability, selects a genuinely different canonical slot and validates success. The 403 case retries the same slot after CAPTCHA failure. Both assert the exact new token T2 and unchanged request key in the second submitted body.
- Existing network-retry assertions remain (`:183-202`), including exact equality of both submitted bodies, CAPTCHA, honeypot and UUID. Empty-success retry coverage remains (`:235-248`), as do canonical slot/target checks and generic mode regressions. No weakened existing assertion was found.

The HTTP behavior in these DOM tests is explicitly intercepted fixture behavior, not a claim of real Cloudflare or production API verification. Existing backend replay-before-admission behavior remains unchanged.

### Q2: Stale portability assertion - RESOLVED

`tests/unit/employee-portal-portability.test.ts:39-54` now extracts the actual `testMatch` array and requires exactly `['portal.spec.mjs', 'site-booking.spec.ts']`, matching `tests/employee-portal-ui/playwright.config.ts:23`.

The correction retains the serial-worker assertion, forbids `fullyParallel: true`, checks both suites for skip/fixme/only narrowing, and rejects testIgnore, grepInvert and positive grep configuration. It does not exclude booking coverage to recover a green unit test.

The exact portal scenario count is updated to ten, not replaced with a weaker minimum or removed. Independent source counting confirms ten top-level portal tests, including the absence lifecycle case. The booking suite expands to twelve cases, giving the intended current combined matrix of 22, rather than an obsolete nine-portal or earlier combined count. This source inventory is not a claim that the parent's complete 22-case final run has finished.

## Execution evidence inspected

Existing artifacts under the repository's `tests/runs/entries/`:

| Run ID | Observed result |
| --- | --- |
| `2026-10-16T19-54-17Z-e2e-ce7b` | RED: exit 1, 2 failed of 2 |
| `2026-10-16T19-54-37Z-unit-790b` | RED: exit 1, 1 failed and 7 passed |
| `2026-10-16T19-55-11Z-e2e-4f74` | GREEN: exit 0, 12 passed of 12 |
| `2026-10-16T19-55-24Z-unit-2449` | Additional stale-count RED: exit 1, 1 failed and 7 passed |
| `2026-10-16T19-55-38Z-unit-5b51` | GREEN: exit 0, 8 passed of 8 |

All five entries record `codeChangedDuringRun: false`, zero skips and zero flaky outcomes. The failed intermediate unit run remains honestly recorded. The GREEN browser entry selects the external standalone config and one worker; the unit entry selects the portability test. This rereview verifies those recorded outcomes and the matching current source hashes, not an independent rerun or the entire final release matrix.

## Current frozen-source identifiers

| File | Independently computed SHA-256 |
| --- | --- |
| `apps/sites/src/render/lead-script.ts` | `e38b5d3bed1697b06a68121cc214f43dd6e7cfe4949a22024a94fa057ba4c8cf` |
| `tests/employee-portal-ui/site-booking.spec.ts` | `b9e7c5d0a6d2b1f6e88e9fcc5af9d91209d3dea676e2a453d5ac44af2f216974` |
| `tests/unit/employee-portal-portability.test.ts` | `cb0ff74fc56019fedd71ede31fb7c7251210091ee8a2f51c4327afcf11c060f4` |

## Remaining boundaries and non-blocking observation

- Critical issues: none identified. Important issues: none identified in this rereview. Q1 and Q2 are closed.
- Prior M1 remains non-blocking: logical media removal is not physical blob reclamation. No destructive cleanup or new retention/business rule is requested during this freeze.
- The earlier broad quality assessment and independent SPEC PASS remain separate reports. This focused rereview does not claim to have repeated the complete security/spec audit or all runtime acceptance checks.
- Parent owns final full unit, integration, 22-case portal/booking browser, types, lint and build gates on the frozen candidate. The supplied migration-chain/drift and real stock-restore results are parent context, not independently rerun here.
- The already published c309 calendar is preserved; this review neither changes nor republishes it.
- Production SQL ledger/preflight/backups/application, real Kazakhstan private S3 privacy/signed delivery/retention, and Cloudflare/domain publication remain owner-only external release blockers. Fixture success does not prove any of those production facts. No production-ready or published claim is made.

## Disposition

**APPROVED for the Q1/Q2 quality rereview.** No remaining Critical or Important source finding. Final execution gates and owner-only release prerequisites still apply.
