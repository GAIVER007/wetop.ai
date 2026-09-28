# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 29.09.2026 00:14 | typecheck | ✅ без ошибок | 31 с | 58aa571 +50 | [лог](logs/2026-09-28T19-14-26Z-typecheck-ed4e.log) |  |
| 29.09.2026 00:14 | lint | ✅ без ошибок | 18 с | 58aa571 +50 | [лог](logs/2026-09-28T19-14-58Z-lint-b780.log) |  |
| 29.09.2026 00:15 | unit | ✅ 2146 из 2149, пропущено 3 | 1 мин 18 с | 58aa571 +50 | [лог](logs/2026-09-28T19-15-19Z-unit-09cd.log) |  |
| 29.09.2026 00:17 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | 58aa571 +50 | [лог](logs/2026-09-28T19-17-14Z-e2e-e524.log) | INT2: полный UI-набор в один поток на дереве, слитом с main e0ac75f (сброс платформы) |
| 29.09.2026 00:20 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 22 мин 13 с | 58aa571 +50 | [лог](logs/2026-09-28T19-20-10Z-e2e-804b.log) | INT2: полный UI-набор в один поток на дереве, слитом с main e0ac75f; повтор после холодного next dev (…19-17-14Z) |
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
| 29.09.2026 00:41 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ✅ 3 из 3 | 14 с | 4de2d98 | [лог](logs/2026-09-28T19-41-12Z-e2e-c5d2.log) |  |
| 29.09.2026 00:41 | e2e | ✅ 25 из 25 | 55 с | 4de2d98 | [лог](logs/2026-09-28T19-41-32Z-e2e-1cc5.log) |  |
| 29.09.2026 00:44 | typecheck | ✅ без ошибок | 22 с | 743f7f4 +50 | [лог](logs/2026-09-28T19-44-45Z-typecheck-f2d3.log) |  |
| 29.09.2026 00:45 | lint | ✅ без ошибок | 17 с | 743f7f4 +50 | [лог](logs/2026-09-28T19-45-07Z-lint-7712.log) |  |
| 29.09.2026 00:45 | unit | ✅ 2155 из 2158, пропущено 3 | 1 мин 12 с | 743f7f4 +39 | [лог](logs/2026-09-28T19-45-28Z-unit-76d9.log) |  |
| 29.09.2026 00:47 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 539 | 40 мин 40 с | 743f7f4 +41 | [лог](logs/2026-09-28T19-47-19Z-e2e-f0bd.log) | INT2: полный UI-набор в один поток на дереве, слитом с main ef976e4 (перед вливанием в main по команде владельца) |
| 29.09.2026 01:28 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts:159) | ❌ упало 1 из 1 | 23 с | e2f675d | [лог](logs/2026-09-28T20-28-18Z-e2e-86cb.log) | INT2: одиночный повтор красного workspace:159 из полного прогона …19-47-19Z |
| 29.09.2026 01:29 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/integrations-channex.spec.ts tests/ui/integrations.spec.ts) | ✅ 19 из 19 | 59 с | e2f675d | [лог](logs/2026-09-28T20-29-28Z-e2e-a599.log) | INT2: спеки «Интеграций» и снимки стоп-гейта на дереве, слитом с main ef976e4 |
