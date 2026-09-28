# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 23:48 | typecheck | ✅ без ошибок | 33 с | 9774342 | [лог](logs/2026-09-28T18-48-59Z-typecheck-30f8.log) | R3 merged with main e0ac75fb |
| 28.09.2026 23:49 | lint | ✅ без ошибок | 19 с | 9774342 | [лог](logs/2026-09-28T18-49-33Z-lint-16ce.log) | R3 merged with main e0ac75fb |
| 28.09.2026 23:49 | unit | ✅ 2143 из 2146, пропущено 3 | 1 мин 25 с | 9774342 | [лог](logs/2026-09-28T18-49-55Z-unit-124c.log) | R3 merged with main e0ac75fb |
| 28.09.2026 23:51 | integration | ✅ 110 из 110 | 32 с | 9774342 | [лог](logs/2026-09-28T18-51-39Z-integration-7fbd.log) | R3 merged with main e0ac75fb |
| 28.09.2026 23:53 | e2e | ❌ упало 2 из 25 | 4 мин 42 с | 9774342 | [лог](logs/2026-09-28T18-53-01Z-e2e-1f97.log) | live e2e, R3 merged with main e0ac75fb |
| 28.09.2026 23:58 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts) | ❌ упало 2 из 3 | 4 мин 9 с | e0ac75f | [лог](logs/2026-09-28T18-58-34Z-e2e-01bb.log) | baseline: clean main e0ac75fb, the two reds of the R3 merge |
| 29.09.2026 00:03 | e2e | ✅ 25 из 25 | 59 с | 9774342 +1 | [лог](logs/2026-09-28T19-03-46Z-e2e-f65d.log) | live e2e, R3 merged with main e0ac75fb + ported #135 seed fix |
| 29.09.2026 00:50 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts:159) | ❌ упало 1 из 1 | 24 с | e0ac75f | [лог](logs/2026-09-28T19-50-00Z-e2e-b59b.log) | baseline: workspace:159 on clean main e0ac75fb |
| 29.09.2026 00:51 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/reservations-v2.spec.ts tests/ui/reservations-v2-r2.spec.ts tests/ui/reservations-v2- | ❌ упало 1 из 98 | 6 мин 40 с | 22c300b | [лог](logs/2026-09-28T19-51-18Z-e2e-260c.log) | UI reservations + manager-actions + workspace on R3 merged tree; full UI log 19-05-26Z-e2e-511d is 520/521, its journal line was lost on a branch switch |
