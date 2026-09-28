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
