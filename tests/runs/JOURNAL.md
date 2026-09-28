# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 13:40 | unit (частично: packages/domain/src/dashboard/metrics.test.ts) | ❌ упало 7 из 16 | 2 с | 1b187fa +1 | [лог](logs/2026-09-28T08-40-26Z-unit-df30.log) | AN2 red: Q-209 bookings by Reservation, category free/blocked/unassigned |
| 28.09.2026 13:41 | unit (частично: apps/api/src/dashboard/) | ❌ упало 1 из 9 | 3 с | 1b187fa +4 | [лог](logs/2026-09-28T08-41-21Z-unit-ed43.log) | AN2 red: stays carry reservation id and status (Q-209) |
| 28.09.2026 13:45 | unit (частично: packages/domain/src/dashboard/ apps/api/src/dashboard/) | ✅ 29 из 29 | 3 с | 1b187fa +6 | [лог](logs/2026-09-28T08-45-18Z-unit-a1d6.log) | AN2 green: Q-209 bookings by Reservation, category free/blocked/unassigned |
| 28.09.2026 13:46 | unit (частично: apps/api/src/dashboard/dashboard.repository.test.ts) | ❌ упало 1 из 5 | 2 с | 50551c0 +1 | [лог](logs/2026-09-28T08-46-21Z-unit-887b.log) | AN2 red: group of unassigned beds collapsed to one in unassignedByCategory |
| 28.09.2026 13:46 | unit (частично: apps/api/src/dashboard/) | ✅ 10 из 10 | 2 с | 50551c0 +2 | [лог](logs/2026-09-28T08-46-37Z-unit-c9cd.log) | AN2 green: unassigned group beds counted per stay across board chunks |
| 28.09.2026 13:48 | unit (частично: apps/web/src/app/management/analytics/params.test.ts) | ❌ упало 4 из 7 | 2 с | 50551c0 +3 | [лог](logs/2026-09-28T08-48-57Z-unit-1aeb.log) | AN2 red: occupancy tab address, legacy ?date=, day stepping |
| 28.09.2026 13:49 | unit (частично: apps/web/src/app/management/analytics/params.test.ts) | ✅ 7 из 7 | 2 с | 50551c0 +4 | [лог](logs/2026-09-28T08-49-18Z-unit-3d34.log) | AN2 green: occupancy tab address, legacy ?date=, day stepping |
| 28.09.2026 13:55 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/analytics-occupancy.spec.ts tests/ui/analytics-v2.spec.ts) | ✅ 17 из 17 | 3 мин 11 с | 50551c0 +15 | [лог](logs/2026-09-28T08-55-27Z-e2e-e25c.log) | AN2: occupancy tab v2 + overview Q-208/Q-209, first run |
| 28.09.2026 14:00 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/analytics-occupancy.spec.ts -g телефон) | ❌ упало 1 из 1 | 9 с | 50551c0 +16 | [лог](logs/2026-09-28T09-00-49Z-e2e-4966.log) | AN2 red: category bars collapse to zero width on phone (shared .hbars rule) |
| 28.09.2026 14:01 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/analytics-occupancy.spec.ts -g телефон) | ✅ 1 из 1 | 9 с | 50551c0 +16 | [лог](logs/2026-09-28T09-01-06Z-e2e-b417.log) | AN2 green: category bars visible on phone |
| 28.09.2026 14:08 | typecheck | ✅ без ошибок | 33 с | 50551c0 +38 | [лог](logs/2026-09-28T09-08-18Z-typecheck-a18e.log) | AN2: occupancy tab v2, dashboard redirect, test ports |
| 28.09.2026 14:08 | lint | ✅ без ошибок | 18 с | 50551c0 +38 | [лог](logs/2026-09-28T09-08-56Z-lint-cc40.log) | AN2: occupancy tab v2, dashboard redirect, test ports |
| 28.09.2026 14:12 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts tests/ui/navigation.spec.ts tests/ui/dashboard-design.spec.ts tests | ❌ упало 6 из 129 | 9 мин 4 с | 50551c0 +39 | [лог](logs/2026-09-28T09-12-45Z-e2e-8b2e.log) | AN2: ported specs after /management/dashboard redirect |
| 28.09.2026 14:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/dashboard-design.spec.ts tests/ui/dashboard-desk.spec.ts tests/ui/design-refresh.spec | ❌ упало 1 из 26 | 2 мин 36 с | 50551c0 +39 | [лог](logs/2026-09-28T09-23-15Z-e2e-3f75.log) | AN2: rerun after money-delta wording, panel locator, phone targets |
| 28.09.2026 14:26 | unit | ❌ упало 3 из 2311, пропущено 3 | 1 мин 19 с | 50551c0 +26 | [лог](logs/2026-09-28T09-26-13Z-unit-5f0f.log) | AN2: full unit after occupancy tab v2, Q-208/Q-209, dashboard redirect |
| 28.09.2026 14:28 | unit | ✅ 2308 из 2311, пропущено 3 | 1 мин 18 с | 50551c0 +27 | [лог](logs/2026-09-28T09-28-26Z-unit-1c57.log) | AN2: full unit after occupancy tab v2, Q-208/Q-209, dashboard redirect |
| 28.09.2026 14:30 | integration | ✅ 124 из 124 | 43 с | 50551c0 +3 | [лог](logs/2026-09-28T09-30-14Z-integration-ee80.log) | AN2: integration after Q-209 and unassigned fix |
| 28.09.2026 14:31 | e2e | ✅ 25 из 25 | 1 мин 4 с | 50551c0 +39 | [лог](logs/2026-09-28T09-31-38Z-e2e-c20d.log) | AN2: live e2e (desk-day ported to analytics) |
| 28.09.2026 14:33 | e2e | ✅ 26 из 26 | 1 мин 10 с | 50551c0 +39 | [лог](logs/2026-09-28T09-33-21Z-e2e-928e.log) | AN2: E2E_AUTH=1, API as wetop_app (RLS) |
| 28.09.2026 14:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 7 из 524 | 44 мин 42 с | 50551c0 +39 | [лог](logs/2026-09-28T09-34-40Z-e2e-0704.log) | AN2: full UI suite, single worker |
| 28.09.2026 15:20 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/roles.spec.ts) | ❌ упало 1 из 13 | 1 мин 19 с | bcc3007 +1 | [лог](logs/2026-09-28T10-20-18Z-e2e-3a2d.log) | AN2: roles menu expects /management/analytics (red in full run 09-34-40Z) |
| 28.09.2026 22:44 | typecheck | ✅ без ошибок | 39 с | 9e0e447 | [лог](logs/2026-09-28T17-44-05Z-typecheck-5034.log) | AN2 after merging main (seam fixes) |
| 28.09.2026 22:44 | lint | ✅ без ошибок | 19 с | 9e0e447 | [лог](logs/2026-09-28T17-44-44Z-lint-cef1.log) | AN2 after merging main (seam fixes) |
| 28.09.2026 22:47 | typecheck | ✅ без ошибок | 18 с | 3ae45d4 | [лог](logs/2026-09-28T17-47-54Z-typecheck-370b.log) | AN2 on main after platform reset |
| 28.09.2026 22:48 | lint | ✅ без ошибок | 14 с | 3ae45d4 | [лог](logs/2026-09-28T17-48-13Z-lint-98a3.log) | AN2 on main after platform reset |
| 28.09.2026 22:48 | unit | ✅ 2150 из 2153, пропущено 3 | 1 мин 24 с | 3ae45d4 | [лог](logs/2026-09-28T17-48-28Z-unit-4799.log) | AN2 on main after platform reset |
| 28.09.2026 22:50 | integration | ❌ упало 1 из 110 | 32 с | 3ae45d4 | [лог](logs/2026-09-28T17-50-16Z-integration-08a8.log) | AN2 on main after platform reset |
| 28.09.2026 22:51 | integration | ✅ 110 из 110 | 29 с | 3ae45d4 | [лог](logs/2026-09-28T17-51-13Z-integration-b5ed.log) | AN2 on main after platform reset, fresh local stand |
| 28.09.2026 22:52 | e2e | ❌ упало 2 из 25 | 4 мин 38 с | 3ae45d4 | [лог](logs/2026-09-28T17-52-23Z-e2e-22f5.log) | AN2 on main after platform reset: live e2e |
| 28.09.2026 22:57 | e2e | ❌ упало 2 из 26 | 4 мин 39 с | 3ae45d4 | [лог](logs/2026-09-28T17-57-21Z-e2e-466e.log) | AN2 on main after platform reset: E2E_AUTH=1, API as wetop_app |
| 28.09.2026 23:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 524 из 524 | 38 мин 18 с | 3ae45d4 | [лог](logs/2026-09-28T18-02-08Z-e2e-dca6.log) | AN2 on main after platform reset: full UI suite, single worker |
