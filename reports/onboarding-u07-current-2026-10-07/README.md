# U07 adaptation to current main

Base: 7c101e5e37cb8e908760e2c5d2fd69d2cb42301a.
Branch: codex/onboarding-u07-current-20261007. No merge, release, production or schema changes authorized.

## Reproduction and fix

`evidence/signed-in-red.log`: existing session lookup incorrectly returned anonymous for 503, 504 and 403 (3 failing tests). Only confirmed 401 now returns anonymous.
`evidence/full-api-red-current-login.log`: real AppModule, session and scope guards; injected 503 before commit left no safe retry button. Earlier two RED logs document obsolete test login assumptions, not an application defect.

The form uses a same-origin bounded JSON route retaining session/scope headers and all backend guards. Network errors retain entered fields. Retry first reads persisted state; identical committed draft and transition are acknowledged without another write. 409 requires explicit load rather than overwriting. 401 requires sign-in; 403 preserves forbidden-write enforcement. Current vertical landing remains /today, not historical /calendar. Existing Turnstile code unchanged.

## Acceptance

Full real API plus synthetic local PostgreSQL 17.6; external dispatch disabled. Evidence: `evidence/full-api-green.log`, 23/23 PASS.

| Case | Expected | Actual | Status |
| --- | --- | --- | --- |
| U01 | Verified vertical, no progress created by read | Asserted via API snapshot | PASS |
| U02 | Save/reload restores version, step, draft | Exact snapshot assertions | PASS |
| U03 | Close/reopen and login preserve saved progress | Exact restored input | PASS |
| U04 | Lost response and repeat create one progress | One row, exact persisted draft | PASS |
| U05 | Back/Forward preserves explicit saved step | Exact step and field assertions | PASS |
| U06 | Invalid input never persists | Rejected snapshot, correction succeeds | PASS |
| U07 | API disconnect retains input and permits recovery | Save, retry, reload verified | PASS |
| U08 | Completion persists; replay rejected | /today, 409, unchanged snapshot, re-login | PASS |
| U09 | Reopening hotel wizard preserves inventory/rates | Exact before/after counts | PASS |
| U10 | Read-only forbids UI/API writes | Disabled fields, 403, unchanged snapshot | PASS |
| U11 | STAFF rejected, MANAGER allowed | 403 then saved and reloaded input | PASS |
| U12 | Organization and branch isolation | Separate drafts, foreign scope 403, injected location 400 | PASS |

Additional recovery cases: offline, real timeout, 503 before commit, lost response after commit, lost next response, 409, expired session, revoked session, STAFF, read-only, initial protected-page outage: all PASS. Exact assertions retained; no skips or weakened assertions.

Food mobile (390x844) completion, persisted FOOD_SERVICE, exact draft and current landing: PASS, `evidence/food-mobile-green.log`. Hospitality U09 and Beauty U08 also preserve current landing.
Focused unit tests: 29/29 PASS. Web typecheck and lint checked separately. Full CI must report the exact committed SHA; local results alone are not full CI.

## Limits

This verifies synthetic guarded application behavior, not production acceptance, live OTA, eQonaq or real payments. No production data or secrets copied. Cleanup and CI result are recorded separately after completion.
