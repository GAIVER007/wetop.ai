# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:48 | typecheck | ✅ без ошибок | 28 с | cca172c | [лог](logs/2026-09-28T17-48-16Z-typecheck-081e.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), миграция 032 |
| 28.09.2026 22:48 | lint | ✅ без ошибок | 16 с | cca172c | [лог](logs/2026-09-28T17-48-45Z-lint-b27f.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), миграция 032 |
| 28.09.2026 22:49 | unit | ✅ 2141 из 2144, пропущено 3 | 1 мин 36 с | cca172c | [лог](logs/2026-09-28T17-49-06Z-unit-65b3.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118) |
| 28.09.2026 22:50 | integration | ✅ 113 из 113 | 32 с | cca172c | [лог](logs/2026-09-28T17-50-52Z-integration-6b60.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), свежая локальная база |
| 28.09.2026 22:56 | e2e | ❌ упало 2 из 25 | 4 мин 42 с | cca172c | [лог](logs/2026-09-28T17-56-12Z-e2e-9bda.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), свежая сборка web |
| 28.09.2026 23:01 | e2e | ❌ упало 2 из 26 | 4 мин 43 с | cca172c | [лог](logs/2026-09-28T18-01-36Z-e2e-865b.log) | cleanup P1: слитое дерево (ADR-118), E2E_AUTH=1, API ролью wetop_app |
| 28.09.2026 23:06 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 9 с | e0ac75f | [лог](logs/2026-09-28T18-06-31Z-e2e-0e49.log) | контроль: чистый main e0ac75f — finance и full-day без правки cleanup |
# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:48 | typecheck | ✅ без ошибок | 30 с | e0ac75f | [лог](logs/2026-09-28T17-48-22Z-typecheck-6ec2.log) | release e0ac75fb verification |
| 28.09.2026 22:48 | lint | ✅ без ошибок | 17 с | e0ac75f | [лог](logs/2026-09-28T17-48-52Z-lint-d614.log) | release e0ac75fb verification |
| 28.09.2026 22:49 | unit | ❌ упало 2 из 2143, пропущено 3 | 1 мин 36 с | e0ac75f | [лог](logs/2026-09-28T17-49-10Z-unit-d242.log) | release e0ac75fb verification |
| 28.09.2026 22:51 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 17 с | e0ac75f | [лог](logs/2026-09-28T17-51-03Z-unit-4564.log) | release e0ac75fb verification (named branch) |
| 28.09.2026 22:52 | integration | ✅ 110 из 110 | 33 с | e0ac75f | [лог](logs/2026-09-28T17-52-34Z-integration-cbc4.log) | release e0ac75fb verification |
| 28.09.2026 22:53 | e2e | ❌ упало 2 из 25 | 4 мин 44 с | e0ac75f | [лог](logs/2026-09-28T17-53-13Z-e2e-1c89.log) | release e0ac75fb verification |
| 28.09.2026 22:59 | e2e | ❌ упало 2 из 25 | 1 мин 11 с | e0ac75f | [лог](logs/2026-09-28T17-59-19Z-e2e-7b79.log) | seed laundry code = name; release e0ac75fb |
| 28.09.2026 23:01 | e2e | ✅ 25 из 25 | 1 мин 1 с | e0ac75f | [лог](logs/2026-09-28T18-01-05Z-e2e-2018.log) | seed laundry: code = name, 500 ₸; release e0ac75fb |
| 28.09.2026 23:02 | typecheck | ✅ без ошибок | 20 с | e0ac75f +1 | [лог](logs/2026-09-28T18-02-19Z-typecheck-41cd.log) | seed laundry fix |
| 28.09.2026 23:02 | lint | ✅ без ошибок | 16 с | e0ac75f +1 | [лог](logs/2026-09-28T18-02-40Z-lint-db8d.log) | seed laundry fix |
| 28.09.2026 23:02 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 16 с | e0ac75f +1 | [лог](logs/2026-09-28T18-02-57Z-unit-758e.log) | seed laundry fix |
| 28.09.2026 23:05 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | b27de05 | [лог](logs/2026-09-28T18-05-38Z-e2e-3206.log) | full UI on release e0ac75fb + seed fix |
| 28.09.2026 23:08 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 516 | 41 мин 48 с | 1d58d9a | [лог](logs/2026-09-28T18-08-55Z-e2e-4673.log) | full UI on release e0ac75fb + seed fix (retry after cold-start timeout) |
| 28.09.2026 23:50 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/manager-actions.spec.ts --workers=1 --repeat-each=3 --grep отмена, незаезд) | ✅ 3 из 3 | 34 с | 6d878c9 | [лог](logs/2026-09-28T18-50-57Z-e2e-b8da.log) | repro no-show tab race before fix |
| 28.09.2026 23:51 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/manager-actions.spec.ts --workers=1 --grep отмена, незаезд) | ✅ 1 из 1 | 29 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-51-47Z-e2e-b525.log) | repro: 2 s server action delay, before fix |
| 28.09.2026 23:53 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/manager-actions.spec.ts --workers=1 --repeat-each=5) | ✅ 45 из 45 | 2 мин 54 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-53-49Z-e2e-f24c.log) | no-show step waits for the action before switching tab |
| 28.09.2026 23:56 | typecheck | ✅ без ошибок | 31 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-56-50Z-typecheck-7ed7.log) | manager-actions wait |
| 28.09.2026 23:57 | lint | ✅ без ошибок | 16 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-57-21Z-lint-3a92.log) | manager-actions wait |
| 29.09.2026 00:10 | e2e | ✅ 25 из 25 | 1 мин 2 с | 8d276c7 | [лог](logs/2026-09-28T19-10-22Z-e2e-a6b5.log) | PR #135 head |
# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
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
# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:46 | typecheck | ✅ без ошибок | 33 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-46-31Z-typecheck-ab66.log) | merge main into chessboard-v2 (PR4 head) |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 19 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-47-09Z-lint-30b2.log) | merge main into chessboard-v2 (PR4 head) |
| 28.09.2026 22:47 | unit | ✅ 2156 из 2159, пропущено 3 | 1 мин 19 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-47-29Z-unit-3120.log) | merge main into chessboard-v2 (PR4 head) |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-blocks.spec.ts tests/ui/chessboard-card.spec.ts tests/ui/chessboard-design.spec.ts tes | ✅ 46 из 46 | 6 мин 52 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-49-00Z-e2e-18a6.log) | merged tree: chessboard UI specs (PR1-4) |
| 28.09.2026 22:59 | unit (частично: apps/web/src/app/chessboard/range-plan.test.ts) | ❌ код выхода 1 | 1 с | 17fda46 +5 | [лог](logs/2026-09-28T17-59-55Z-unit-ca47.log) | RED PR5: selectRange/freeMenuModel not yet implemented |
| 28.09.2026 23:00 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-range.spec.ts tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts tests | ❌ упало 6 из 6 | 2 мин 53 с | 17fda46 +11 | [лог](logs/2026-09-28T18-00-04Z-e2e-dc2c.log) | RED PR5: range selection, free-cell menu, adapted free-cell paths — on current code |
| 28.09.2026 23:03 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-week.spec.ts -g создание на воскресенье --workers=1) | ❌ упало 1 из 1 | 51 с | 17fda46 +11 | [лог](logs/2026-09-28T18-03-09Z-e2e-3d40.log) | RED PR5: week free-cell path via free menu — on current code |
| 28.09.2026 23:06 | unit (частично: apps/web/src/app/chessboard/range-plan.test.ts apps/web/src/app/chessboard/drag-plan.test.ts apps/web/src/app/chessboard/extend-plan.test.ts tes | ✅ 56 из 56 | 1 с | 17fda46 +11 | [лог](logs/2026-09-28T18-06-45Z-unit-99d1.log) | GREEN PR5: range-plan + design guards |
| 28.09.2026 23:06 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-range.spec.ts tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts tests | ✅ 7 из 7 | 37 с | 17fda46 +17 | [лог](logs/2026-09-28T18-06-53Z-e2e-148d.log) | GREEN PR5 attempt 1: range selection, free menu, adapted paths |
| 28.09.2026 23:07 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-gate-pr5.spec.ts --workers=1) | ✅ 2 из 2 | 25 с | 17fda46 +18 | [лог](logs/2026-09-28T18-07-57Z-e2e-ad33.log) | PR5 gate screenshots (light/dark) |
| 28.09.2026 23:09 | typecheck | ✅ без ошибок | 29 с | 17fda46 +18 | [лог](logs/2026-09-28T18-09-12Z-typecheck-70dc.log) | PR5 final code |
| 28.09.2026 23:09 | lint | ✅ без ошибок | 15 с | 17fda46 +18 | [лог](logs/2026-09-28T18-09-42Z-lint-e3d0.log) | PR5 final code |
| 28.09.2026 23:09 | unit | ✅ 2164 из 2167, пропущено 3 | 1 мин 13 с | 17fda46 +11 | [лог](logs/2026-09-28T18-09-57Z-unit-7513.log) | PR5 final code |
| 28.09.2026 23:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 529 из 529 | 40 мин 24 с | 17fda46 +18 | [лог](logs/2026-09-28T18-11-16Z-e2e-9163.log) | PR5 final code: full UI suite (merged tree) |
| 28.09.2026 23:52 | e2e | ❌ упало 5 из 25, пропущено 2 | 5 мин 39 с | 17fda46 +18 | [лог](logs/2026-09-28T18-52-04Z-e2e-2f7f.log) | PR5 final code: full e2e on local PostgreSQL (merged tree) |
| 28.09.2026 23:58 | e2e (частично: tests/e2e/desk-day.spec.ts tests/e2e/check-in-out.spec.ts tests/e2e/web-analytics.spec.ts tests/e2e/full-day.spec.ts tests/e2e/web-booking.spec.t | ❌ упало 5 из 9, пропущено 2 | 5 мин 15 с | 17fda46 +18 | [лог](logs/2026-09-28T18-58-37Z-e2e-b778.log) | BASE CHECK: same 5 live e2e specs with app code = origin/main (PR4/PR5 app files swapped to main versions) |
