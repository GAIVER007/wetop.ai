# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:10 | typecheck | ✅ без ошибок | 33 с | 5d8e743 +50 | [лог](logs/2026-09-28T17-10-34Z-typecheck-bafb.log) | C3 после слияния с main (очистка наследия, ADR-118): typecheck |
| 28.09.2026 22:11 | lint | ✅ без ошибок | 19 с | 9d08a98 | [лог](logs/2026-09-28T17-11-42Z-lint-1b05.log) | C3 после слияния с main (очистка наследия, ADR-118): lint |
| 28.09.2026 22:12 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 27 с | 9d08a98 | [лог](logs/2026-09-28T17-12-01Z-unit-9957.log) | C3 после слияния с main (очистка наследия, ADR-118): unit |
| 28.09.2026 22:13 | integration | ✅ 111 из 111 | 33 с | 9d08a98 | [лог](logs/2026-09-28T17-13-47Z-integration-3018.log) | C3 после слияния с main (очистка наследия, ADR-118): integration на свежей базе |
| 28.09.2026 22:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | 9d08a98 | [лог](logs/2026-09-28T17-14-30Z-e2e-4c4b.log) | C3 после слияния с main (очистка наследия, ADR-118): полный UI-набор в один поток |
| 28.09.2026 22:18 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 517 из 517 | 39 мин 49 с | f58ea36 | [лог](logs/2026-09-28T17-18-33Z-e2e-27a3.log) | C3 после слияния с main (очистка наследия, ADR-118): полный UI-набор в один поток; повтор — первый не дождался холодной сборки стойки (120 с) |
| 28.09.2026 22:59 | e2e | ❌ упало 2 из 25 | 4 мин 38 с | 81f0ada | [лог](logs/2026-09-28T17-59-38Z-e2e-65a3.log) | C3 после слияния с main (очистка наследия, ADR-118): живые e2e на свежем стенде |
| 28.09.2026 23:06 | typecheck | ✅ без ошибок | 21 с | 81f0ada +4 | [лог](logs/2026-09-28T18-06-48Z-typecheck-13ea.log) | живые e2e: услуга стенда 500 ₸ и выбор по названию |
| 28.09.2026 23:07 | lint | ✅ без ошибок | 16 с | 81f0ada +4 | [лог](logs/2026-09-28T18-07-09Z-lint-7101.log) | живые e2e: услуга стенда 500 ₸ и выбор по названию |
| 28.09.2026 23:07 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 14 с | 81f0ada +1 | [лог](logs/2026-09-28T18-07-26Z-unit-317f.log) | живые e2e: услуга стенда 500 ₸ и выбор по названию |
| 28.09.2026 23:08 | e2e | ✅ 25 из 25 | 1 мин | 81f0ada +3 | [лог](logs/2026-09-28T18-08-56Z-e2e-2714.log) | C3 после слияния с main: живые e2e на свежем стенде; услуга стенда 500 ₸, выбор по названию |
| 28.09.2026 23:10 | integration | ✅ 111 из 111 | 33 с | 81f0ada | [лог](logs/2026-09-28T18-10-04Z-integration-4ec2.log) | после правки услуги стенда (500 ₸) |
| 29.09.2026 00:11 | integration (частично: tests/integration/category-usage.test.ts) | ❌ упало 1 из 1 | 4 с | 7485e92 +1 | [лог](logs/2026-09-28T19-11-28Z-integration-4c12.log) | C4: счётчики использования категории — красный до кода |
| 29.09.2026 00:11 | integration (частично: tests/integration/category-usage.test.ts tests/integration/inventory-editor.test.ts tests/integration/category-rate-plan.test.ts) | ✅ 3 из 3 | 5 с | 7485e92 +2 | [лог](logs/2026-09-28T19-11-57Z-integration-45cf.log) | C4: счётчики использования категории — зелёный |
| 29.09.2026 00:13 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/categories-safe-edit.spec.ts) | ❌ упало 1 из 1 | 1 мин 14 с | 7485e92 +4 | [лог](logs/2026-09-28T19-13-28Z-e2e-3bda.log) | C4: правка показывает использование — красный до кода стойки |
| 29.09.2026 00:16 | typecheck | ✅ без ошибок | 29 с | 7485e92 +10 | [лог](logs/2026-09-28T19-16-02Z-typecheck-6db1.log) | C4: использование категории в правке и панели |
| 29.09.2026 00:16 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/categories-safe-edit.spec.ts) | ✅ 1 из 1 | 20 с | 7485e92 +9 | [лог](logs/2026-09-28T19-16-31Z-e2e-2bef.log) | C4: правка показывает использование — зелёный |
| 29.09.2026 00:18 | lint | ✅ без ошибок | 16 с | 7485e92 +10 | [лог](logs/2026-09-28T19-18-29Z-lint-8c66.log) | C4a |
| 29.09.2026 00:18 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 14 с | 7485e92 +8 | [лог](logs/2026-09-28T19-18-46Z-unit-6bd5.log) | C4a |
| 29.09.2026 00:20 | integration | ✅ 112 из 112 | 33 с | 7485e92 +3 | [лог](logs/2026-09-28T19-20-01Z-integration-9e05.log) | C4a: весь набор |
| 29.09.2026 00:21 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 130 | 11 мин 32 с | 213dea7 | [лог](logs/2026-09-28T19-21-01Z-e2e-c4da.log) | C4a: полный UI-набор в один поток |
| 29.09.2026 00:32 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/empty-base.spec.ts tests/ui/fund-workspace.spec.ts tests/ui/inventory-catalog.spec.ts | ❌ упало 1 из 142 | 8 мин 43 с | 213dea7 | [лог](logs/2026-09-28T19-32-49Z-e2e-83fa.log) | C4a: спеки фонда и соседних экранов (полный прогон остановлен на 89/89 по просьбе влить сейчас) |
| 29.09.2026 00:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts -g доступность переносит даты) | ✅ 1 из 1 | 9 с | 213dea7 +1 | [лог](logs/2026-09-28T19-42-31Z-e2e-03bf.log) | workspace:159 — даты от сегодня стенда вместо вшитых 01–04.10 |
| 29.09.2026 00:43 | e2e | ✅ 25 из 25 | 57 с | 213dea7 +1 | [лог](logs/2026-09-28T19-43-14Z-e2e-8548.log) | C4a: живые e2e на свежем стенде |
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
