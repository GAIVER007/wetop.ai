# MV8: Vertical Today

Original authorized base: 04e532b656fd96f1a526f01d3257e75caf595745.
Fresh main synchronized: ab5d2f2262a9421a80b44c70fc2a5a6b9afdb47e.
Branch: codex/mv8-vertical-today-20261005.
Own checkout: /Users/urijzapojnov/wetop-mv8-20261005.
Own PostgreSQL 16 UTF8: /tmp/wetop-mv8-20261005-pg, localhost 55783, pmslocal/pms_test.
Own Today browser/API: 55853/55854. Separate regression browser ports, runs sequential.

## Result

Shared /today dispatches from verified server Business/Location scope. Invalid, absent or failed scope blocks domain reads in both page and shell. Authenticated identity retains the existing branch selector for recovery. Signed-out identity has no domain reads.

Hospitality body from `const sp` to the end of the component is byte-identical to fresh main Today body. OwnerFinance, OwnerOperations, OwnerLoad, period resolution, Suspense, loading and retry semantics remain unchanged. Fresh main's total-places label is preserved.

Beauty and Food use independent pure metric builders and minimal read loaders. No backend/package/schema/migration or financial-model change in this PR. Food branch read contract was separately authorized, reviewed and merged as [PR #248](https://github.com/GAIVER007/wetop.ai/pull/248).

## Facts

Beauty: planned BOOKED+CONFIRMED; confirmed CONFIRMED; completed DONE; masters server columns.length. Attention BOOKED and NO_SHOW. Upcoming active rows group endMinutes > captured local minute first, then passed rows, startMinutes/id ascending, limit 5. Day is server-local; a midnight mismatch gets one bounded reread and otherwise LoadError. Required labels/status/date fields and timezone are validated.

Food: summary/attention uses local start date today, with planned BOOKED+CONFIRMED, completed COMPLETED and NO_SHOW. Current SEATED count/list includes the merged previous/current-day dataset and only intervals [startsAt, endsAt). Free tables are active tables in active areas minus distinct occupied active table IDs for BOOKED/CONFIRMED/SEATED intervals. Upcoming active today rows sort startsAt/id ascending, limit 5. Lists paginate to nextCursor=null; malformed/repeated cursors and required-source failures fail the composition.

No Beauty/Food customer, employee, service-period or service catalogue API reads are added. No revenue is inferred. Quick links use the existing permissions engine. No new mutation forms.

## Scope and entry points

Root, logo, completed onboarding and completed branch selection land at /today for all verticals. Unfinished Hospitality keeps /onboarding. Foreign direct routes redirect before foreign domain reads. /today itself is shared; Hospitality child routes keep their restrictions.

Selection validates actual /branches, sets the existing httpOnly scope cookie and invalidates layout. Pending selection hides old page data and property metadata. The existing switcher disables repeat selection until completion; the next selection produces the final Business/Location scope. A1, A2, another Food Business, Beauty, Hospitality and reload were exercised against real branches and domain APIs.

## Evidence and isolation

`tests/today-ui` uses real Next scoped transport, Nest modules/controllers, RoleGuard, AuthorInterceptor, services and own PostgreSQL. Only identity and synthetic DB records are supplied. The controlled test clock changes no-argument Date construction in these own server processes; Date.now remains live. No production hook, shared Supabase or foreign worktree/process operation.

Real fixture date is 2026-10-05 00:30 Asia/Dubai while UTC date is 2026-10-04. Overnight SEATED spans 23:30–01:30. Food status matrix gives planned 3, seated 1, completed 1, free 1, unassigned 1, confirmation 2, no-show 1. More than 100 rows gives planned 104 and unassigned 102. Beauty matrix gives planned 3, confirmed 1, completed 1 and masters 1. Cancelled/terminal rows do not inflate planned or table occupancy.

Exact read budget: Beauty one /beauty/appointments response; Food one areas list, one tables list and both reservation days, with further cursor pages only when required. Foreign domain calls are counted with anchored root-route checks. Empty, STAFF, READ_ONLY, mandatory-source failures, absent Location recovery and signed-out scope are tested.

12 PNGs in [screenshots](screenshots): three verticals x 1440/390 x light/dark. Axe violations zero and horizontal overflow zero. Theme screenshots use Playwright stable animation frames. Keyboard opens/closes branch selection with focus restored; Today navigation uses aria-current and textual statuses.

Previous failed/interrupted attempts remain in recorded logs. Fixture corrections, identity updates and theme capture corrections are not presented as product RED/GREEN evidence. No test skips, assertions or timeouts were weakened.

## Checks

Final full checks and final PR reference will be recorded below after completion.

## Handoff boundary

Commit/push and PR MV8: Vertical Today only. No MV8 merge, production/release or MV9.
