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
