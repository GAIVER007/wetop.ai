# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:46 | typecheck | ✅ без ошибок | 32 с | 8d41be6 | [лог](logs/2026-09-28T17-46-23Z-typecheck-b28f.log) |  |
| 28.09.2026 22:46 | unit (частично: apps/web/src/lib/website.test.ts) | ❌ упало 1 из 30 | 4 с | f5fc9ac +1 | [лог](logs/2026-09-28T17-46-25Z-unit-7eae.log) | ввод домена (WEB2) пустой ввод и не-адрес названы словами до запроса в API |
| 28.09.2026 22:46 | typecheck | ✅ без ошибок | 33 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-46-31Z-typecheck-ab66.log) | merge main into chessboard-v2 (PR4 head) |
| 28.09.2026 22:46 | unit (частично: apps/web/src/lib/website.test.ts) | ✅ 30 из 30 | 2 с | f5fc9ac +3 | [лог](logs/2026-09-28T17-46-44Z-unit-3e11.log) |  |
| 28.09.2026 22:46 | typecheck | ✅ без ошибок | 33 с | 1fbbb0e | [лог](logs/2026-09-28T17-46-46Z-typecheck-0cb3.log) | PR #123 после слияния main e0ac75fb (сброс платформы, швы интеграции) |
| 28.09.2026 22:46 | lint | ✅ без ошибок | 17 с | 8d41be6 | [лог](logs/2026-09-28T17-46-56Z-lint-fd24.log) |  |
| 28.09.2026 22:47 | typecheck | ✅ без ошибок | 30 с | 3f87ad5 +1 | [лог](logs/2026-09-28T17-47-05Z-typecheck-6040.log) |  |
| 28.09.2026 22:47 | typecheck | ✅ без ошибок | 26 с | 573f0bb | [лог](logs/2026-09-28T17-47-08Z-typecheck-05b6.log) |  |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 19 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-47-09Z-lint-30b2.log) | merge main into chessboard-v2 (PR4 head) |
| 28.09.2026 22:47 | unit | ✅ 2145 из 2148, пропущено 3 | 1 мин 25 с | 8d41be6 | [лог](logs/2026-09-28T17-47-14Z-unit-46e7.log) |  |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 19 с | 1fbbb0e | [лог](logs/2026-09-28T17-47-20Z-lint-b945.log) | PR #123 после слияния main e0ac75fb |
| 28.09.2026 22:47 | unit | ✅ 2156 из 2159, пропущено 3 | 1 мин 19 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-47-29Z-unit-3120.log) | merge main into chessboard-v2 (PR4 head) |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 14 с | 573f0bb | [лог](logs/2026-09-28T17-47-35Z-lint-8dc4.log) |  |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 18 с | 3f87ad5 +1 | [лог](logs/2026-09-28T17-47-36Z-lint-c2d6.log) |  |
| 28.09.2026 22:47 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 22 с | 1fbbb0e | [лог](logs/2026-09-28T17-47-40Z-unit-cb07.log) | PR #123 после слияния main e0ac75fb |
| 28.09.2026 22:47 | unit (частично: packages/domain/src/availability apps/api/src/reservations/stay-offers.test.ts apps/api/src/auth/route-access.test.ts tests/unit/design-slop.tes | ✅ 31 из 31 | 8 с | 1caae4a +50 | [лог](logs/2026-09-28T17-47-47Z-unit-42d8.log) | AV2 после слияния main (сброс платформы) |
| 28.09.2026 22:47 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 34 с | 573f0bb | [лог](logs/2026-09-28T17-47-50Z-unit-298b.log) |  |
| 28.09.2026 22:47 | unit | ✅ 2154 из 2157, пропущено 3 | 1 мин 24 с | 3f87ad5 +1 | [лог](logs/2026-09-28T17-47-58Z-unit-c781.log) |  |
| 28.09.2026 22:48 | typecheck | ✅ без ошибок | 28 с | cca172c | [лог](logs/2026-09-28T17-48-16Z-typecheck-081e.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), миграция 032 |
| 28.09.2026 22:48 | typecheck | ✅ без ошибок | 30 с | e0ac75f | [лог](logs/2026-09-28T17-48-22Z-typecheck-6ec2.log) | release e0ac75fb verification |
| 28.09.2026 22:48 | lint | ✅ без ошибок | 16 с | cca172c | [лог](logs/2026-09-28T17-48-45Z-lint-b27f.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), миграция 032 |
| 28.09.2026 22:48 | lint | ✅ без ошибок | 17 с | e0ac75f | [лог](logs/2026-09-28T17-48-52Z-lint-d614.log) | release e0ac75fb verification |
| 28.09.2026 22:48 | integration | ✅ 110 из 110 | 36 с | 8d41be6 | [лог](logs/2026-09-28T17-48-52Z-integration-7846.log) |  |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-blocks.spec.ts tests/ui/chessboard-card.spec.ts tests/ui/chessboard-design.spec.ts tes | ✅ 46 из 46 | 6 мин 52 с | 44e4e57 +50 | [лог](logs/2026-09-28T17-49-00Z-e2e-18a6.log) | merged tree: chessboard UI specs (PR1-4) |
| 28.09.2026 22:49 | unit | ✅ 2141 из 2144, пропущено 3 | 1 мин 36 с | cca172c | [лог](logs/2026-09-28T17-49-06Z-unit-65b3.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118) |
| 28.09.2026 22:49 | unit | ❌ упало 2 из 2143, пропущено 3 | 1 мин 36 с | e0ac75f | [лог](logs/2026-09-28T17-49-10Z-unit-d242.log) | release e0ac75fb verification |
| 28.09.2026 22:49 | integration | ✅ 111 из 111 | 32 с | 1fbbb0e | [лог](logs/2026-09-28T17-49-13Z-integration-58b4.log) | PR #123 после слияния main e0ac75fb; с базой стенда |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | 3f87ad5 +1 | [лог](logs/2026-09-28T17-49-29Z-e2e-ddbb.log) | (ошибка вне тестов) |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | 573f0bb | [лог](logs/2026-09-28T17-49-34Z-e2e-156b.log) | (ошибка вне тестов) |
| 28.09.2026 22:49 | e2e | ❌ упало 2 из 25 | 4 мин 47 с | 8d41be6 | [лог](logs/2026-09-28T17-49-49Z-e2e-caa0.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:24 tests/ui/workspace.spec.ts:1038 tests/ui/channex-screens.spec.ts tests/ui/in | ❌ код выхода 1 | 2 мин 2 с | 1fbbb0e | [лог](logs/2026-09-28T17-49-52Z-e2e-d9de.log) | PR #123 после слияния main e0ac75fb: 8 бывших красных (на 1b187fa5) и спеки финансов |
| 28.09.2026 22:50 | integration | ✅ 113 из 113 | 32 с | cca172c | [лог](logs/2026-09-28T17-50-52Z-integration-6b60.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), свежая локальная база |
| 28.09.2026 22:51 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 17 с | e0ac75f | [лог](logs/2026-09-28T17-51-03Z-unit-4564.log) | release e0ac75fb verification (named branch) |
| 28.09.2026 22:51 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 519 из 519 | 45 мин 7 с | f6f30c0 | [лог](logs/2026-09-28T17-51-44Z-e2e-0876.log) |  |
| 28.09.2026 22:52 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 37 мин 56 с | 573f0bb | [лог](logs/2026-09-28T17-52-10Z-e2e-7e2d.log) |  |
| 28.09.2026 22:52 | unit (частично: apps/web/src/lib/booking-link.test.ts) | ❌ код выхода 1 | 1 с | c4d62c8 +1 | [лог](logs/2026-09-28T17-52-16Z-unit-3519.log) | AV3 red: разбора ссылки в форму брони ещё нет |
| 28.09.2026 22:52 | integration | ✅ 110 из 110 | 33 с | e0ac75f | [лог](logs/2026-09-28T17-52-34Z-integration-cbc4.log) | release e0ac75fb verification |
| 28.09.2026 22:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:24 tests/ui/workspace.spec.ts:1038 tests/ui/channex-screens.spec.ts tests/ui/in | ❌ код выхода 1 | 1 с | 1fbbb0e | [лог](logs/2026-09-28T17-52-38Z-e2e-a8c4.log) | PR #123 после слияния main e0ac75fb: 8 бывших красных (на 1b187fa5) и спеки финансов; повтор — первый прогон не дождался холодного dev-сервера |
| 28.09.2026 22:52 | unit (частично: apps/web/src/lib/booking-link.test.ts) | ✅ 5 из 5 | 1 с | c4d62c8 +2 | [лог](logs/2026-09-28T17-52-44Z-unit-2e61.log) | AV3 green: разбор и сборка ссылки в форму брони |
| 28.09.2026 22:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:24 tests/ui/workspace.spec.ts:1038 tests/ui/channex-screens.spec.ts tests/ui/in | ✅ 66 из 66 | 4 мин 31 с | 1fbbb0e | [лог](logs/2026-09-28T17-52-54Z-e2e-3a91.log) | PR #123 после слияния main e0ac75fb: 8 бывших красных (на 1b187fa5) и спеки финансов |
| 28.09.2026 22:52 | unit (частично: apps/web/src/app/reservations/actions.test.ts) | ❌ упало 1 из 6 | 1 с | c4d62c8 +3 | [лог](logs/2026-09-28T17-52-56Z-unit-a0ab.log) | AV3 red: «Автоматически» ещё не переводится в autoAssign |
| 28.09.2026 22:53 | unit (частично: apps/web/src/app/reservations/actions.test.ts) | ✅ 6 из 6 | 1 с | c4d62c8 +4 | [лог](logs/2026-09-28T17-53-06Z-unit-1e33.log) | AV3 green: «Автоматически» → autoAssign |
| 28.09.2026 22:53 | e2e | ❌ упало 2 из 25 | 4 мин 44 с | e0ac75f | [лог](logs/2026-09-28T17-53-13Z-e2e-1c89.log) | release e0ac75fb verification |
| 28.09.2026 22:55 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 12 с | e0ac75f | [лог](logs/2026-09-28T17-55-56Z-e2e-f712.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 22:56 | e2e | ❌ упало 2 из 25 | 4 мин 42 с | cca172c | [лог](logs/2026-09-28T17-56-12Z-e2e-9bda.log) | cleanup P1: слитое дерево с main e0ac75f (ADR-118), свежая сборка web |
| 28.09.2026 22:56 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts --grep AV3 --workers=1) | ❌ упало 1 из 1 | 2 мин 52 с | c4d62c8 +5 | [лог](logs/2026-09-28T17-56-56Z-e2e-e03d.log) | AV3 red: на прежнем экране нет списка мест и «Выбрать автоматически» |
| 28.09.2026 22:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 516 из 516 | 39 мин 1 с | 1fbbb0e | [лог](logs/2026-09-28T17-57-33Z-e2e-3075.log) | PR #123 после слияния main e0ac75fb: полный UI-набор в один поток |
| 28.09.2026 22:59 | e2e | ❌ упало 2 из 25 | 1 мин 11 с | e0ac75f | [лог](logs/2026-09-28T17-59-19Z-e2e-7b79.log) | seed laundry code = name; release e0ac75fb |
| 28.09.2026 22:59 | unit (частично: apps/web/src/app/chessboard/range-plan.test.ts) | ❌ код выхода 1 | 1 с | 17fda46 +5 | [лог](logs/2026-09-28T17-59-55Z-unit-ca47.log) | RED PR5: selectRange/freeMenuModel not yet implemented |
| 28.09.2026 23:00 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts tests/ui/availability-gate.spec.ts tests/ui/workspace.spec.ts tests/ui/cha | ❌ упало 1 из 137 | 11 мин 38 с | c4d62c8 +10 | [лог](logs/2026-09-28T18-00-02Z-e2e-1870.log) | AV3 green: список мест, автовыбор, заполненная форма брони; спеки, задетые формой |
| 28.09.2026 23:00 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-range.spec.ts tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts tests | ❌ упало 6 из 6 | 2 мин 53 с | 17fda46 +11 | [лог](logs/2026-09-28T18-00-04Z-e2e-dc2c.log) | RED PR5: range selection, free-cell menu, adapted free-cell paths — on current code |
| 28.09.2026 23:00 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 520 | 47 мин 38 с | 8d41be6 | [лог](logs/2026-09-28T18-00-15Z-e2e-beb0.log) | 10. заголовок страницы и панели брони — по шкале §6 |
| 28.09.2026 23:01 | e2e | ✅ 25 из 25 | 1 мин 1 с | e0ac75f | [лог](logs/2026-09-28T18-01-05Z-e2e-2018.log) | seed laundry: code = name, 500 ₸; release e0ac75fb |
| 28.09.2026 23:01 | e2e | ❌ упало 2 из 26 | 4 мин 43 с | cca172c | [лог](logs/2026-09-28T18-01-36Z-e2e-865b.log) | cleanup P1: слитое дерево (ADR-118), E2E_AUTH=1, API ролью wetop_app |
| 28.09.2026 23:02 | typecheck | ✅ без ошибок | 20 с | e0ac75f +1 | [лог](logs/2026-09-28T18-02-19Z-typecheck-41cd.log) | seed laundry fix |
| 28.09.2026 23:02 | lint | ✅ без ошибок | 16 с | e0ac75f +1 | [лог](logs/2026-09-28T18-02-40Z-lint-db8d.log) | seed laundry fix |
| 28.09.2026 23:02 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 16 с | e0ac75f +1 | [лог](logs/2026-09-28T18-02-57Z-unit-758e.log) | seed laundry fix |
| 28.09.2026 23:03 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-week.spec.ts -g создание на воскресенье --workers=1) | ❌ упало 1 из 1 | 51 с | 17fda46 +11 | [лог](logs/2026-09-28T18-03-09Z-e2e-3d40.log) | RED PR5: week free-cell path via free menu — on current code |
| 28.09.2026 23:05 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 мин 2 с | b27de05 | [лог](logs/2026-09-28T18-05-38Z-e2e-3206.log) | full UI on release e0ac75fb + seed fix |
| 28.09.2026 23:06 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 9 с | e0ac75f | [лог](logs/2026-09-28T18-06-31Z-e2e-0e49.log) | контроль: чистый main e0ac75f — finance и full-day без правки cleanup |
| 28.09.2026 23:06 | unit (частично: apps/web/src/app/chessboard/range-plan.test.ts apps/web/src/app/chessboard/drag-plan.test.ts apps/web/src/app/chessboard/extend-plan.test.ts tes | ✅ 56 из 56 | 1 с | 17fda46 +11 | [лог](logs/2026-09-28T18-06-45Z-unit-99d1.log) | GREEN PR5: range-plan + design guards |
| 28.09.2026 23:06 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-range.spec.ts tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts tests | ✅ 7 из 7 | 37 с | 17fda46 +17 | [лог](logs/2026-09-28T18-06-53Z-e2e-148d.log) | GREEN PR5 attempt 1: range selection, free menu, adapted paths |
| 28.09.2026 23:07 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-gate-pr5.spec.ts --workers=1) | ✅ 2 из 2 | 25 с | 17fda46 +18 | [лог](logs/2026-09-28T18-07-57Z-e2e-ad33.log) | PR5 gate screenshots (light/dark) |
| 28.09.2026 23:08 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 516 | 41 мин 48 с | 1d58d9a | [лог](logs/2026-09-28T18-08-55Z-e2e-4673.log) | full UI on release e0ac75fb + seed fix (retry after cold-start timeout) |
| 28.09.2026 23:09 | typecheck | ✅ без ошибок | 29 с | 17fda46 +18 | [лог](logs/2026-09-28T18-09-12Z-typecheck-70dc.log) | PR5 final code |
| 28.09.2026 23:09 | lint | ✅ без ошибок | 15 с | 17fda46 +18 | [лог](logs/2026-09-28T18-09-42Z-lint-e3d0.log) | PR5 final code |
| 28.09.2026 23:09 | unit | ✅ 2164 из 2167, пропущено 3 | 1 мин 13 с | 17fda46 +11 | [лог](logs/2026-09-28T18-09-57Z-unit-7513.log) | PR5 final code |
| 28.09.2026 23:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 529 из 529 | 40 мин 24 с | 17fda46 +18 | [лог](logs/2026-09-28T18-11-16Z-e2e-9163.log) | PR5 final code: full UI suite (merged tree) |
| 28.09.2026 23:12 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --grep новая бронь: резюме выбора --workers=1) | ✅ 1 из 1 | 9 с | 908b109 +1 | [лог](logs/2026-09-28T18-12-08Z-e2e-d49c.log) | AV3: спек резюме брони берёт первую настоящую ячейку, а не второй пункт списка |
| 28.09.2026 23:12 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/availability-gate.spec.ts --workers=1) | ✅ 2 из 2 | 17 с | 908b109 +2 | [лог](logs/2026-09-28T18-12-39Z-e2e-989b.log) | AV3: витрина light/dark, форма брони — страницей |
| 28.09.2026 23:13 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/availability-gate.spec.ts --workers=1) | ✅ 2 из 2 | 18 с | 908b109 +2 | [лог](logs/2026-09-28T18-13-21Z-e2e-2be6.log) | AV3: витрина, телефон — снимок от начала страницы |
| 28.09.2026 23:14 | unit | ✅ 2159 из 2162, пропущено 3 | 1 мин 24 с | 908b109 | [лог](logs/2026-09-28T18-14-13Z-unit-3a2a.log) | AV3: полный unit на ветке (слит main со сбросом платформы) |
| 28.09.2026 23:31 | e2e | ❌ упало 2 из 25 | 4 мин 37 с | d3a7f75 | [лог](logs/2026-09-28T18-31-29Z-e2e-a51e.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:36 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 8 с | d3a7f75 | [лог](logs/2026-09-28T18-36-35Z-e2e-e314.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:37 | e2e | ✅ 25 из 25 | 1 мин 1 с | ad89090 | [лог](logs/2026-09-28T18-37-18Z-e2e-a12e.log) | PR #123 после слияния main e0ac75fb: живые e2e с базой стенда |
| 28.09.2026 23:39 | unit (частично: apps/web/src/lib/website.test.ts apps/web/src/app/website/actions.test.ts) | ❌ упало 3 из 39 | 2 с | c39c55e +2 | [лог](logs/2026-09-28T18-39-06Z-unit-4fbd.log) | состояние сайта на обзоре бронирование: включено с тарифом, выключено, без тарифа |
| 28.09.2026 23:39 | unit (частично: apps/web/src/lib/website.test.ts apps/web/src/app/website/actions.test.ts) | ✅ 39 из 39 | 2 с | c39c55e +4 | [лог](logs/2026-09-28T18-39-21Z-unit-98fc.log) |  |
| 28.09.2026 23:41 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 8 с | e0ac75f | [лог](logs/2026-09-28T18-41-14Z-e2e-9fd1.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:42 | typecheck | ✅ без ошибок | 23 с | c39c55e +11 | [лог](logs/2026-09-28T18-42-35Z-typecheck-e947.log) |  |
| 28.09.2026 23:42 | lint | ✅ без ошибок | 17 с | c39c55e +11 | [лог](logs/2026-09-28T18-42-58Z-lint-4e6d.log) |  |
| 28.09.2026 23:43 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/website.spec.ts -g WEB3 ·) | ❌ упало 4 из 4 | 1 мин 48 с | c39c55e +7 | [лог](logs/2026-09-28T18-43-24Z-e2e-188a.log) | WEB3 · бронирование: состояние, демо только у работающего, что увидит гость |
| 28.09.2026 23:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/website.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spec.ts tests/ui/settings | ✅ 107 из 107 | 12 мин 38 с | c39c55e +11 | [лог](logs/2026-09-28T18-45-18Z-e2e-f73c.log) |  |
| 28.09.2026 23:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 523 | 37 мин 30 с | efdd9b1 | [лог](logs/2026-09-28T18-46-59Z-e2e-2ddd.log) | доступность переносит даты и свободное место в создание брони; неверный период виден |
| 28.09.2026 23:48 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/dashboard-desk.spec.ts) | ✅ 10 из 10 | 48 с | 8d41be6 | [лог](logs/2026-09-28T18-48-12Z-e2e-1ada.log) |  |
| 28.09.2026 23:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/inventory-catalog.spec.ts -g Escape возвращает фонд с фильтрами) | ❌ упало 1 из 1 | 27 с | 8d41be6 +1 | [лог](logs/2026-09-28T18-49-56Z-e2e-5537.log) | панель места: факты, сейчас и следующее, уборка из панели; Escape возвращает фонд с фильтрами |
| 28.09.2026 23:50 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/inventory-catalog.spec.ts -g Escape возвращает фонд с фильтрами) | ✅ 1 из 1 | 13 с | 8d41be6 | [лог](logs/2026-09-28T18-50-28Z-e2e-b677.log) |  |
| 28.09.2026 23:50 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/manager-actions.spec.ts --workers=1 --repeat-each=3 --grep отмена, незаезд) | ✅ 3 из 3 | 34 с | 6d878c9 | [лог](logs/2026-09-28T18-50-57Z-e2e-b8da.log) | repro no-show tab race before fix |
| 28.09.2026 23:51 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/manager-actions.spec.ts --workers=1 --grep отмена, незаезд) | ✅ 1 из 1 | 29 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-51-47Z-e2e-b525.log) | repro: 2 s server action delay, before fix |
| 28.09.2026 23:52 | e2e | ❌ упало 5 из 25, пропущено 2 | 5 мин 39 с | 17fda46 +18 | [лог](logs/2026-09-28T18-52-04Z-e2e-2f7f.log) | PR5 final code: full e2e on local PostgreSQL (merged tree) |
| 28.09.2026 23:53 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/manager-actions.spec.ts --workers=1 --repeat-each=5) | ✅ 45 из 45 | 2 мин 54 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-53-49Z-e2e-f24c.log) | no-show step waits for the action before switching tab |
| 28.09.2026 23:56 | typecheck | ✅ без ошибок | 31 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-56-50Z-typecheck-7ed7.log) | manager-actions wait |
| 28.09.2026 23:57 | lint | ✅ без ошибок | 16 с | 6d878c9 +1 | [лог](logs/2026-09-28T18-57-21Z-lint-3a92.log) | manager-actions wait |
| 28.09.2026 23:58 | e2e (частично: tests/e2e/desk-day.spec.ts tests/e2e/check-in-out.spec.ts tests/e2e/web-analytics.spec.ts tests/e2e/full-day.spec.ts tests/e2e/web-booking.spec.t | ❌ упало 5 из 9, пропущено 2 | 5 мин 15 с | 17fda46 +18 | [лог](logs/2026-09-28T18-58-37Z-e2e-b778.log) | BASE CHECK: same 5 live e2e specs with app code = origin/main (PR4/PR5 app files swapped to main versions) |
| 29.09.2026 00:10 | typecheck | ✅ без ошибок | 31 с | 2b09e78 | [лог](logs/2026-09-28T19-10-00Z-typecheck-f177.log) | RT2 после слияния main (e0ac75fb) |
| 29.09.2026 00:10 | e2e | ✅ 25 из 25 | 1 мин 2 с | 8d276c7 | [лог](logs/2026-09-28T19-10-22Z-e2e-a6b5.log) | PR #135 head |
| 29.09.2026 00:10 | lint | ✅ без ошибок | 18 с | 2b09e78 | [лог](logs/2026-09-28T19-10-31Z-lint-3a6a.log) | RT2 после слияния main (e0ac75fb) |
| 29.09.2026 00:10 | unit | ❌ упало 1 из 2151, пропущено 3 | 1 мин 28 с | 2b09e78 | [лог](logs/2026-09-28T19-10-49Z-unit-d3a4.log) | RT2 после слияния main (e0ac75fb) |
| 29.09.2026 00:12 | unit (частично: apps/web/src/lib/hotel-time.test.ts) | ✅ 3 из 3 | 2 с | 2b09e78 | [лог](logs/2026-09-28T19-12-44Z-unit-1c1f.log) | hotel-time отдельно: упал в полном unit после слияния main |
| 29.09.2026 00:12 | unit | ✅ 2148 из 2151, пропущено 3 | 1 мин 16 с | 2b09e78 | [лог](logs/2026-09-28T19-12-53Z-unit-c92a.log) | RT2 после слияния main: повтор полного unit (hotel-time упал под нагрузкой, отдельно 3/3) |
| 29.09.2026 00:14 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/rates-range.spec.ts tests/ui/rates-design.spec.ts tests/ui/workspace.spec.ts tests/ui/channex-scr | ❌ упало 1 из 87 | 5 мин 42 с | 2b09e78 | [лог](logs/2026-09-28T19-14-20Z-e2e-5c79.log) | RT2 после слияния main: спеки тарифов, workspace, каналы |
| 29.09.2026 00:20 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:159 --workers=1) | ❌ упало 1 из 1 | 23 с | 2b09e78 | [лог](logs/2026-09-28T19-20-16Z-e2e-8c14.log) | workspace:159 отдельно на слитом дереве RT2 |
| 29.09.2026 00:20 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:159 --workers=1) | ❌ упало 1 из 1 | 26 с | e0ac75f | [лог](logs/2026-09-28T19-20-47Z-e2e-4abb.log) | сверка: workspace:159 на чистом main e0ac75fb (без RT2) |
| 29.09.2026 00:21 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts --workers=1) | ❌ упало 2 из 4 | 35 с | a3e30d0 +1 | [лог](logs/2026-09-28T19-21-18Z-e2e-4865.log) | record-tabs: red before fix |
| 29.09.2026 00:22 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts --workers=1) | ❌ упало 2 из 4 | 33 с | a3e30d0 +1 | [лог](logs/2026-09-28T19-22-03Z-e2e-567f.log) | record-tabs: before fix, heading scoped to main |
| 29.09.2026 00:23 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts --workers=1) | ❌ упало 1 из 4 | 33 с | a3e30d0 +1 | [лог](logs/2026-09-28T19-23-30Z-e2e-81a3.log) | record-tabs: before fix (drawer-scoped) |
| 29.09.2026 00:24 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts --workers=1 --repeat-each=3) | ✅ 12 из 12 | 36 с | a3e30d0 +2 | [лог](logs/2026-09-28T19-24-29Z-e2e-10b3.log) | record-tabs: after fix (sync on mount, hashchange, tab set) |
| 29.09.2026 00:25 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts:159) | ❌ упало 1 из 1 | 23 с | e0ac75f | [лог](logs/2026-09-28T19-25-10Z-e2e-d9d7.log) | доступность переносит даты и свободное место в создание брони; неверный период виден |
| 29.09.2026 00:25 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts tests/ui/manager-actions.spec.ts tests/ui/workspace.spec.ts tests/ui/guest-wi | ❌ упало 15 из 136 | 14 мин 28 с | a3e30d0 +2 | [лог](logs/2026-09-28T19-25-43Z-e2e-2050.log) | RecordTabs fix: tabs, card, guest, profile, design-system specs |
| 29.09.2026 00:26 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/today-operations.spec.ts) | ✅ 7 из 7 | 24 с | cf025ff +1 | [лог](logs/2026-09-28T19-26-02Z-e2e-67b8.log) |  |
| 29.09.2026 00:32 | typecheck | ✅ без ошибок | 22 с | 348345c | [лог](logs/2026-09-28T19-32-28Z-typecheck-9cf4.log) |  |
| 29.09.2026 00:32 | lint | ✅ без ошибок | 17 с | 348345c | [лог](logs/2026-09-28T19-32-51Z-lint-0ba3.log) |  |
| 29.09.2026 00:33 | unit | ✅ 2146 из 2149, пропущено 3 | 1 мин 24 с | 348345c | [лог](logs/2026-09-28T19-33-09Z-unit-e32b.log) |  |
| 29.09.2026 00:33 | typecheck | ✅ без ошибок | 21 с | 7df44f9 | [лог](logs/2026-09-28T19-33-28Z-typecheck-1e9b.log) | RT2 после слияния main 4f5bc769 (#109, #132) |
| 29.09.2026 00:33 | unit | ✅ 2160 из 2163, пропущено 3 | 1 мин 19 с | 1988d23 +14 | [лог](logs/2026-09-28T19-33-30Z-unit-0871.log) | AV2–AV3 перед вливанием в main: слитое дерево с Platform P1 cleanup (PR #132) |
| 29.09.2026 00:33 | lint | ✅ без ошибок | 16 с | 7df44f9 | [лог](logs/2026-09-28T19-33-50Z-lint-9594.log) | RT2 после слияния main 4f5bc769 (#109, #132) |
| 29.09.2026 00:34 | unit | ✅ 2149 из 2152, пропущено 3 | 1 мин 16 с | 7df44f9 | [лог](logs/2026-09-28T19-34-13Z-unit-244e.log) | RT2 после слияния main 4f5bc769 (#109, #132) |
| 29.09.2026 00:34 | integration | ✅ 113 из 113 | 35 с | 348345c | [лог](logs/2026-09-28T19-34-47Z-integration-f4d9.log) |  |
| 29.09.2026 00:34 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts tests/ui/availability-gate.spec.ts tests/ui/channel-booking-number.spec.ts | ❌ упало 1 из 61 | 2 мин 44 с | 1988d23 +12 | [лог](logs/2026-09-28T19-34-50Z-e2e-aa14.log) | AV2–AV3 перед вливанием в main: фонд, витрина, формы брони, бюджет запросов, пустая база |
| 29.09.2026 00:35 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/rates-range.spec.ts tests/ui/rates-design.spec.ts --workers=1) | ✅ 11 из 11 | 33 с | 7df44f9 | [лог](logs/2026-09-28T19-35-30Z-e2e-9c8a.log) | RT2 после слияния main 4f5bc769: спеки тарифов |
| 29.09.2026 00:35 | typecheck | ✅ без ошибок | 25 с | a8b286b | [лог](logs/2026-09-28T19-35-32Z-typecheck-4e47.log) |  |
| 29.09.2026 00:35 | e2e | ❌ упало 2 из 25 | 4 мин 46 с | 348345c | [лог](logs/2026-09-28T19-35-35Z-e2e-5acd.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 29.09.2026 00:35 | lint | ✅ без ошибок | 13 с | a8b286b | [лог](logs/2026-09-28T19-35-58Z-lint-3374.log) |  |
| 29.09.2026 00:36 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/today-operations.spec.ts tests/ui/requests.spec.ts tests/ui/loading-performance.spec. | ✅ 57 из 57 | 2 мин 9 с | a8b286b | [лог](logs/2026-09-28T19-36-17Z-e2e-1cd8.log) |  |
| 29.09.2026 00:37 | typecheck | ✅ без ошибок | 20 с | 321a58b | [лог](logs/2026-09-28T19-37-16Z-typecheck-78e3.log) | main + #123 (через ветку PR #132) |
| 29.09.2026 00:37 | lint | ✅ без ошибок | 16 с | 321a58b | [лог](logs/2026-09-28T19-37-37Z-lint-a0fc.log) | main + #123 (через ветку PR #132) |
| 29.09.2026 00:37 | unit | ✅ 2141 из 2144, пропущено 3 | 1 мин 34 с | 321a58b | [лог](logs/2026-09-28T19-37-54Z-unit-f820.log) | main + #123 |
| 29.09.2026 00:38 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts tests/ui/availability-gate.spec.ts --workers=1) | ✅ 8 из 8 | 58 с | 1988d23 +13 | [лог](logs/2026-09-28T19-38-10Z-e2e-ca11.log) | AV3: спек выбирает свободный номер по состоянию стенда, а не R01 (дата прогона сдвигает проживание фикстуры) |
| 29.09.2026 00:39 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --grep доступность переносит даты --workers=1) | ✅ 1 из 1 | 10 с | 1988d23 +14 | [лог](logs/2026-09-28T19-39-22Z-e2e-ebe2.log) | workspace: доступность → бронь не ждёт R01 (стенд вокруг сегодня) |
| 29.09.2026 00:39 | integration | ✅ 114 из 114 | 33 с | 321a58b | [лог](logs/2026-09-28T19-39-29Z-integration-5466.log) | main + #123 |
| 29.09.2026 00:40 | e2e | ✅ 25 из 25 | 1 мин 5 с | 321a58b | [лог](logs/2026-09-28T19-40-33Z-e2e-e150.log) | main + #123: живой e2e на свежей сборке web |
| 29.09.2026 00:40 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-card.spec.ts tests/ui/record-tabs.spec.ts --workers=1) | ✅ 11 из 11 | 43 с | a3e30d0 +2 | [лог](logs/2026-09-28T19-40-45Z-e2e-5205.log) | drawer check with fix |
| 29.09.2026 00:41 | unit | ✅ 2168 из 2171, пропущено 3 | 1 мин 16 с | 79a0bd4 +9 | [лог](logs/2026-09-28T19-41-07Z-unit-19d1.log) | AV2–AV3 перед вливанием: слитое дерево с #109 и #134 (RT2) |
| 29.09.2026 00:41 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ✅ 3 из 3 | 14 с | 4de2d98 | [лог](logs/2026-09-28T19-41-12Z-e2e-c5d2.log) |  |
| 29.09.2026 00:41 | e2e | ✅ 25 из 25 | 55 с | 4de2d98 | [лог](logs/2026-09-28T19-41-32Z-e2e-1cc5.log) |  |
| 29.09.2026 00:42 | typecheck | ✅ без ошибок | 31 с | a3e30d0 +2 | [лог](logs/2026-09-28T19-42-03Z-typecheck-3b0e.log) | RecordTabs fix |
| 29.09.2026 00:42 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts tests/ui/channel-booking-number.spec.ts tests/ui/requests.spec.ts --worker | ✅ 35 из 35 | 1 мин 25 с | 79a0bd4 +9 | [лог](logs/2026-09-28T19-42-24Z-e2e-23e3.log) | AV2–AV3 перед вливанием: фонд, форма брони, бюджет запросов на дереве с RT2 |
| 29.09.2026 00:42 | lint | ✅ без ошибок | 17 с | a3e30d0 +2 | [лог](logs/2026-09-28T19-42-34Z-lint-2c62.log) | RecordTabs fix |
| 29.09.2026 00:42 | typecheck | ✅ без ошибок | 22 с | 01c0429 | [лог](logs/2026-09-28T19-42-36Z-typecheck-4863.log) | main 4de2d985 + #123 |
| 29.09.2026 00:42 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 16 с | a3e30d0 +1 | [лог](logs/2026-09-28T19-42-51Z-unit-67cd.log) | RecordTabs fix |
| 29.09.2026 00:42 | lint | ✅ без ошибок | 16 с | 01c0429 | [лог](logs/2026-09-28T19-42-59Z-lint-f95a.log) | main 4de2d985 + #123 |
| 29.09.2026 00:43 | unit | ✅ 2149 из 2152, пропущено 3 | 1 мин 34 с | 01c0429 | [лог](logs/2026-09-28T19-43-15Z-unit-0377.log) | main 4de2d985 + #123 |
| 29.09.2026 00:44 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts tests/ui/manager-actions.spec.ts tests/ui/workspace.spec.ts tests/ui/guest-wi | ❌ упало 1 из 136 | 11 мин 16 с | a3e30d0 +2 | [лог](logs/2026-09-28T19-44-16Z-e2e-ad61.log) | RecordTabs fix: affected specs, second run |
| 29.09.2026 00:44 | integration | ✅ 114 из 114 | 32 с | 01c0429 | [лог](logs/2026-09-28T19-44-50Z-integration-d8fd.log) | main 4de2d985 + #123 |
| 29.09.2026 00:46 | typecheck | ✅ без ошибок | 28 с | a553ee0 | [лог](logs/2026-09-28T19-46-18Z-typecheck-650c.log) | main 698ae492 + #123 |
| 29.09.2026 00:46 | unit | ✅ 2168 из 2171, пропущено 3 | 1 мин 34 с | a553ee0 | [лог](logs/2026-09-28T19-46-46Z-unit-9efd.log) | main 698ae492 + #123 |
| 29.09.2026 00:56 | typecheck | ✅ без ошибок | 30 с | 6d7d532 | [лог](logs/2026-09-28T19-56-42Z-typecheck-8c40.log) | PR #135 merged with main e1adee87 |
| 29.09.2026 00:57 | lint | ✅ без ошибок | 17 с | 6d7d532 | [лог](logs/2026-09-28T19-57-12Z-lint-ec08.log) | PR #135 merged with main e1adee87 |
| 29.09.2026 00:57 | unit | ✅ 2168 из 2171, пропущено 3 | 1 мин 17 с | 6d7d532 | [лог](logs/2026-09-28T19-57-30Z-unit-68ff.log) | PR #135 merged with main e1adee87 |
| 29.09.2026 00:58 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/record-tabs.spec.ts tests/ui/manager-actions.spec.ts tests/ui/chessboard-card.spec.ts --workers=1 | ✅ 20 из 20 | 1 мин 19 с | 6d7d532 | [лог](logs/2026-09-28T19-58-56Z-e2e-3ea1.log) | PR #135 merged with main: card specs |
| 29.09.2026 01:00 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --grep доступность переносит даты --workers=1) | ✅ 1 из 1 | 13 с | 6d7d532 | [лог](logs/2026-09-28T20-00-16Z-e2e-fd0d.log) | PR #135 merged with main: workspace:159 |
| 29.09.2026 01:05 | typecheck | ✅ без ошибок | 33 с | c5b752a | [лог](logs/2026-09-28T20-05-58Z-typecheck-3186.log) | интеграция: main 9248116c + #101 #136 #131 #118 |
| 29.09.2026 01:06 | lint | ✅ без ошибок | 18 с | c5b752a | [лог](logs/2026-09-28T20-06-32Z-lint-8ad3.log) | интеграция: main 9248116c + #101 #136 #131 #118 |
| 29.09.2026 01:06 | unit | ❌ упало 1 из 2219, пропущено 3 | 1 мин 21 с | c5b752a | [лог](logs/2026-09-28T20-06-50Z-unit-075d.log) | интеграция: main 9248116c + #101 #136 #131 #118 |
| 29.09.2026 01:08 | unit (частично: tests/unit/design-slop.test.ts) | ✅ 11 из 11 | 1 с | c5b752a +1 | [лог](logs/2026-09-28T20-08-58Z-unit-1231.log) | интеграция: сторож дизайна после записи примера CSS виджета в снимок |
| 29.09.2026 01:09 | integration | ✅ 114 из 114 | 33 с | b1ca96f | [лог](logs/2026-09-28T20-09-22Z-integration-0423.log) | интеграция: main 9248116c + #101 #136 #131 #118 |
| 29.09.2026 01:10 | e2e | ❌ упало 7 из 25, пропущено 2 | 8 мин 28 с | b1ca96f | [лог](logs/2026-09-28T20-10-08Z-e2e-f1f5.log) | интеграция: живые e2e на локальной базе, main 9248116c + #101 #136 #131 #118 |
