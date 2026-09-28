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
