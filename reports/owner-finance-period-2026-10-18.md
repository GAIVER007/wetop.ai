# Owner finance period repair: verification

## Scope and source

Branch `fix/owner-report-period-20261018`, base `fb0e786e0b3f99f745284d860d84094b5a6cb5eb`. Existing worktree reused with owner-authorized handoff, exact published old HEAD retained; no new project tree. Dependency link objects preserved in private controller, not followed or deleted. Fresh dependencies installed from the unchanged existing lockfile with lifecycle scripts disabled; own Prisma client generated without database connections.

This fixes selected **date continuity**, not all common analytics or deployment acceptance. There are no schema, money formula, role, context-switch, appointment-status, CSS or design changes.

## User-visible behavior

- Every owner finance link carries the exact API `fromDate/toDate` for BEAUTY, FOOD_SERVICE and HOSPITALITY.
- `/finance` forwards dates to BEAUTY and preserves them on the FOOD_SERVICE redirect. Only `from/to` are forwarded; no unrelated query or tenant values.
- BEAUTY uses the requested inclusive window, preserving its existing seven-day no-query default and server location date. Requests have concurrency at most four and a 31-day bound matching the existing appointment CSV endpoint.
- BEAUTY rejects mismatched dates/location/currency/timezone across returned days and mismatched appointment currency. Failure is not a zero-money success.
- FOOD_SERVICE preserves its month-to-date default, handles repeated date values with the repository's first-value convention and rejects invalid/reversed windows. Its bound is 93 days, copied from the real `RestaurantService.cash`, not the hospitality bound.
- Explicit future windows are not silently replaced with another period. The API remains authoritative for source availability. No new booking/future-date business rule is introduced.
- Service price snapshots remain different from received payments. This repair does not turn salon appointment prices into a cash report or connect missing expense classifiers.

## Executed checks

All runs below used the existing `test:record` journal; logs/records are retained, including failures.

### RED, before application changes

- `2026-10-18T08-02-52Z-unit-3237`: 40 tests, 23 failed / 17 passed. Caught lost owner dates across all three verticals, dropped finance route parameters, fixed-week loading, invalid-window fallback, incorrect source combination and excessive day concurrency.
- `2026-10-18T08-03-57Z-unit-ad1a`: restaurant 5 tests, 3 failed / 2 passed. Caught duplicate query handling and silent invalid/reversed-window behavior.
- The first RED also contained an incorrect test expectation for date presentation (`23.02.2026` instead of existing `23 февр.`). That assertion was corrected before implementation and independently rerun in the RED above; it is not counted as a product defect.

### Refinement RED

- `2026-10-18T08-10-04Z-unit-5893`: restaurant 6 tests, 1 failed / 5 passed. Proved that the UI must apply the actual restaurant 93-day API limit rather than a copied hotel 366-day limit.

### Mutation check

- Temporarily inverted the range-order guard, using a preserved exact source-file backup.
- `2026-10-18T08-13-46Z-unit-955a`: 22 tests, 10 failed / 12 passed. The suite detects the broken condition.
- Restored source bytes exactly; SHA-256 `3ca6cbc856284062b548c02fc76e20be69d7e69d993c719e833d4447ad6b4d52` verified before the final GREEN.

### Final focused GREEN

- `2026-10-18T08-14-25Z-unit-f1f9`: **73/73**, 6 files. Includes finance continuity, existing owner summary, sales/beauty financial semantics, report routing and employee portal guards.
- `2026-10-18T08-11-14Z-typecheck-a31f`: **root + API + web types pass**. Earlier `47c4` failed because a new test fixture lacked `bounds`; corrected, not suppressed/cast away.
- `2026-10-18T08-19-35Z-lint-757f`: **final full ESLint PASS**, no path filters, after all fixture/limit changes.

### Final full unit regression

- `2026-10-18T08-15-01Z-unit-4136`: **5766 passed, 7 skipped, 0 failed**, 632 files (631 passed, one skipped), no name/path filter, `--maxWorkers=2` only. Real journal states `codeChangedDuringRun:false`, fingerprint `993dbd8ae37fa92ff65c86563ea2c00e3e5ab344b57013101e4e19e4e641f8a6`. Database/API env was limited to the stopped owned loopback endpoint; integration/e2e projects were not selected.

## SQL baseline relation and limitations

Separate prior real PostgreSQL baseline used source `0ae6325552876e82858286eee1009788cad72095`: 9 vertical/period cases and 12 authorization/RLS rejection checks. During this repair, the original hashes of all **164 pinned application modules loaded by that baseline** were compared to base `fb0e786e`: zero differences. This corroborates unchanged qualified service code, but does not re-label the old fixture SQL run as a new authenticated HTTP/live-data acceptance test.

The unit tests here intentionally stub external API responses. They exercise real page/loader code, not a real production database. Full unit regression, exact candidate CI, production build, merge/release and deployed authenticated browser verification are separate gates. The original live-capture RED remains a pre-deployment reproduction and has not been overwritten with synthetic GREEN output.

## Review

Self-review across correctness, scope/architecture, security, readability and performance, with a real killed mutation. A requested separate agent failed before doing any work due to its configured provider/model HTTP400; it made no source changes and is not counted as an independent review. Gbrain index was not built; local callers were inspected instead.

Known overall-task remainder: real data availability/configuration, missing workload inputs and expense links, contextual landing for cash/expense drilldowns, complete HTTP/auth/SSR/browser and live release acceptance. No claim these are fixed by adding dates.
