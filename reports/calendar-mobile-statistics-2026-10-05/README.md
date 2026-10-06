# Calendar daily widgets and mobile category repair

Owner approved plan and authorized choosing the hot-booking definition. UI/UX Pro Max compact-label guidance used; existing design tokens preserved. Changes are isolated in the calendar, read-only directory queries and regression tests. No schema, migration, financial calculation or booking mutation added. Root shared code/index/database untouched.

Hot: booking created on the property day with arrival that day, active TENTATIVE/CONFIRMED/CHECKED_IN. Primary source:https://exely.com/help/281526/. Existing date=created query applies property timezone and all pages are counted. NO_SHOW uses existing status filter with arrival today. Free rooms count ROOM only; occupancy preserves overall inventory and labels rooms/beds explicitly. Another displayed month does not change today metrics. API failures show unavailable rather than fake zero.

RED:2026-10-05T15-28-44Z-e2e-82a1.log, missing widgets and today occupancy unavailable outside displayed range. Category RED:2026-10-05T15-38-10Z-e2e-3e0b.log, first full word occupied two lines on original CSS. Intermediate failures are retained:authenticated test reads and obsolete birthday expectations fixed; semantic role and desktop caption wrapping repaired, not bypassed.

GREEN:42/42 focused mobile/calendar/focus/tasks/birthday scenarios,2026-10-05T15-39-31Z-e2e-af2f.log. Additional9/9 compact desktop, real labels, empty base and light/dark axe checks,2026-10-05T15-45-24Z-e2e-35fa.log. Further counter/types/lint evidence and exact release verification follow below. Public deployment not yet claimed.

Final local GREEN:8/8 statistics scenarios including a positive NO_SHOW,2026-10-05T15-47-31Z-e2e-6a8d.log. Typecheck passed across root/API/web,2026-10-05T15-48-44Z-typecheck-e616.log; lint passed,2026-10-05T15-49-07Z-lint-8b98.log.

## Mobile design revision after owner feedback

The owner rejected the first visual design before main integration or deployment. The new mobile layout combines the daily widgets into one summary with a two-column guest grid. RED:2026-10-05T15-54-02Z-e2e-3534.log proved the previous summary was404.5 px tall. GREEN:2026-10-05T18-38-41Z-e2e-0435.log,35/35 scenarios across360/390/430, touch swipe, creation, focus restoration, both themes and compact desktop. The summary stays within280 px; ordinary calendar starts within700 px. Operational warnings remain visible and may push the calendar down. Typecheck:2026-10-05T18-41-44Z-typecheck-f0ce.log, passed. Updated screenshots show synthetic fixtures. The rejected candidate was not deployed; this revision is a visual preview pending further owner feedback.

## Approved continuation and main integration

Owner requested continuation after the revised preview. Main integration4f920646 preserves the existing Hospitality guard and search sizing fix. Integration checks:36/37 initially passed; the remaining Today test incorrectly assumed Monday. The existing implementation correctly aligns the current property day. Test now verifies today immediately after the sticky unit column and vertical reset; isolated rerun passed (2026-10-05T19-06-14Z-e2e-e68f.log). Main typecheck and lint passed.

Candidate77a9e9c3d94829b4ef08e72077b5fe52e124ece7 includes current productionc86e5296 and only calendar source changes, with no API/schema/migration delta. Full release-checks118:https://github.com/GAIVER007/wetop.ai/actions/runs/37361418750. Earlier run117 was cancelled after the weekday test issue was found. Production and final CI verification are pending.
## Final CI repair, 6 October

Run122 (a70cff84) was not green: UI1 found two slow analytics-to-calendar transitions and a notebook grid height of399.61px. GitHub also failed to allocate runners for bot and aggregate jobs. No release was advanced.

Local RED reproduced all three failures in2026-10-06T07-15-17Z-e2e-141e.log. The synthetic reservation directory enriched every row before pagination and rebuilt complete guest stay histories only to read email. It now enriches the requested page and reads email from the same guest record directly. Total, ordering and pagination are preserved. All9 analytics scenarios passed in2026-10-06T07-23-18Z-e2e-0cfe.log. Desktop summary vertical padding is2px; pointer targets remain24px and mobile padding is unchanged. GREEN11/11 compact notebook/statistics/theme/accessibility checks:2026-10-06T07-29-50Z-e2e-d82b.log. Typecheck and lint passed:2026-10-06T07-30-41Z-typecheck-1c74.log and2026-10-06T07-30-58Z-lint-cb7d.log. Intermediate diagnostic runs remain in the journal. Full CI and production verification remain pending.
