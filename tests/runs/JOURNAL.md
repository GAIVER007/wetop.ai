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
| 28.09.2026 22:47 | typecheck | ✅ без ошибок | 26 с | 573f0bb | [лог](logs/2026-09-28T17-47-08Z-typecheck-05b6.log) |  |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 14 с | 573f0bb | [лог](logs/2026-09-28T17-47-35Z-lint-8dc4.log) |  |
| 28.09.2026 22:47 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 34 с | 573f0bb | [лог](logs/2026-09-28T17-47-50Z-unit-298b.log) |  |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | 573f0bb | [лог](logs/2026-09-28T17-49-34Z-e2e-156b.log) | (ошибка вне тестов) |
| 28.09.2026 22:52 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 37 мин 56 с | 573f0bb | [лог](logs/2026-09-28T17-52-10Z-e2e-7e2d.log) |  |
| 28.09.2026 23:31 | e2e | ❌ упало 2 из 25 | 4 мин 37 с | d3a7f75 | [лог](logs/2026-09-28T18-31-29Z-e2e-a51e.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:36 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 8 с | d3a7f75 | [лог](logs/2026-09-28T18-36-35Z-e2e-e314.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:41 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 8 с | e0ac75f | [лог](logs/2026-09-28T18-41-14Z-e2e-9fd1.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 523 | 37 мин 30 с | efdd9b1 | [лог](logs/2026-09-28T18-46-59Z-e2e-2ddd.log) | доступность переносит даты и свободное место в создание брони; неверный период виден |
| 29.09.2026 00:25 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts:159) | ❌ упало 1 из 1 | 23 с | e0ac75f | [лог](logs/2026-09-28T19-25-10Z-e2e-d9d7.log) | доступность переносит даты и свободное место в создание брони; неверный период виден |
| 29.09.2026 00:26 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/today-operations.spec.ts) | ✅ 7 из 7 | 24 с | cf025ff +1 | [лог](logs/2026-09-28T19-26-02Z-e2e-67b8.log) |  |
| 28.09.2026 22:48 | typecheck | ✅ без ошибок | 28 с | cca172c | [лог](logs/2026-09-28T17-48-16Z-typecheck-081e.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), миграция 032 |
| 28.09.2026 22:48 | lint | ✅ без ошибок | 16 с | cca172c | [лог](logs/2026-09-28T17-48-45Z-lint-b27f.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), миграция 032 |
| 28.09.2026 22:49 | unit | ✅ 2141 из 2144, пропущено 3 | 1 мин 36 с | cca172c | [лог](logs/2026-09-28T17-49-06Z-unit-65b3.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118) |
| 28.09.2026 22:50 | integration | ✅ 113 из 113 | 32 с | cca172c | [лог](logs/2026-09-28T17-50-52Z-integration-6b60.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), свежая локальная база |
| 28.09.2026 22:56 | e2e | ❌ упало 2 из 25 | 4 мин 42 с | cca172c | [лог](logs/2026-09-28T17-56-12Z-e2e-9bda.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), свежая сборка web |
| 28.09.2026 23:01 | e2e | ❌ упало 2 из 26 | 4 мин 43 с | cca172c | [лог](logs/2026-09-28T18-01-36Z-e2e-865b.log) | cleanup P1: слитое дерево (ADR-118), E2E_AUTH=1, API ролью wetop_app |
| 28.09.2026 23:06 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 9 с | e0ac75f | [лог](logs/2026-09-28T18-06-31Z-e2e-0e49.log) | контроль: чистый main e0ac75f — finance и full-day без правки cleanup |
| 29.09.2026 00:32 | typecheck | ✅ без ошибок | 23 с | b26c218 | [лог](logs/2026-09-28T19-32-12Z-typecheck-5f2e.log) | AN2 merged with main #132, before merging PR #128 |
| 29.09.2026 00:32 | lint | ✅ без ошибок | 16 с | b26c218 | [лог](logs/2026-09-28T19-32-35Z-lint-a107.log) | AN2 merged with main #132 |
| 29.09.2026 00:32 | unit | ✅ 2151 из 2154, пропущено 3 | 1 мин 16 с | b26c218 | [лог](logs/2026-09-28T19-32-52Z-unit-531b.log) | AN2 merged with main #132 |
| 29.09.2026 00:34 | integration | ✅ 113 из 113 | 31 с | b26c218 | [лог](logs/2026-09-28T19-34-22Z-integration-d05a.log) | AN2 merged with main #132, fresh stand |
| 29.09.2026 00:35 | e2e | ❌ упало 2 из 25 | 4 мин 38 с | b26c218 | [лог](logs/2026-09-28T19-35-07Z-e2e-e57c.log) | AN2 merged with main #132: live e2e |
| 29.09.2026 00:35 | typecheck | ✅ без ошибок | 25 с | a8b286b | [лог](logs/2026-09-28T19-35-32Z-typecheck-4e47.log) |  |
| 29.09.2026 00:35 | lint | ✅ без ошибок | 13 с | a8b286b | [лог](logs/2026-09-28T19-35-58Z-lint-3374.log) |  |
| 29.09.2026 00:36 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/today-operations.spec.ts tests/ui/requests.spec.ts tests/ui/loading-performance.spec. | ✅ 57 из 57 | 2 мин 9 с | a8b286b | [лог](logs/2026-09-28T19-36-17Z-e2e-1cd8.log) |  |
| 29.09.2026 00:10 | typecheck | ✅ без ошибок | 31 с | 2b09e78 | [лог](logs/2026-09-28T19-10-00Z-typecheck-f177.log) | RT2 после слияния main (e0ac75fb) |
| 29.09.2026 00:10 | lint | ✅ без ошибок | 18 с | 2b09e78 | [лог](logs/2026-09-28T19-10-31Z-lint-3a6a.log) | RT2 после слияния main (e0ac75fb) |
| 29.09.2026 00:10 | unit | ❌ упало 1 из 2151, пропущено 3 | 1 мин 28 с | 2b09e78 | [лог](logs/2026-09-28T19-10-49Z-unit-d3a4.log) | RT2 после слияния main (e0ac75fb) |
| 29.09.2026 00:12 | unit (частично: apps/web/src/lib/hotel-time.test.ts) | ✅ 3 из 3 | 2 с | 2b09e78 | [лог](logs/2026-09-28T19-12-44Z-unit-1c1f.log) | hotel-time отдельно: упал в полном unit после слияния main |
| 29.09.2026 00:12 | unit | ✅ 2148 из 2151, пропущено 3 | 1 мин 16 с | 2b09e78 | [лог](logs/2026-09-28T19-12-53Z-unit-c92a.log) | RT2 после слияния main: повтор полного unit (hotel-time упал под нагрузкой, отдельно 3/3) |
| 29.09.2026 00:14 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/rates-range.spec.ts tests/ui/rates-design.spec.ts tests/ui/workspace.spec.ts tests/ui/channex-scr | ❌ упало 1 из 87 | 5 мин 42 с | 2b09e78 | [лог](logs/2026-09-28T19-14-20Z-e2e-5c79.log) | RT2 после слияния main: спеки тарифов, workspace, каналы |
| 29.09.2026 00:20 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:159 --workers=1) | ❌ упало 1 из 1 | 23 с | 2b09e78 | [лог](logs/2026-09-28T19-20-16Z-e2e-8c14.log) | workspace:159 отдельно на слитом дереве RT2 |
| 29.09.2026 00:20 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:159 --workers=1) | ❌ упало 1 из 1 | 26 с | e0ac75f | [лог](logs/2026-09-28T19-20-47Z-e2e-4abb.log) | сверка: workspace:159 на чистом main e0ac75fb (без RT2) |
| 29.09.2026 00:33 | typecheck | ✅ без ошибок | 21 с | 7df44f9 | [лог](logs/2026-09-28T19-33-28Z-typecheck-1e9b.log) | RT2 после слияния main 4f5bc769 (#109, #132) |
| 29.09.2026 00:33 | lint | ✅ без ошибок | 16 с | 7df44f9 | [лог](logs/2026-09-28T19-33-50Z-lint-9594.log) | RT2 после слияния main 4f5bc769 (#109, #132) |
| 29.09.2026 00:34 | unit | ✅ 2149 из 2152, пропущено 3 | 1 мин 16 с | 7df44f9 | [лог](logs/2026-09-28T19-34-13Z-unit-244e.log) | RT2 после слияния main 4f5bc769 (#109, #132) |
| 29.09.2026 00:35 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/rates-range.spec.ts tests/ui/rates-design.spec.ts --workers=1) | ✅ 11 из 11 | 33 с | 7df44f9 | [лог](logs/2026-09-28T19-35-30Z-e2e-9c8a.log) | RT2 после слияния main 4f5bc769: спеки тарифов |
| 29.09.2026 00:42 | lint | ✅ без ошибок | 13 с | 9f83429 | [лог](logs/2026-09-28T19-42-42Z-lint-c9c4.log) | AN2 merged with main (A2, RT2) |
| 29.09.2026 00:42 | unit | ✅ 2159 из 2162, пропущено 3 | 1 мин 12 с | 9f83429 | [лог](logs/2026-09-28T19-42-56Z-unit-edbe.log) | AN2 merged with main (A2, RT2) |
| 29.09.2026 00:44 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/analytics-occupancy.spec.ts tests/ui/analytics-v2.spec.ts tests/ui/today-operations.s | ❌ упало 1 из 145 | 13 мин 45 с | 9f83429 | [лог](logs/2026-09-28T19-44-17Z-e2e-aa1e.log) | AN2 merged with main (A2, RT2): analytics, today, workspace, design, a11y specs |
| 29.09.2026 00:58 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts -g доступность переносит даты) | ❌ упало 1 из 1 | 23 с | 6f100e7 | [лог](logs/2026-09-28T19-58-32Z-e2e-d1f9.log) | workspace:161 rerun after Almaty midnight (date-dependent availability?) |
