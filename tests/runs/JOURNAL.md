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
| 28.09.2026 22:46 | typecheck | ✅ без ошибок | 33 с | 1fbbb0e | [лог](logs/2026-09-28T17-46-46Z-typecheck-0cb3.log) | PR #123 после слияния main e0ac75fb (сброс платформы, швы интеграции) |
| 28.09.2026 22:47 | lint | ✅ без ошибок | 19 с | 1fbbb0e | [лог](logs/2026-09-28T17-47-20Z-lint-b945.log) | PR #123 после слияния main e0ac75fb |
| 28.09.2026 22:47 | unit | ✅ 2140 из 2143, пропущено 3 | 1 мин 22 с | 1fbbb0e | [лог](logs/2026-09-28T17-47-40Z-unit-cb07.log) | PR #123 после слияния main e0ac75fb |
| 28.09.2026 22:49 | integration | ✅ 111 из 111 | 32 с | 1fbbb0e | [лог](logs/2026-09-28T17-49-13Z-integration-58b4.log) | PR #123 после слияния main e0ac75fb; с базой стенда |
| 28.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:24 tests/ui/workspace.spec.ts:1038 tests/ui/channex-screens.spec.ts tests/ui/in | ❌ код выхода 1 | 2 мин 2 с | 1fbbb0e | [лог](logs/2026-09-28T17-49-52Z-e2e-d9de.log) | PR #123 после слияния main e0ac75fb: 8 бывших красных (на 1b187fa5) и спеки финансов |
| 28.09.2026 22:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:24 tests/ui/workspace.spec.ts:1038 tests/ui/channex-screens.spec.ts tests/ui/in | ❌ код выхода 1 | 1 с | 1fbbb0e | [лог](logs/2026-09-28T17-52-38Z-e2e-a8c4.log) | PR #123 после слияния main e0ac75fb: 8 бывших красных (на 1b187fa5) и спеки финансов; повтор — первый прогон не дождался холодного dev-сервера |
| 28.09.2026 22:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts:24 tests/ui/workspace.spec.ts:1038 tests/ui/channex-screens.spec.ts tests/ui/in | ✅ 66 из 66 | 4 мин 31 с | 1fbbb0e | [лог](logs/2026-09-28T17-52-54Z-e2e-3a91.log) | PR #123 после слияния main e0ac75fb: 8 бывших красных (на 1b187fa5) и спеки финансов |
| 28.09.2026 22:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 516 из 516 | 39 мин 1 с | 1fbbb0e | [лог](logs/2026-09-28T17-57-33Z-e2e-3075.log) | PR #123 после слияния main e0ac75fb: полный UI-набор в один поток |
| 28.09.2026 23:37 | e2e | ✅ 25 из 25 | 1 мин 1 с | ad89090 | [лог](logs/2026-09-28T18-37-18Z-e2e-a12e.log) | PR #123 после слияния main e0ac75fb: живые e2e с базой стенда |
