# MV7 final acceptance and merge gate, 05.10.2026

Owner explicitly authorized merge of PR #247 after this gate. Production/release and MV8 remain closed.

## Fresh preflight and upstream impact

Original PR head: `715009e11a3b5333798e81ab10fcfa3339cb7dd2`.
Fresh main synchronized: `fe6cfc384d4165820230d2518f1c434501864629`.
Tested implementation head: `e9555e78ae8e28900eab5f9aea69e515f47137d8`.

PR was OPEN and MERGEABLE with no reviews, comments or review threads. Main changed release workflow and Hospitality chessboard focus restoration. Both were retained by merge, and the new focus suite is included below. No Food API/domain/schema/migration diff exists against main.

The previous worktree Git fetch failed with unresolved deltas. Acceptance uses an independent clone at `/Users/urijzapojnov/wetop-mv7-gate-20261005`, own PostgreSQL 16 on localhost:55773 with a separate PGDATA and UTF8 encoding. No shared Supabase, foreign processes or worktree were modified. Node 24.15.0 matches .nvmrc major 24. Initial tree was clean; locks were empty.

## Evidence on final implementation

| Gate | Result | Evidence |
|---|---|---|
| Focused navigation/facade/pagination/midnight/scope | 18/18 | [log](../../tests/runs/logs/2026-10-05T14-33-50Z-unit-6c44.log) |
| Food real API acceptance | 13/13 | [log](../../tests/runs/logs/2026-10-05T14-34-10Z-e2e-67d7.log) |
| Beauty real API regression | 10/10 | [log](../../tests/runs/logs/2026-10-05T14-35-39Z-e2e-03a6.log) |
| Hospitality navigation/switching/Today/chessboard/owner/focus | 40/40 | [log](../../tests/runs/logs/2026-10-05T14-36-35Z-e2e-50f7.log) |
| Full unit, default timeouts | 3390 PASS, 4 existing skips | [log](../../tests/runs/logs/2026-10-05T14-38-11Z-unit-25eb.log) |
| Full integration | 741 PASS, 9 existing skips | [log](../../tests/runs/logs/2026-10-05T14-40-52Z-integration-76d5.log) |
| Root/API/web typecheck | PASS | [log](../../tests/runs/logs/2026-10-05T14-41-52Z-typecheck-ccad.log) |
| Lint | PASS | [log](../../tests/runs/logs/2026-10-05T14-41-52Z-lint-3747.log) |
| Migration chain, schema drift, all down rehearsals | 65 PASS, no drift, all downs PASS | [log](final-gate-migrations.txt) |

Every recorded acceptance suite reports codeChangedDuringRun=false. Unit/integration/typecheck/lint fingerprints match the current implementation. No new skips, weakened assertions, config changes or timeout increases were introduced. Subsequent changes are evidence only.

Food acceptance re-proves Area/Table/Period setup, DESK create/new Customer, persisted reload, assignment/statuses/completion, WALK_IN/SEATED/completion/free table, overlap/capacity/stale/archive/READ_ONLY/STAFF negatives, wrong scopes, two Businesses/two Locations, cross-vertical redirects with no foreign API calls, stable idempotency key on errors, previous-day midnight occupancy, >100 pagination, LoadError, axe and keyboard/focus/overflow. Existing 20 real API screenshots remain unchanged because Food visuals did not change during sync; the browser acceptance captured and checked all widths/themes again.

## Review and gate

Reviewed server-resolved vertical guards before foreign data fetches, scope-key verification on server actions, stable draft idempotency, expectedStatus/expectedUpdatedAt on mutations, complete bounded pagination, half-open occupancy and previous-day merge, READ_ONLY and property UI restrictions. Backend remains authoritative. No new dependencies or financial logic. git diff --check must pass and working tree must be clean before merge.

After full GREEN, push evidence to the existing PR branch, recheck fresh main and PR head/reviews, then merge #247 with the exact head SHA. Verify MERGED state and fresh main merge SHA. STOP without deploy or MV8.
