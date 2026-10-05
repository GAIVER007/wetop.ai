# Calendar daily widgets and mobile category repair

Owner approved plan and authorized choosing the hot-booking definition. UI/UX Pro Max compact-label guidance used; existing design tokens preserved. Changes are isolated in the calendar, read-only directory queries and regression tests. No schema, migration, financial calculation or booking mutation added. Root shared code/index/database untouched.

Hot: booking created on the property day with arrival that day, active TENTATIVE/CONFIRMED/CHECKED_IN. Primary source:https://exely.com/help/281526/. Existing date=created query applies property timezone and all pages are counted. NO_SHOW uses existing status filter with arrival today. Free rooms count ROOM only; occupancy preserves overall inventory and labels rooms/beds explicitly. Another displayed month does not change today metrics. API failures show unavailable rather than fake zero.

RED:2026-10-05T15-28-44Z-e2e-82a1.log, missing widgets and today occupancy unavailable outside displayed range. Category RED:2026-10-05T15-38-10Z-e2e-3e0b.log, first full word occupied two lines on original CSS. Intermediate failures are retained:authenticated test reads and obsolete birthday expectations fixed; semantic role and desktop caption wrapping repaired, not bypassed.

GREEN:42/42 focused mobile/calendar/focus/tasks/birthday scenarios,2026-10-05T15-39-31Z-e2e-af2f.log. Additional9/9 compact desktop, real labels, empty base and light/dark axe checks,2026-10-05T15-45-24Z-e2e-35fa.log. Further counter/types/lint evidence and exact release verification follow below. Public deployment not yet claimed.

Final local GREEN:8/8 statistics scenarios including a positive NO_SHOW,2026-10-05T15-47-31Z-e2e-6a8d.log. Typecheck passed across root/API/web,2026-10-05T15-48-44Z-typecheck-e616.log; lint passed,2026-10-05T15-49-07Z-lint-8b98.log.
