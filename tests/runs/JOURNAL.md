# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:57 | typecheck | ✅ без ошибок | 29 с | 1a66960 | [лог](logs/2026-09-28T17-57-00Z-typecheck-df39.log) |  |
| 28.09.2026 22:57 | lint | ✅ без ошибок | 17 с | 1a66960 | [лог](logs/2026-09-28T17-57-30Z-lint-ee6d.log) |  |
| 28.09.2026 22:57 | unit | ✅ 2145 из 2148, пропущено 3 | 1 мин 23 с | 1a66960 | [лог](logs/2026-09-28T17-57-47Z-unit-6625.log) |  |
| 28.09.2026 22:59 | integration | ✅ 111 из 111 | 32 с | 1a66960 | [лог](logs/2026-09-28T17-59-11Z-integration-48df.log) |  |
| 28.09.2026 22:59 | integration (частично: tests/integration/booking-existing-guest.test.ts) | ❌ упало 1 из 1 | 3 с | 1a66960 +1 | [лог](logs/2026-09-28T17-59-57Z-integration-6472.log) | бронь существующему гостю (integration, rolled back) вторая бронь по guestId — тот же гость, новых строк в guests нет; чужой гость — 404 |
| 28.09.2026 23:00 | integration (частично: tests/integration/booking-existing-guest.test.ts) | ✅ 1 из 1 | 3 с | 1a66960 | [лог](logs/2026-09-28T18-00-07Z-integration-de98.log) |  |
| 28.09.2026 23:00 | e2e | ❌ упало 2 из 25 | 4 мин 39 с | 1a66960 | [лог](logs/2026-09-28T18-00-42Z-e2e-f40a.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
| 28.09.2026 23:06 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 519 из 519 | 42 мин 10 с | b6c1e78 | [лог](logs/2026-09-28T18-06-06Z-e2e-64bc.log) |  |
| 28.09.2026 23:58 | unit (частично: apps/api/src/guests/guests.controller.test.ts apps/web/src/app/guests/filters.test.ts) | ❌ упало 1 из 14 | 3 с | bc75898 +3 | [лог](logs/2026-09-28T18-58-52Z-unit-a9af.log) | guests API directory G7: отборы визита, числа визитов, порядок и раздел NONE доходят до выборки |
| 28.09.2026 23:58 | integration (частично: tests/integration/guest-directory.test.ts) | ❌ упало 1 из 1 | 3 с | bc75898 +3 | [лог](logs/2026-09-28T18-58-56Z-integration-b76b.log) | справочник гостей: отборы визита, число визитов, порядок (integration) раздел NONE, последний визит, число визитов, сортировки и числа чипов с отборами |
| 28.09.2026 23:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/guests-design.spec.ts -g G7) | ❌ упало 1 из 1 | 24 с | bc75898 +4 | [лог](logs/2026-09-28T18-59-10Z-e2e-4b8c.log) | гости: отборы по визиту и числу визитов, порядок, всё в адресе (G7) |
| 28.09.2026 23:59 | unit (частично: apps/api/src/guests/guests.controller.test.ts apps/web/src/app/guests/filters.test.ts) | ✅ 19 из 19 | 3 с | bc75898 +11 | [лог](logs/2026-09-28T18-59-40Z-unit-3d6e.log) |  |
| 28.09.2026 23:59 | integration (частично: tests/integration/guest-directory.test.ts) | ✅ 1 из 1 | 3 с | bc75898 +6 | [лог](logs/2026-09-28T18-59-43Z-integration-8405.log) |  |
| 28.09.2026 23:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/guests-design.spec.ts -g G7) | ❌ упало 1 из 1 | 10 с | bc75898 +12 | [лог](logs/2026-09-28T18-59-50Z-e2e-d851.log) | гости: отборы по визиту и числу визитов, порядок, всё в адресе (G7) |
| 29.09.2026 00:00 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/guests-design.spec.ts -g G7) | ❌ упало 1 из 1 | 52 с | bc75898 +12 | [лог](logs/2026-09-28T19-00-09Z-e2e-a38d.log) | гости: отборы по визиту и числу визитов, порядок, всё в адресе (G7) |
| 29.09.2026 00:01 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/guests-design.spec.ts -g G7) | ❌ упало 1 из 1 | 25 с | bc75898 +12 | [лог](logs/2026-09-28T19-01-26Z-e2e-f254.log) | гости: отборы по визиту и числу визитов, порядок, всё в адресе (G7) |
| 29.09.2026 00:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/guests-design.spec.ts -g G7) | ❌ упало 1 из 1 | 28 с | bc75898 +12 | [лог](logs/2026-09-28T19-02-08Z-e2e-0bdd.log) | гости: отборы по визиту и числу визитов, порядок, всё в адресе (G7) |
| 29.09.2026 00:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/guests-design.spec.ts -g G7) | ✅ 1 из 1 | 15 с | bc75898 +12 | [лог](logs/2026-09-28T19-02-47Z-e2e-dbec.log) |  |
| 29.09.2026 00:03 | typecheck | ✅ без ошибок | 29 с | bc75898 +13 | [лог](logs/2026-09-28T19-03-08Z-typecheck-6910.log) |  |
| 29.09.2026 00:03 | lint | ✅ без ошибок | 17 с | bc75898 +13 | [лог](logs/2026-09-28T19-03-38Z-lint-4a52.log) |  |
| 29.09.2026 00:04 | unit | ✅ 2151 из 2154, пропущено 3 | 1 мин 16 с | bc75898 +11 | [лог](logs/2026-09-28T19-04-00Z-unit-cc6b.log) |  |
| 29.09.2026 00:05 | integration | ✅ 112 из 112 | 34 с | bc75898 +6 | [лог](logs/2026-09-28T19-05-16Z-integration-a55d.log) |  |
| 29.09.2026 00:06 | e2e | ❌ упало 2 из 25 | 4 мин 38 с | bc75898 +12 | [лог](logs/2026-09-28T19-06-10Z-e2e-7fb2.log) | счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс |
