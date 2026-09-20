# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 13.09.2026 16:35 | unit | ✅ 462 из 462 | 3 с | 383bd04 +6 | [лог](logs/2026-09-13T11-35-46Z-unit-8803.log) | первая запись журнала |
| 13.09.2026 16:36 | lint | ✅ без ошибок | 7 с | 383bd04 +6 | [лог](logs/2026-09-13T11-36-01Z-lint-6f91.log) |  |
| 13.09.2026 16:36 | typecheck | ✅ без ошибок | 4 с | 143c419 +6 | [лог](logs/2026-09-13T11-36-12Z-typecheck-09da.log) |  |
| 13.09.2026 16:46 | unit (частично: packages/domain/src/incidents) | ❌ код выхода 1 | 1 с | 49199ea +4 | [лог](logs/2026-09-13T11-46-14Z-unit-80e7.log) | срез 11: красный до кода |
| 13.09.2026 16:47 | unit (частично: packages/domain/src/incidents) | ✅ 32 из 32 | 1 с | 49199ea +10 | [лог](logs/2026-09-13T11-47-57Z-unit-9f6c.log) | срез 11: домен неисправностей |
| 13.09.2026 16:51 | unit (частично: packages/integrations/src/telegram) | ❌ код выхода 1 | 1 с | 59f145e +11 | [лог](logs/2026-09-13T11-51-00Z-unit-ac73.log) | срез 11: адаптер Telegram, красный до кода |
| 13.09.2026 16:51 | unit (частично: packages/integrations/src/telegram) | ✅ 6 из 6 | 1 с | 59f145e +14 | [лог](logs/2026-09-13T11-51-27Z-unit-b1f3.log) | срез 11: адаптер Telegram |
| 13.09.2026 16:55 | unit (частично: apps/web/src/lib/channels-sync.test.ts) | ❌ упало 2 из 2 | 1 с | 1a51a81 +1 | [лог](logs/2026-09-13T11-55-10Z-unit-d3fb.log) | кнопка 500 дней слала 365: красный на старом коде |
| 13.09.2026 16:55 | unit (частично: apps/web/src/lib/channels-sync.test.ts) | ✅ 2 из 2 | 0 с | 1a51a81 +3 | [лог](logs/2026-09-13T11-55-11Z-unit-30cc.log) | кнопка 500 дней: зелёный после правки |
| 13.09.2026 16:55 | integration | ✅ 13 из 13 | 2 мин 51 с | 1a51a81 | [лог](logs/2026-09-13T11-55-10Z-integration-21b4.log) | первая запись набора в журнал |
| 13.09.2026 16:59 | unit (частично: apps/api/src/guard) | ❌ код выхода 1 | 1 с | e6bb41b +8 | [лог](logs/2026-09-13T11-59-00Z-unit-77c2.log) | срез 11: сторож в API, красный до кода |
| 13.09.2026 17:34 | unit | ✅ 502 из 502 | 7 с | 34883f7 | [лог](logs/2026-09-13T12-34-05Z-unit-2f52.log) |  |
| 13.09.2026 17:42 | typecheck | ❌ ошибок: 2 | 9 с | 34883f7 +8 | [лог](logs/2026-09-13T12-42-14Z-typecheck-4542.log) | TS2375 |
| 13.09.2026 17:43 | typecheck | ✅ без ошибок | 7 с | 34883f7 +9 | [лог](logs/2026-09-13T12-43-10Z-typecheck-d749.log) |  |
| 13.09.2026 17:46 | unit (частично: apps/web/src/app/chessboard/stay-labels.test.ts apps/web/src/app/reservations/actions.test.ts) | ❌ упало 3 из 3 | 1 с | 34883f7 +16 | [лог](logs/2026-09-13T12-46-28Z-unit-0baf.log) | (файл не выполнился) |
| 13.09.2026 17:47 | unit (частично: apps/web/src/app/chessboard/stay-labels.test.ts apps/web/src/app/reservations/actions.test.ts) | ✅ 6 из 6 | 1 с | 34883f7 +19 | [лог](logs/2026-09-13T12-47-58Z-unit-e140.log) |  |
| 13.09.2026 17:51 | typecheck | ✅ без ошибок | 9 с | 34883f7 +25 | [лог](logs/2026-09-13T12-51-42Z-typecheck-ce20.log) |  |
| 13.09.2026 17:51 | lint | ✅ без ошибок | 6 с | 34883f7 +25 | [лог](logs/2026-09-13T12-51-51Z-lint-5abd.log) |  |
| 13.09.2026 18:01 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 6 | 41 с | 34883f7 +26 | [лог](logs/2026-09-13T13-01-29Z-e2e-28f6.log) | Изолированный UI: Next.js и синтетический API, без БД и провайдеров |
| 13.09.2026 18:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 6 | 25 с | 34883f7 +25 | [лог](logs/2026-09-13T13-03-43Z-e2e-f6f3.log) | После исправления адаптивных колонок аналитики; API синтетический |
| 13.09.2026 18:05 | unit (частично: apps/web/src/app/reservations/actions.test.ts) | ❌ упало 1 из 4 | 1 с | 34883f7 +25 | [лог](logs/2026-09-13T13-05-16Z-unit-f3ca.log) | Red: группа из разных категорий |
| 13.09.2026 18:05 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep неверная дата) | ❌ упало 1 из 1 | 23 с | 34883f7 +25 | [лог](logs/2026-09-13T13-05-24Z-e2e-ea5b.log) | Red: некорректная дата в ссылке на создание |
| 13.09.2026 18:07 | unit (частично: apps/web/src/app/reservations/actions.test.ts) | ✅ 4 из 4 | 1 с | 34883f7 +26 | [лог](logs/2026-09-13T13-07-02Z-unit-6f38.log) | Green: все размещения группы передаются в существующий CreateReservationDto |
| 13.09.2026 18:08 | unit (частично: apps/web/src/app/reservations/[number]/finance-actions.test.ts) | ❌ упало 1 из 1 | 1 с | 34883f7 +27 | [лог](logs/2026-09-13T13-08-01Z-unit-2c52.log) | Red: существующее распределение платежа из формы группы |
| 13.09.2026 18:09 | unit (частично: apps/web/src/app/reservations/[number]/finance-actions.test.ts) | ✅ 1 из 1 | 1 с | 34883f7 +30 | [лог](logs/2026-09-13T13-09-01Z-unit-9127.log) | Green: группы платежей передают десятичные строки и сохраняют ошибочный ввод |
| 13.09.2026 18:10 | typecheck | ❌ ошибок: 2 | 9 с | 34883f7 +33 | [лог](logs/2026-09-13T13-10-31Z-typecheck-f0ce.log) | TS2584 |
| 13.09.2026 18:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 9 из 9 | 30 с | 34883f7 +30 | [лог](logs/2026-09-13T13-11-02Z-e2e-1790.log) | Все экраны и сценарии нового фронтенда; API изолирован, без живой БД |
| 13.09.2026 18:12 | unit (частично: apps/web/src/lib/api.test.ts) | ❌ упало 1 из 1 | 1 с | 34883f7 +31 | [лог](logs/2026-09-13T13-12-40Z-unit-b5ed.log) | Red: отсутствующая запись должна отличаться от сбоя системы |
| 13.09.2026 18:13 | unit | ✅ 511 из 511 | 5 с | 34883f7 +35 | [лог](logs/2026-09-13T13-13-36Z-unit-f381.log) |  |
| 13.09.2026 18:13 | typecheck | ✅ без ошибок | 7 с | 34883f7 +38 | [лог](logs/2026-09-13T13-13-41Z-typecheck-f9a4.log) |  |
| 13.09.2026 18:13 | lint | ✅ без ошибок | 5 с | 34883f7 +38 | [лог](logs/2026-09-13T13-13-49Z-lint-4303.log) |  |
| 13.09.2026 17:01 | unit (частично: apps/api/src/guard) | ❌ упало 1 из 11 | 1 с | 34883f7 +9 | [лог](logs/2026-09-13T12-01-22Z-unit-fd62.log) | срез 11: сторож в API |
| 13.09.2026 17:01 | unit (частично: apps/api/src/guard) | ✅ 11 из 11 | 1 с | 34883f7 +9 | [лог](logs/2026-09-13T12-01-43Z-unit-f46d.log) | срез 11: сторож в API |
| 13.09.2026 17:03 | typecheck | ✅ без ошибок | 5 с | 34883f7 +14 | [лог](logs/2026-09-13T12-03-20Z-typecheck-1559.log) | срез 11: сторож |
| 13.09.2026 17:03 | lint | ✅ без ошибок | 7 с | 34883f7 +14 | [лог](logs/2026-09-13T12-03-33Z-lint-6374.log) | срез 11: сторож |
| 13.09.2026 17:04 | integration (частично: tests/integration/system-incidents.test.ts) | ✅ 3 из 3 | 5 с | 34883f7 +21 | [лог](logs/2026-09-13T12-04-34Z-integration-08d8.log) | срез 11: таблица неисправностей на dev-БД |
| 13.09.2026 17:04 | unit | ✅ 513 из 513 | 3 с | 34883f7 +21 | [лог](logs/2026-09-13T12-04-50Z-unit-9dc9.log) | срез 11: полный unit после сторожа |
| 13.09.2026 17:10 | e2e (частично: tests/e2e/incidents.spec.ts) | ✅ 1 из 1 | 32 с | 0b0eaea +6 | [лог](logs/2026-09-13T12-10-04Z-e2e-cf80.log) | срез 11: экран неисправностей |
| 13.09.2026 17:18 | unit (частично: apps/api/src/guard) | ✅ 12 из 12 | 1 с | 2647b47 +2 | [лог](logs/2026-09-13T12-18-20Z-unit-6b29.log) | срез 11: не дублировать опрос ленты при подозрении на webhook |
| 13.09.2026 17:18 | unit (частично: apps/api/src/guard) | ❌ упало 1 из 12 | 1 с | 2647b47 +1 | [лог](logs/2026-09-13T12-18-37Z-unit-f027.log) | двойной опрос ленты: красный на прежнем коде сторожа |
| 13.09.2026 17:18 | unit (частично: apps/api/src/guard) | ✅ 12 из 12 | 1 с | 2647b47 +2 | [лог](logs/2026-09-13T12-18-38Z-unit-f467.log) | двойной опрос ленты: зелёный |
| 13.09.2026 17:18 | typecheck | ✅ без ошибок | 4 с | 1f3a8c1 | [лог](logs/2026-09-13T12-18-53Z-typecheck-6cc4.log) | срез 11 |
| 13.09.2026 17:23 | lint | ✅ без ошибок | 7 с | 1f3a8c1 +4 | [лог](logs/2026-09-13T12-23-53Z-lint-413d.log) | срез 11: учения и инструкция агента |
| 13.09.2026 17:47 | typecheck | ✅ без ошибок | 4 с | 3b71aff +1 | [лог](logs/2026-09-13T12-47-17Z-typecheck-3231.log) | подпись длительности на экране неисправностей |
| 13.09.2026 17:47 | typecheck | ✅ без ошибок | 4 с | 3b71aff +1 | [лог](logs/2026-09-13T12-47-41Z-typecheck-9ba6.log) | подписи экрана неисправностей |
| 13.09.2026 18:19 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep сбой списка) | ❌ упало 1 из 1 | 25 с | 422e5f2 | [лог](logs/2026-09-13T13-19-14Z-e2e-7b5c.log) | Red: после объединения main проверяем ошибку загрузки неисправностей |
| 13.09.2026 18:22 | unit | ✅ 536 из 536 | 5 с | 422e5f2 +1 | [лог](logs/2026-09-13T13-22-54Z-unit-4f9c.log) | Объединённая версия WETOP + main 8824974 |
| 13.09.2026 18:22 | typecheck | ✅ без ошибок | 8 с | 422e5f2 +3 | [лог](logs/2026-09-13T13-22-59Z-typecheck-5133.log) | Финальная проверка объединённой версии |
| 13.09.2026 18:23 | lint | ✅ без ошибок | 5 с | 422e5f2 +3 | [лог](logs/2026-09-13T13-23-07Z-lint-eb63.log) | Финальная проверка объединённой версии |
| 13.09.2026 18:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 12 из 12 | 29 с | 422e5f2 +1 | [лог](logs/2026-09-13T13-23-12Z-e2e-6a45.log) | 15 экранов, шахматка 88x30, формы и неисправности; синтетический API, без БД |
| 13.09.2026 18:42 | typecheck | ✅ без ошибок | 7 с | 3995ae2 +14 | [лог](logs/2026-09-13T13-42-14Z-typecheck-bb60.log) |  |
| 13.09.2026 18:43 | lint | ✅ без ошибок | 5 с | 3995ae2 +14 | [лог](logs/2026-09-13T13-43-58Z-lint-aab5.log) |  |
| 13.09.2026 18:44 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 13 | 30 с | 3995ae2 +13 | [лог](logs/2026-09-13T13-44-37Z-e2e-cd7d.log) | Visual redesign: isolated UI and responsive checks, no DB |
| 13.09.2026 18:47 | unit | ✅ 536 из 536 | 10 с | 3995ae2 +12 | [лог](logs/2026-09-13T13-47-58Z-unit-b3af.log) |  |
| 13.09.2026 18:47 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 13 из 13 | 36 с | 3995ae2 +13 | [лог](logs/2026-09-13T13-47-32Z-e2e-ac96.log) | Redesign: fixed hidden table heading overflow; check all routes and 320-1440px |
| 13.09.2026 18:47 | typecheck | ✅ без ошибок | 16 с | 3995ae2 +14 | [лог](logs/2026-09-13T13-47-56Z-typecheck-ac02.log) |  |
| 13.09.2026 18:48 | lint | ✅ без ошибок | 10 с | 3995ae2 +14 | [лог](logs/2026-09-13T13-48-30Z-lint-a6bd.log) |  |
| 13.09.2026 18:49 | lint | ✅ без ошибок | 6 с | 3995ae2 +14 | [лог](logs/2026-09-13T13-49-04Z-lint-b391.log) |  |
| 13.09.2026 19:07 | unit (частично: apps/api/src/hotel/hotel.controller.test.ts) | ❌ код выхода 1 | 1 с | 1193194 +1 | [лог](logs/2026-09-13T14-07-37Z-unit-c183.log) | (файл не выполнился) |
| 13.09.2026 19:08 | unit (частично: apps/api/src/hotel/hotel.controller.test.ts) | ✅ 10 из 10 | 2 с | 1193194 +3 | [лог](logs/2026-09-13T14-08-31Z-unit-7fa5.log) |  |
| 13.09.2026 19:13 | typecheck | ❌ ошибок: 2 | 7 с | 1193194 +10 | [лог](logs/2026-09-13T14-13-02Z-typecheck-c901.log) | TS2375 |
| 13.09.2026 19:16 | typecheck | ✅ без ошибок | 7 с | 1193194 +15 | [лог](logs/2026-09-13T14-16-31Z-typecheck-c0a9.log) |  |
| 13.09.2026 19:17 | lint | ❌ код выхода 2 | 2 с | 1193194 +16 | [лог](logs/2026-09-13T14-17-40Z-lint-e3f7.log) |  |
| 13.09.2026 19:17 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 17 | 50 с | 1193194 +14 | [лог](logs/2026-09-13T14-17-40Z-e2e-6974.log) | Разделы гостиницы и отчёт каналов, synthetic API без БД |
| 13.09.2026 19:19 | unit | ✅ 546 из 546 | 5 с | 1193194 +14 | [лог](logs/2026-09-13T14-19-07Z-unit-f6f3.log) |  |
| 13.09.2026 19:19 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 17 из 17 | 42 с | 1193194 +14 | [лог](logs/2026-09-13T14-19-18Z-e2e-f231.log) | Разделы гостиницы: маршруты, меню, доступность, каналы, ошибки; synthetic API |
| 13.09.2026 19:20 | lint | ✅ без ошибок | 5 с | 1193194 +18 | [лог](logs/2026-09-13T14-20-57Z-lint-5e8c.log) |  |
| 13.09.2026 18:01 | unit | ✅ 527 из 527 | 3 с | 8824974 | [лог](logs/2026-09-13T13-01-39Z-unit-b39c.log) | проверка перед списком «чего не хватает» |
| 13.09.2026 18:01 | lint | ✅ без ошибок | 7 с | 8824974 | [лог](logs/2026-09-13T13-01-43Z-lint-2c67.log) | проверка перед списком «чего не хватает» |
| 13.09.2026 18:13 | unit (частично: packages/integrations/src/telegram) | ❌ упало 2 из 8 | 1 с | 8824974 +1 | [лог](logs/2026-09-13T13-13-12Z-unit-c0b0.log) | номер чата группы: красный до кода |
| 13.09.2026 18:13 | unit (частично: packages/integrations/src/telegram) | ❌ упало 1 из 8 | 1 с | 8824974 +2 | [лог](logs/2026-09-13T13-13-35Z-unit-0062.log) | номер чата группы |
| 13.09.2026 18:13 | unit (частично: packages/integrations/src/telegram) | ✅ 8 из 8 | 1 с | 8824974 +2 | [лог](logs/2026-09-13T13-13-51Z-unit-2537.log) | номер чата группы |
| 13.09.2026 18:02 | e2e | ✅ 32 из 32 | 11 мин 56 с | 8824974 | [лог](logs/2026-09-13T13-02-04Z-e2e-064d.log) | полный e2e после среза 11 (меню, сторож в API) |
| 13.09.2026 18:15 | typecheck | ✅ без ошибок | 7 с | 8824974 +5 | [лог](logs/2026-09-13T13-15-53Z-typecheck-2bc4.log) | telegram:chats, проверка ключей |
| 13.09.2026 18:17 | unit (частично: apps/api/src/units) | ❌ упало 1 из 4 | 1 с | f8c0294 +1 | [лог](logs/2026-09-13T13-17-50Z-unit-01f2.log) | /units/%00 даёт 500: красный до исправления |
| 13.09.2026 18:18 | unit (частично: apps/api/src/units) | ✅ 4 из 4 | 1 с | f8c0294 +2 | [лог](logs/2026-09-13T13-18-43Z-unit-0d3b.log) | /units/%00: зелёный после исправления |
| 13.09.2026 18:27 | unit (частично: packages/domain/src/incidents) | ❌ упало 4 из 36 | 1 с | 6f9c6d2 +2 | [лог](logs/2026-09-13T13-27-03Z-unit-d2fc.log) | новые виды неисправностей: красный до кода |
| 13.09.2026 18:27 | unit (частично: packages/domain/src/incidents) | ❌ упало 4 из 36 | 1 с | 6f9c6d2 +2 | [лог](logs/2026-09-13T13-27-35Z-unit-ef7e.log) | новые виды неисправностей |
| 13.09.2026 18:28 | unit (частично: packages/domain/src/incidents) | ✅ 36 из 36 | 1 с | 6f9c6d2 +4 | [лог](logs/2026-09-13T13-28-14Z-unit-6a6c.log) | новые виды неисправностей |
| 13.09.2026 18:30 | unit (частично: apps/api/src/guard) | ✅ 16 из 16 | 1 с | 6f9c6d2 +8 | [лог](logs/2026-09-13T13-30-46Z-unit-c98c.log) | стойка, Exely, остатки канала |
| 13.09.2026 18:31 | unit (частично: apps/api/src/guard) | ❌ упало 3 из 16 | 1 с | 6f9c6d2 +7 | [лог](logs/2026-09-13T13-31-00Z-unit-03ef.log) | три новые проверки: красный на прежнем сторожe |
| 13.09.2026 18:31 | unit (частично: apps/api/src/guard) | ✅ 16 из 16 | 1 с | 6f9c6d2 +8 | [лог](logs/2026-09-13T13-31-02Z-unit-b0a6.log) | три новые проверки: зелёный |
| 13.09.2026 18:32 | typecheck | ❌ ошибок: 2 | 6 с | 6f9c6d2 +8 | [лог](logs/2026-09-13T13-32-20Z-typecheck-aa10.log) | сторож: три новые проверки |
| 13.09.2026 18:33 | typecheck | ✅ без ошибок | 4 с | 6f9c6d2 +9 | [лог](logs/2026-09-13T13-33-11Z-typecheck-d76f.log) | сторож: три новые проверки |
| 13.09.2026 18:33 | unit | ✅ 538 из 538 | 3 с | 6f9c6d2 +9 | [лог](logs/2026-09-13T13-33-34Z-unit-8ed3.log) | сторож: стойка, Exely, остатки канала; /units |
| 13.09.2026 18:33 | lint | ✅ без ошибок | 7 с | 6f9c6d2 +9 | [лог](logs/2026-09-13T13-33-37Z-lint-6b04.log) | сторож: три проверки |
| 13.09.2026 18:34 | typecheck | ✅ без ошибок | 4 с | 6f9c6d2 +10 | [лог](logs/2026-09-13T13-34-17Z-typecheck-7679.log) | сторож: три проверки, sync-day без 365 |
| 13.09.2026 18:37 | unit (частично: apps/api/src/app.module.test.ts) | ❌ упало 1 из 1 | 1 с | 17a69ab +1 | [лог](logs/2026-09-13T13-37-34Z-unit-b94a.log) | сборка API: красный без экспорта шлюза |
| 13.09.2026 18:37 | unit (частично: apps/api/src/app.module.test.ts) | ✅ 1 из 1 | 1 с | 17a69ab +2 | [лог](logs/2026-09-13T13-37-35Z-unit-27f5.log) | сборка API: зелёный |
| 13.09.2026 18:38 | unit (частично: apps/api/src/guard apps/api/src/app.module.test.ts) | ✅ 17 из 17 | 1 с | 4a2a5f8 +3 | [лог](logs/2026-09-13T13-38-47Z-unit-b1d4.log) | проход сторожа со всеми проверками |
| 13.09.2026 18:38 | typecheck | ✅ без ошибок | 4 с | 4a2a5f8 +3 | [лог](logs/2026-09-13T13-38-49Z-typecheck-a74e.log) | tick ?all=1 |
| 13.09.2026 18:46 | unit (частично: scripts/ops/watch) | ❌ код выхода 1 | 1 с | 809ac0b +2 | [лог](logs/2026-09-13T13-46-16Z-unit-1d45.log) | сторож сторожа: красный до кода |
| 13.09.2026 18:46 | unit (частично: scripts/ops/watch) | ❌ упало 1 из 8 | 1 с | 809ac0b +3 | [лог](logs/2026-09-13T13-46-58Z-unit-fa89.log) | сторож сторожа: логика |
| 13.09.2026 18:47 | unit (частично: scripts/ops/watch) | ✅ 8 из 8 | 1 с | 809ac0b +3 | [лог](logs/2026-09-13T13-47-11Z-unit-a33c.log) | сторож сторожа: логика |
| 13.09.2026 18:48 | unit (частично: apps/api/src/guard) | ❌ упало 3 из 19 | 1 с | 809ac0b +7 | [лог](logs/2026-09-13T13-48-47Z-unit-f95e.log) | сигнал на сервер сторожа: красный до кода |
| 13.09.2026 18:49 | unit (частично: apps/api/src/guard apps/api/src/app.module.test.ts) | ✅ 20 из 20 | 2 с | 809ac0b +11 | [лог](logs/2026-09-13T13-49-30Z-unit-c024.log) | сигнал на сервер сторожа |
| 13.09.2026 18:49 | typecheck | ✅ без ошибок | 5 с | 809ac0b +11 | [лог](logs/2026-09-13T13-49-32Z-typecheck-cdc1.log) | сигнал на сервер сторожа |
| 13.09.2026 18:49 | lint | ✅ без ошибок | 7 с | 809ac0b +11 | [лог](logs/2026-09-13T13-49-58Z-lint-946e.log) | сторож сторожа |
| 13.09.2026 19:06 | typecheck | ✅ без ошибок | 4 с | faf4237 +3 | [лог](logs/2026-09-13T14-06-36Z-typecheck-7d95.log) | проверка ключей сигнала |
| 13.09.2026 19:21 | unit | ✅ 569 из 569 | 8 с | 0c85467 | [лог](logs/2026-09-13T14-21-36Z-unit-c96b.log) |  |
| 13.09.2026 19:21 | typecheck | ❌ ошибок: 1 | 20 с | 0c85467 | [лог](logs/2026-09-13T14-21-36Z-typecheck-3571.log) | TS18048 |
| 13.09.2026 19:21 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 17 | 1 мин 6 с | 0c85467 | [лог](logs/2026-09-13T14-21-36Z-e2e-1435.log) | Объединено с main faf4237; разделы гостиницы; synthetic API без БД |
| 13.09.2026 19:22 | typecheck | ✅ без ошибок | 7 с | 0c85467 +1 | [лог](logs/2026-09-13T14-22-54Z-typecheck-13d2.log) |  |
| 13.09.2026 19:23 | unit | ✅ 569 из 569 | 9 с | 0c85467 | [лог](logs/2026-09-13T14-23-24Z-unit-e427.log) |  |
| 13.09.2026 19:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 17 из 17 | 59 с | 0c85467 | [лог](logs/2026-09-13T14-23-23Z-e2e-fd9a.log) | Объединённая версия; сообщения ошибок ограничены main, проверка 33 маршрутов |
| 13.09.2026 19:24 | lint | ✅ без ошибок | 6 с | 0c85467 +1 | [лог](logs/2026-09-13T14-24-38Z-lint-f88a.log) |  |
| 13.09.2026 19:33 | unit (частично: apps/web/src/lib/api.test.ts) | ❌ упало 4 из 5 | 1 с | c538741 +1 | [лог](logs/2026-09-13T14-33-19Z-unit-0e22.log) | обычный запуск не принимает демонстрационные данные |
| 13.09.2026 19:34 | unit (частично: apps/web/src/lib/api.test.ts) | ✅ 5 из 5 | 1 с | c538741 +2 | [лог](logs/2026-09-13T14-34-20Z-unit-e967.log) |  |
| 13.09.2026 19:35 | unit (частично: apps/api/src/channels/connection.test.ts) | ❌ код выхода 1 | 3 с | c538741 +3 | [лог](logs/2026-09-13T14-35-48Z-unit-c7e9.log) | (файл не выполнился) |
| 13.09.2026 19:36 | unit (частично: apps/api/src/channels/connection.test.ts) | ✅ 9 из 9 | 4 с | c538741 +5 | [лог](logs/2026-09-13T14-36-58Z-unit-bfe4.log) |  |
| 13.09.2026 19:43 | unit (частично: apps/web/src/app/channels/actions.test.ts apps/web/src/app/analytics/actions.test.ts) | ❌ упало 5 из 5 | 1 с | c538741 +12 | [лог](logs/2026-09-13T14-43-55Z-unit-c0e5.log) | обновляет маркетинг и подключения после pause |
| 13.09.2026 19:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep ошибка буфера\|финансы: неверные\|ошибка загрузки тарифов) | ❌ упало 3 из 3 | 1 мин 2 с | c538741 +23 | [лог](logs/2026-09-13T14-45-44Z-e2e-49ac.log) | Red: clipboard feedback, invalid finance period, unavailable widget plans |
| 13.09.2026 19:47 | typecheck | ❌ ошибок: 1 | 11 с | c538741 +31 | [лог](logs/2026-09-13T14-47-02Z-typecheck-3476.log) | TS2345 |
| 13.09.2026 19:48 | unit (частично: apps/web/src/app/channels/actions.test.ts apps/web/src/app/analytics/actions.test.ts) | ✅ 5 из 5 | 1 с | c538741 +32 | [лог](logs/2026-09-13T14-48-02Z-unit-da45.log) |  |
| 13.09.2026 19:48 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 20 из 20 | 1 мин 4 с | c538741 +32 | [лог](logs/2026-09-13T14-48-15Z-e2e-f966.log) | Section matrix and corrected error handling, isolated API only |
| 13.09.2026 19:51 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep номера: статус\|тарифы: добавить\|сайты: проверка\|кнопки Channex\|пустые ответы) | ❌ упало 2 из 5 | 42 с | c538741 +32 | [лог](logs/2026-09-13T14-51-32Z-e2e-6eb4.log) | Extended command and empty/offline coverage, synthetic isolated API |
| 13.09.2026 19:52 | typecheck | ❌ ошибок: 2 | 30 с | c538741 +35 | [лог](logs/2026-09-13T14-52-49Z-typecheck-a5ab.log) | TS2550 |
| 13.09.2026 19:52 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep кнопки Channex\|пустые ответы) | ✅ 2 из 2 | 34 с | c538741 +32 | [лог](logs/2026-09-13T14-52-48Z-e2e-a4b6.log) | Correct fixture pull route; assert visible error UI with Next Activity preservation |
| 13.09.2026 19:53 | unit | ✅ 587 из 587 | 23 с | c538741 +32 | [лог](logs/2026-09-13T14-53-00Z-unit-5801.log) |  |
| 13.09.2026 19:54 | typecheck | ✅ без ошибок | 11 с | c538741 +35 | [лог](logs/2026-09-13T14-54-38Z-typecheck-7dc3.log) |  |
| 13.09.2026 19:54 | lint | ✅ без ошибок | 7 с | c538741 +35 | [лог](logs/2026-09-13T14-54-49Z-lint-a201.log) |  |
| 13.09.2026 19:55 | unit | ✅ 587 из 587 | 12 с | c538741 +32 | [лог](logs/2026-09-13T14-55-12Z-unit-d3cf.log) |  |
| 13.09.2026 19:55 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 25 из 25 | 1 мин 38 с | c538741 +32 | [лог](logs/2026-09-13T14-55-12Z-e2e-8b4a.log) | Final 33-route desktop/mobile matrix and 25 scenarios; no DB or provider calls |
| 13.09.2026 19:58 | unit (частично: apps/web/src/lib/api.test.ts) | ❌ упало 1 из 6 | 1 с | c538741 +33 | [лог](logs/2026-09-13T14-58-43Z-unit-355e.log) | не перехватывает служебные сигналы рендера как сетевой сбой |
| 13.09.2026 19:58 | unit (частично: apps/web/src/lib/api.test.ts) | ✅ 6 из 6 | 1 с | c538741 +33 | [лог](logs/2026-09-13T14-58-59Z-unit-0086.log) |  |
| 13.09.2026 19:59 | unit | ✅ 588 из 588 | 23 с | c538741 +32 | [лог](logs/2026-09-13T14-59-28Z-unit-4d61.log) |  |
| 13.09.2026 19:59 | lint | ✅ без ошибок | 35 с | c538741 +35 | [лог](logs/2026-09-13T14-59-28Z-lint-9eb5.log) |  |
| 13.09.2026 19:59 | typecheck | ✅ без ошибок | 40 с | c538741 +35 | [лог](logs/2026-09-13T14-59-28Z-typecheck-b996.log) |  |
| 13.09.2026 20:00 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 25 из 25 | 1 мин 46 с | c538741 +32 | [лог](logs/2026-09-13T15-00-27Z-e2e-5898.log) | Final UI after bounded network error handling and successful production build without API |
| 13.09.2026 22:18 | unit | ✅ 594 из 594 | 30 с | 2579006 +50 | [лог](logs/2026-09-13T17-18-16Z-unit-d5e9.log) | WETOP premium UI: темы, server API и обратная совместимость |
| 13.09.2026 22:23 | unit | ✅ 595 из 595 | 20 с | 2579006 +50 | [лог](logs/2026-09-13T17-23-16Z-unit-e55f.log) | Final premium UI: query validation and demo isolation regression coverage |
| 13.09.2026 22:23 | lint | ❌ код выхода 2 | 11 с | 2579006 +50 | [лог](logs/2026-09-13T17-23-27Z-lint-4d50.log) | Premium UI final lint |
| 13.09.2026 22:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 31 | 7 мин 9 с | 2579006 +50 | [лог](logs/2026-09-13T17-23-27Z-e2e-c902.log) | Premium UI: full isolated browser regression, themes, drawers and responsive states |
| 13.09.2026 21:23 | unit (частично: apps/api/src/guard packages/domain/src/incidents) | ❌ упало 4 из 58 | 7 с | a3abd32 +3 | [лог](logs/2026-09-13T16-23-35Z-unit-fc37.log) | ложные тревоги после слияния PR #1: красный до исправления |
| 13.09.2026 21:24 | unit (частично: apps/api/src/guard packages/domain/src/incidents apps/api/src/app.module.test.ts) | ❌ упало 2 из 59 | 10 с | a3abd32 +6 | [лог](logs/2026-09-13T16-24-15Z-unit-d7ff.log) | ложные тревоги после слияния PR #1 |
| 13.09.2026 21:25 | unit (частично: apps/api/src/guard packages/domain/src/incidents apps/api/src/app.module.test.ts) | ✅ 59 из 59 | 13 с | a3abd32 +6 | [лог](logs/2026-09-13T16-25-30Z-unit-ab63.log) | ложные тревоги после слияния PR #1: зелёный |
| 13.09.2026 21:25 | unit | ✅ 591 из 591 | 12 с | a3abd32 +6 | [лог](logs/2026-09-13T16-25-45Z-unit-0e30.log) | полный unit после исправления ложных тревог |
| 13.09.2026 21:26 | typecheck | ✅ без ошибок | 42 с | a3abd32 +6 | [лог](logs/2026-09-13T16-26-09Z-typecheck-758d.log) | ложные тревоги |
| 13.09.2026 21:26 | lint | ✅ без ошибок | 51 с | a3abd32 +6 | [лог](logs/2026-09-13T16-26-53Z-lint-d076.log) | ложные тревоги |
| 13.09.2026 22:10 | unit (частично: tests/unit/launchd-install.test.ts) | ❌ упало 3 из 3 | 6 с | eae92ba +5 | [лог](logs/2026-09-13T17-10-48Z-unit-4c83.log) | red: install.sh --dry boots out live job, preflight gives up on bash getcwd line, reinstall of running job skips |
| 13.09.2026 22:11 | unit (частично: tests/unit/launchd-install.test.ts) | ✅ 3 из 3 | 9 с | eae92ba +5 | [лог](logs/2026-09-13T17-11-32Z-unit-ccc4.log) | green: dry keeps live job, preflight waits for node, reinstall waits for port release |
| 13.09.2026 22:11 | lint | ❌ ошибок: 11 | 10 с | eae92ba +5 | [лог](logs/2026-09-13T17-11-47Z-lint-9aa6.log) | no-undef |
| 13.09.2026 22:16 | unit (частично: tests/unit/launchd-web-start.test.ts) | ❌ упало 1 из 1 | 8 с | 34ee1ca +5 | [лог](logs/2026-09-13T17-16-13Z-unit-0320.log) | red: child of a SIGKILLed launchd wrapper survives as orphan (no parent watchdog) |
| 13.09.2026 22:17 | unit (частично: tests/unit/launchd-web-start.test.ts tests/unit/launchd-install.test.ts) | ✅ 4 из 4 | 9 с | 34ee1ca +5 | [лог](logs/2026-09-13T17-17-12Z-unit-8ca4.log) | green: next-server exits with its SIGKILLed parent; install.sh fixes still green |
| 13.09.2026 22:17 | lint | ✅ без ошибок | 8 с | 34ee1ca +6 | [лог](logs/2026-09-13T17-17-21Z-lint-1668.log) | after launchd node globals block for web-start.mjs / exit-with-parent.cjs |
| 13.09.2026 22:22 | unit (частично: tests/unit/launchd-install.test.ts) | ❌ упало 1 из 4 | 10 с | 34ee1ca +5 | [лог](logs/2026-09-13T17-22-05Z-unit-e658.log) | red: bootstrap right after bootout fails with 5 while launchd still unloads the job |
| 13.09.2026 22:22 | unit (частично: tests/unit/launchd-install.test.ts tests/unit/launchd-web-start.test.ts) | ✅ 5 из 5 | 12 с | 34ee1ca +5 | [лог](logs/2026-09-13T17-22-52Z-unit-656d.log) | green: install waits for launchd to unload the job and retries bootstrap |
| 13.09.2026 22:27 | unit (частично: scripts/reconciliation/src/rollback-window.test.ts) | ❌ код выхода 1 | 1 с | 87d7940 +1 | [лог](logs/2026-09-13T17-27-45Z-unit-cd78.log) | red: rollback window reconciliation rules before implementation |
| 13.09.2026 22:28 | unit (частично: scripts/reconciliation/src/rollback-window.test.ts) | ✅ 10 из 10 | 2 с | 87d7940 +2 | [лог](logs/2026-09-13T17-28-25Z-unit-1aec.log) | green: rollback window reconciliation rules |
| 13.09.2026 22:40 | unit (частично: apps/api/src/channels/ari-switch.test.ts apps/api/src/channels/outbox.test.ts apps/api/src/channels/sync-schedule.test.ts apps/api/src/guard/gua | ❌ упало 4 из 34 | 1 с | 4f8089b +18 | [лог](logs/2026-09-13T17-40-25Z-unit-fa4e.log) | red: single outbound ARI switch (Q-126) before implementation |
| 13.09.2026 22:41 | unit (частично: apps/api/src/channels/ari-switch.test.ts apps/api/src/channels/outbox.test.ts apps/api/src/channels/sync-schedule.test.ts apps/api/src/guard/gua | ✅ 38 из 38 | 1 с | 4f8089b +24 | [лог](logs/2026-09-13T17-41-36Z-unit-e4d1.log) | green: single outbound ARI switch (Q-126) |
| 13.09.2026 22:41 | typecheck | ✅ без ошибок | 5 с | 4f8089b +24 | [лог](logs/2026-09-13T17-41-56Z-typecheck-0682.log) | ARI switch Q-126 before API restart |
| 13.09.2026 22:55 | unit (частично: apps/api/src/channels/ari-switch.test.ts apps/api/src/channels/outbox.test.ts apps/api/src/channels/sync-schedule.test.ts apps/api/src/guard/gua | ✅ 48 из 48 | 1 с | 4f8089b +35 | [лог](logs/2026-09-13T17-55-44Z-unit-837c.log) | ARI switch Q-126 final: startup warning, report filename |
| 13.09.2026 22:55 | lint | ✅ без ошибок | 10 с | 4f8089b +35 | [лог](logs/2026-09-13T17-55-46Z-lint-e82e.log) | ARI switch Q-126 and rollback drill |
| 13.09.2026 22:36 | unit (частично: apps/api/src/guard/guard.adapters.test.ts) | ❌ упало 1 из 3 | 2 с | 4f8089b +12 | [лог](logs/2026-09-13T17-36-40Z-unit-6654.log) | red: lastExelySyncAt ignores exely.sync audit of the delta-only autosync (ADR-032) |
| 13.09.2026 22:25 | e2e | ❌ упало 9 из 32 | 14 мин 49 с | 87d7940 | [лог](logs/2026-09-13T17-25-47Z-e2e-a73d.log) | WETOP baseline on live API after merge of PR #1 (desk on next start); plan wetop-live-data step 1 |
| 13.09.2026 22:57 | unit (частично: apps/web/src/lib/api.test.ts apps/api/src/channels/channels.controller.test.ts apps/api/src/channels/content.test.ts apps/api/src/guard/guard.ad | ❌ упало 1 из 34 | 14 с | e4299ea +24 | [лог](logs/2026-09-13T17-57-27Z-unit-0668.log) | red for the 15 s read timeout; new specs: availability/changed route, Channex content, auto-sync window/delta, exely-sync launchd job; guard lastExelySyncAt gre |
| 13.09.2026 22:58 | unit (частично: apps/web/src/lib/api.test.ts) | ❌ упало 1 из 7 | 1 с | e4299ea +24 | [лог](logs/2026-09-13T17-58-01Z-unit-eb8d.log) | red: GET reads time out at 15 s while commands get 60 s |
| 13.09.2026 22:58 | unit (частично: apps/web/src/lib/api.test.ts) | ✅ 7 из 7 | 1 с | e4299ea +25 | [лог](logs/2026-09-13T17-58-49Z-unit-8f0f.log) | green: reads and commands both wait 60 s |
| 13.09.2026 22:58 | typecheck | ✅ без ошибок | 7 с | e4299ea +27 | [лог](logs/2026-09-13T17-58-50Z-typecheck-b608.log) | WETOP live data: availability/changed, Channex content, auto-sync, read timeout, chessboard testid |
| 13.09.2026 22:59 | lint | ✅ без ошибок | 12 с | e4299ea +27 | [лог](logs/2026-09-13T17-59-09Z-lint-44e2.log) | WETOP live data changes |
| 13.09.2026 23:03 | unit (частично: apps/api/src/channels/content.test.ts) | ❌ упало 1 из 3 | 2 с | 0917d91 +5 | [лог](logs/2026-09-13T18-03-14Z-unit-3054.log) | red: live staging policy uses checkin_from_time/checkout_to_time, not the docs example checkin_time |
| 13.09.2026 23:03 | unit (частично: apps/api/src/channels/content.test.ts) | ✅ 3 из 3 | 1 с | 0917d91 +6 | [лог](logs/2026-09-13T18-03-29Z-unit-bab0.log) | green: policy times read from checkin_from_time/checkout_to_time with docs fallback |
| 13.09.2026 23:10 | unit (частично: apps/api/src/freshness/freshness.test.ts) | ✅ 2 из 2 | 3 с | 0917d91 +14 | [лог](logs/2026-09-13T18-10-11Z-unit-23a0.log) | new spec: system/freshness (Exely sync, Channex last event, ARI queue) |
| 13.09.2026 23:10 | typecheck | ✅ без ошибок | 8 с | 0917d91 +16 | [лог](logs/2026-09-13T18-10-15Z-typecheck-590f.log) | freshness module, data-freshness badge, content policy fields |
| 13.09.2026 23:10 | lint | ✅ без ошибок | 9 с | 0917d91 +16 | [лог](logs/2026-09-13T18-10-23Z-lint-0585.log) | freshness module, data-freshness badge |
| 13.09.2026 23:27 | unit (частично: scripts/reconciliation/src/ui-smoke.test.ts) | ✅ 3 из 3 | 1 с | 869aa3a +8 | [лог](logs/2026-09-13T18-27-50Z-unit-c0d5.log) | new spec: WETOP screens smoke pass (plan wetop-live-data step 5) |
| 13.09.2026 23:33 | typecheck | ✅ без ошибок | 8 с | 869aa3a +9 | [лог](logs/2026-09-13T18-33-41Z-typecheck-0295.log) | ui-smoke and channex-wetop-cycle scripts |
| 13.09.2026 23:33 | lint | ✅ без ошибок | 9 с | 869aa3a +9 | [лог](logs/2026-09-13T18-33-49Z-lint-dd62.log) | ui-smoke and channex-wetop-cycle scripts |
| 13.09.2026 23:43 | integration (частично: tests/integration/reservations-import.test.ts -t сменило категорию) | ❌ упало 1 из 3, пропущено 2 | 33 с | 8c2e442 +6 | [лог](logs/2026-09-13T18-43-38Z-integration-0a34.log) | red: import keeps a reseated unit from the previous category after the stay changed category (T6 male dorm 14.09 PMS 5, Channex 6) |
| 13.09.2026 23:44 | integration (частично: tests/integration/reservations-import.test.ts) | ✅ 3 из 3 | 1 мин 43 с | 8c2e442 +7 | [лог](logs/2026-09-13T18-44-34Z-integration-7219.log) | green: a reseated unit is kept only in the stay's own category; whole import integration file |
| 13.09.2026 23:48 | e2e | ❌ упало 4 из 32, пропущено 22 | 7 мин 18 с | 5aa112c +5 | [лог](logs/2026-09-13T18-48-49Z-e2e-421f.log) | WETOP after fixes: reads wait 60 s, chessboard testid, content pages, freshness line; desk on next start |
| 13.09.2026 23:56 | e2e (частично: --workers=1) | ✅ 32 из 32 | 14 мин 50 с | 5aa112c +5 | [лог](logs/2026-09-13T18-56-34Z-e2e-0e8a.log) | WETOP after fixes, one worker: the Mac swaps 14 GB, two Chromium workers made server actions + card re-render exceed 30 s |
| 14.09.2026 00:26 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 25 | 6 мин 57 с | 4b127e4 +5 | [лог](logs/2026-09-13T19-26-23Z-e2e-1b86.log) | UI suite on the fixture API after WETOP live-data changes: content pages from Channex, freshness line |
| 13.09.2026 22:34 | unit (частично: packages/integrations/src/exely/universal.test.ts) | ❌ упало 1 из 5 | 13 с | 4f8089b +8 | [лог](logs/2026-09-13T17-34-48Z-unit-70c7.log) | red: analyticsPayments includeExternalPayments (September export from Exely) |
| 13.09.2026 22:35 | unit (частично: packages/integrations/src/exely/universal.test.ts) | ✅ 5 из 5 | 2 с | 4f8089b +10 | [лог](logs/2026-09-13T17-35-23Z-unit-e3ab.log) | green: analyticsPayments includeExternalPayments (September export from Exely) |
| 13.09.2026 22:34 | unit | ✅ 598 из 598 | 1 мин 7 с | 510aca4 +1 | [лог](logs/2026-09-13T17-34-59Z-unit-68fa.log) | Merged main and premium UI: final unit regression |
| 13.09.2026 22:34 | typecheck | ❌ ошибок: 2 | 2 мин 13 с | 510aca4 +1 | [лог](logs/2026-09-13T17-34-59Z-typecheck-7ef4.log) | Merged premium UI: root, API and Next frontend types |
| 13.09.2026 22:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 31 | 7 мин 43 с | 510aca4 | [лог](logs/2026-09-13T17-34-29Z-e2e-7ee1.log) | Final merged UI: all 31 browser scenarios, drawer payment, shortcuts, themes, errors and responsive layouts |
| 13.09.2026 22:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep drawer:) | ✅ 1 из 1 | 24 с | 510aca4 +3 | [лог](logs/2026-09-13T17-42-28Z-e2e-beea.log) | Regression: tab shortcuts and paid balance preserve one-step drawer close through Next history synchronization |
| 13.09.2026 22:43 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 31 из 31 | 6 мин 2 с | 510aca4 +3 | [лог](logs/2026-09-13T17-43-05Z-e2e-ef45.log) | Final regression after drawer history fix: all 31 real-browser UI scenarios on merged main |
| 13.09.2026 22:50 | unit | ✅ 598 из 598 | 18 с | 510aca4 +4 | [лог](logs/2026-09-13T17-50-08Z-unit-6412.log) | Final unit verification after UI history fix and merged guard changes |
| 13.09.2026 22:50 | typecheck | ✅ без ошибок | 28 с | 510aca4 +5 | [лог](logs/2026-09-13T17-50-26Z-typecheck-b51c.log) | Final root, API and web type checks after UI review |
| 13.09.2026 22:50 | lint | ✅ без ошибок | 12 с | 510aca4 +5 | [лог](logs/2026-09-13T17-50-56Z-lint-45a4.log) | Final lint after browser runner cleanup; preview output excluded |
| 13.09.2026 22:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep доступность всех разделов: light\|неверные параметры списка\|короткий поиск\|повторяющиеся | ❌ упало 4 из 5 | 1 мин 37 с | 130f0d1 +2 | [лог](logs/2026-09-13T17-59-09Z-e2e-2afc.log) | Deep audit baseline: accessibility, query validation and long mobile content; reproduce before fixes |
| 13.09.2026 23:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep доступность всех разделов) | ❌ упало 2 из 2 | 3 мин 58 с | 130f0d1 +3 | [лог](logs/2026-09-13T18-02-33Z-e2e-2b0e.log) | Accessibility baseline: all 38 routes in both themes; inspect visible headings after Next activity transitions |
| 13.09.2026 23:07 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep операция проживания\|отказ оплаты\|открытых форм) | ❌ упало 3 из 4 | 4 мин 52 с | 130f0d1 +3 | [лог](logs/2026-09-13T18-07-21Z-e2e-4eff.log) | Red regressions: pending guards, rejected payment field retention, accessible drawer tabs |
| 13.09.2026 23:13 | typecheck | ❌ ошибок: 2 | 15 с | 130f0d1 +30 | [лог](logs/2026-09-13T18-13-02Z-typecheck-0870.log) | Type safety after query boundary normalization and async command guards |
| 13.09.2026 23:13 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep открытых форм\|параметры списка\|короткий поиск\|повторяющиеся параметры\|операция проживан | ❌ упало 3 из 8 | 1 мин 29 с | 130f0d1 +28 | [лог](logs/2026-09-13T18-13-41Z-e2e-e5fa.log) | Verify contrast, labels, query and pending fixes; reproduce invalid month/calendar URL handling |
| 13.09.2026 23:17 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep список гостей и вторая\|параметры списка\|ошибочные даты\|открытых форм) | ❌ упало 1 из 5 | 41 с | 130f0d1 +28 | [лог](logs/2026-09-13T18-17-46Z-e2e-fa47.log) | Query/date and drawer accessibility fixes; reproduce inconsistent demo record identity |
| 13.09.2026 23:19 | typecheck | ✅ без ошибок | 21 с | 130f0d1 +32 | [лог](logs/2026-09-13T18-19-06Z-typecheck-de69.log) | Check query limit against domain contract and coherent synthetic records |
| 13.09.2026 23:21 | typecheck | ✅ без ошибок | 15 с | 130f0d1 +34 | [лог](logs/2026-09-13T18-21-06Z-typecheck-d41a.log) | Include preview API in type checking; created records and payment lines retain their identity |
| 13.09.2026 23:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 47 | 13 мин 15 с | 130f0d1 +31 | [лог](logs/2026-09-13T18-23-23Z-e2e-6f3f.log) | Full isolated UI audit: 38 routes, both themes, desktop/mobile accessibility, existing and new command regressions |
| 13.09.2026 23:37 | unit (частично: apps/web/src/app/reservations) | ❌ упало 2 из 13 | 5 с | 130f0d1 +33 | [лог](logs/2026-09-13T18-37-33Z-unit-bf11.log) | Red: rejected mutations must return form values and attempt, then clear on success |
| 13.09.2026 23:37 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep неподключённые внешние демо) | ❌ упало 1 из 1 | 41 с | 130f0d1 +33 | [лог](logs/2026-09-13T18-37-42Z-e2e-e194.log) | Red: demo links point to missing frontend routes |
| 13.09.2026 23:40 | unit (частично: apps/web/src/app/reservations) | ✅ 13 из 13 | 1 с | 130f0d1 +37 | [лог](logs/2026-09-13T18-40-03Z-unit-f23b.log) | Green: rejected payment and booking edits retain input, success clears it |
| 13.09.2026 23:40 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep отказ оплаты\|обзор: задачи\|неподключённые внешние демо\|открытых форм\|ошибка создания\|сп | ✅ 7 из 7 | 36 с | 130f0d1 +39 | [лог](logs/2026-09-13T18-40-31Z-e2e-1ad2.log) | Focused final regressions: retained payment retry, preview links, record identity and accessible forms |
| 13.09.2026 23:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep открытых форм.*390) | ✅ 2 из 2 | 24 с | 130f0d1 +39 | [лог](logs/2026-09-13T18-42-05Z-e2e-0fc0.log) | Verify mobile booking drawer and forms in both themes after larger input fonts |
| 13.09.2026 23:46 | unit (частично: apps/web/src/app/form-retention.test.ts) | ❌ упало 4 из 4 | 1 с | 130f0d1 +38 | [лог](logs/2026-09-13T18-46-44Z-unit-1c95.log) | Reproduce form field loss after guest, document, unit block and site API rejection |
| 13.09.2026 23:48 | unit (частично: apps/web/src/app/form-retention.test.ts) | ✅ 4 из 4 | 2 с | 130f0d1 +44 | [лог](logs/2026-09-13T18-48-48Z-unit-ee48.log) | Guest, document, block and site fields retained after rejected API commands |
| 13.09.2026 23:48 | typecheck | ❌ ошибок: 1 | 15 с | 130f0d1 +47 | [лог](logs/2026-09-13T18-48-55Z-typecheck-015b.log) | Preflight all audit changes including form retention and isolated preview API |
| 13.09.2026 23:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 130 | 25 с | 130f0d1 +46 | [лог](logs/2026-09-13T18-49-15Z-e2e-b575.log) | Full UI audit after fixes: all routes, both themes, mobile/desktop, real Next actions with isolated API, failure retention and accessibility |
| 13.09.2026 23:49 | typecheck | ✅ без ошибок | 18 с | 130f0d1 +47 | [лог](logs/2026-09-13T18-49-41Z-typecheck-3f71.log) | Verify combined form reset key and retained values before final browser audit |
| 13.09.2026 23:50 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 54, пропущено 42 | 13 мин 3 с | 130f0d1 +46 | [лог](logs/2026-09-13T18-50-06Z-e2e-aea2.log) | Final full UI audit: 38 routes, both themes, mobile and desktop, all booking tabs, error recovery and isolated API commands |
| 14.09.2026 00:03 | e2e (частично: tests/ui/premium.spec.ts tests/ui/quality.spec.ts tests/ui/workspace.spec.ts --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 46 | 6 мин 35 с | 130f0d1 +46 | [лог](logs/2026-09-13T19-03-41Z-e2e-8887.log) | Final functional UI suite, including rejected form recovery and fixture reset on the current Almaty date |
| 14.09.2026 00:10 | e2e (частично: tests/ui/quality.spec.ts --config tests/ui/playwright.config.ts --workers=1) | ✅ 15 из 15 | 42 с | 130f0d1 +46 | [лог](logs/2026-09-13T19-10-48Z-e2e-d32a.log) | Final regression suite: match the actual save error separately from HTTPS setup warning |
| 14.09.2026 00:11 | unit | ✅ 604 из 604 | 11 с | 130f0d1 +43 | [лог](logs/2026-09-13T19-11-49Z-unit-89b4.log) | Final complete unit suite after UI audit and form recovery fixes |
| 14.09.2026 00:12 | typecheck | ✅ без ошибок | 15 с | 130f0d1 +46 | [лог](logs/2026-09-13T19-12-20Z-typecheck-b97f.log) | Final TypeScript checks for root, API and frontend including preview fixtures |
| 14.09.2026 00:12 | lint | ✅ без ошибок | 9 с | 130f0d1 +46 | [лог](logs/2026-09-13T19-12-53Z-lint-15ef.log) | Final lint after the complete UI audit |
| 14.09.2026 00:22 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts --workers=1) | ❌ упало 2 из 2 | 35 с | f46a020 +1 | [лог](logs/2026-09-13T19-22-27Z-e2e-5881.log) | месяц по умолчанию: с первого по последнее число, включая прошлые дни |
| 14.09.2026 00:23 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts --workers=1) | ❌ упало 2 из 2 | 31 с | f46a020 +2 | [лог](logs/2026-09-13T19-23-12Z-e2e-1fd7.log) | месяц по умолчанию: с первого по последнее число, включая прошлые дни |
| 14.09.2026 00:24 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts --workers=1) | ✅ 2 из 2 | 18 с | f46a020 +6 | [лог](logs/2026-09-13T19-24-49Z-e2e-ca43.log) |  |
| 14.09.2026 00:27 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts tests/ui/premium.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spe | ❌ упало 3 из 14 | 1 мин 32 с | f46a020 +9 | [лог](logs/2026-09-13T19-27-12Z-e2e-8845.log) | все 31 день помещаются по ширине окна |
| 14.09.2026 00:31 | unit | ✅ 611 из 611 | 16 с | f46a020 +6 | [лог](logs/2026-09-13T19-31-03Z-unit-14a7.log) |  |
| 14.09.2026 00:31 | typecheck | ✅ без ошибок | 32 с | f46a020 +9 | [лог](logs/2026-09-13T19-31-30Z-typecheck-bf50.log) |  |
| 14.09.2026 00:30 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts tests/ui/premium.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spe | ❌ упало 1 из 14 | 2 мин 49 с | f46a020 +9 | [лог](logs/2026-09-13T19-30-11Z-e2e-0a48.log) | все 31 день помещаются по ширине окна |
| 14.09.2026 00:35 | lint | ✅ без ошибок | 14 с | f46a020 +9 | [лог](logs/2026-09-13T19-35-18Z-lint-27f5.log) |  |
| 14.09.2026 00:33 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts tests/ui/premium.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spe | ✅ 14 из 14 | 2 мин 6 с | f46a020 +9 | [лог](logs/2026-09-13T19-33-53Z-e2e-73f4.log) |  |
| 14.09.2026 00:37 | typecheck | ✅ без ошибок | 15 с | f46a020 +8 | [лог](logs/2026-09-13T19-37-14Z-typecheck-ed59.log) |  |
| 14.09.2026 00:38 | unit | ✅ 611 из 611 | 11 с | 91b0280 | [лог](logs/2026-09-13T19-38-22Z-unit-b9cc.log) |  |
| 14.09.2026 00:38 | lint | ✅ без ошибок | 14 с | 91b0280 | [лог](logs/2026-09-13T19-38-22Z-lint-057a.log) |  |
| 14.09.2026 00:43 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts --grep все 31 день --workers=1) | ❌ упало 1 из 1 | 21 с | 8f7527a +2 | [лог](logs/2026-09-13T19-43-31Z-e2e-cdad.log) | все 31 день помещаются по ширине окна |
| 14.09.2026 00:44 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts --grep все 31 день\|месячная сетка --workers=1) | ✅ 3 из 3 | 1 мин 19 с | 8f7527a +4 | [лог](logs/2026-09-13T19-44-35Z-e2e-caa6.log) |  |
| 14.09.2026 00:46 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts tests/ui/premium.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spe | ✅ 14 из 14 | 2 мин 13 с | 8f7527a +4 | [лог](logs/2026-09-13T19-46-33Z-e2e-5741.log) |  |
| 14.09.2026 00:49 | unit | ✅ 611 из 611 | 15 с | 8f7527a +2 | [лог](logs/2026-09-13T19-49-23Z-unit-3704.log) |  |
| 14.09.2026 00:49 | lint | ✅ без ошибок | 21 с | 8f7527a +3 | [лог](logs/2026-09-13T19-49-23Z-lint-d648.log) |  |
| 14.09.2026 00:49 | typecheck | ✅ без ошибок | 25 с | 8f7527a +3 | [лог](logs/2026-09-13T19-49-23Z-typecheck-cc79.log) |  |
| 14.09.2026 01:14 | typecheck | ❌ ошибок: 11 | 6 с | 1db751b +50 | [лог](logs/2026-09-13T20-14-51Z-typecheck-feb0.log) | merge of origin/main (PR #2-#4) into local main: conflicts resolved |
| 14.09.2026 01:14 | lint | ✅ без ошибок | 7 с | 1db751b +50 | [лог](logs/2026-09-13T20-14-57Z-lint-79ec.log) | merge of origin/main (PR #2-#4) into local main: conflicts resolved |
| 14.09.2026 01:17 | typecheck | ✅ без ошибок | 6 с | b748448 | [лог](logs/2026-09-13T20-17-49Z-typecheck-4d3d.log) | after merge b748448 and npm ci |
| 14.09.2026 01:17 | lint | ✅ без ошибок | 8 с | b748448 | [лог](logs/2026-09-13T20-17-56Z-lint-5e26.log) | after merge b748448 and npm ci |
| 14.09.2026 01:18 | unit | ✅ 660 из 660 | 14 с | b748448 | [лог](logs/2026-09-13T20-18-22Z-unit-ada5.log) | full unit suite after merge b748448 (PR #2-#4 + live data/Channex) |
| 14.09.2026 00:59 | unit (частично: apps/api/src/database/connection.test.ts) | ❌ упало 6 из 6 | 4 с | 0f05d21 +1 | [лог](logs/2026-09-13T19-59-16Z-unit-9bcb.log) | RED: отсутствует проверка базы и источника данных |
| 14.09.2026 01:00 | unit (частично: apps/api/src/database/connection.test.ts apps/api/src/app.module.test.ts) | ✅ 7 из 7 | 3 с | 0f05d21 +5 | [лог](logs/2026-09-13T20-00-09Z-unit-5950.log) | GREEN: проверка базы без побочных действий и утечки секретов |
| 14.09.2026 01:02 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/real-data.spec.ts --workers=1 --max-failures=1) | ❌ упало 1 из 4, пропущено 3 | 27 с | 4a4aa53 +3 | [лог](logs/2026-09-13T20-02-06Z-e2e-0483.log) | RED: интерфейс не показывает источник базы и использует название из макета |
| 14.09.2026 01:03 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/real-data.spec.ts --workers=1) | ✅ 4 из 4 | 17 с | 4a4aa53 +11 | [лог](logs/2026-09-13T20-03-48Z-e2e-2611.log) | GREEN: статус источника, ошибки базы и название гостиницы из API |
| 14.09.2026 01:04 | typecheck | ✅ без ошибок | 13 с | 4a4aa53 +10 | [лог](logs/2026-09-13T20-04-39Z-typecheck-8b62.log) | Проверка контракта состояния базы и серверного каркаса |
| 14.09.2026 01:06 | unit (частично: scripts/preview/real-config.test.ts) | ❌ код выхода 1 | 1 с | 7cb6e03 +1 | [лог](logs/2026-09-13T20-06-15Z-unit-f09e.log) | RED: нет команды безопасного запуска с базой проекта |
| 14.09.2026 01:07 | unit (частично: scripts/preview/real-config.test.ts) | ✅ 24 из 24 | 1 с | 7cb6e03 +2 | [лог](logs/2026-09-13T20-07-12Z-unit-f079.log) | GREEN: обычный запуск принимает только подтверждённый backend с базой |
| 14.09.2026 01:08 | lint | ✅ без ошибок | 13 с | 7cb6e03 +4 | [лог](logs/2026-09-13T20-08-45Z-lint-915f.log) | Проверка нового запуска и панели данных |
| 14.09.2026 01:08 | typecheck | ✅ без ошибок | 16 с | 7cb6e03 +4 | [лог](logs/2026-09-13T20-08-45Z-typecheck-e017.log) | Контракты подключения и единый запуск |
| 14.09.2026 01:11 | unit | ✅ 641 из 641 | 18 с | c76c0b0 +1 | [лог](logs/2026-09-13T20-11-45Z-unit-31a4.log) | Полная регрессия после подключения источника данных и запуска |
| 14.09.2026 01:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 68 | 12 мин 40 с | c76c0b0 +1 | [лог](logs/2026-09-13T20-11-45Z-e2e-4bbe.log) | Все UI-разделы, новая панель данных, месячная шахматка, формы, темы и доступность |
| 14.09.2026 01:25 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/real-data.spec.ts --grep поздняя загрузка --workers=1) | ❌ упало 1 из 1 | 27 с | c76c0b0 +3 | [лог](logs/2026-09-13T20-25-16Z-e2e-7305.log) | RED: поздний ответ метаданных не должен пересоздавать формы и меню |
| 14.09.2026 01:26 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/real-data.spec.ts tests/ui/premium.spec.ts tests/ui/workspace.spec.ts --workers=1) | ✅ 36 из 36 | 3 мин 6 с | c76c0b0 +8 | [лог](logs/2026-09-13T20-26-28Z-e2e-623b.log) | Финальный повтор: метаданные без сброса форм, темы, каждый маршрут и операции API |
| 14.09.2026 01:31 | unit | ✅ 641 из 641 | 17 с | c76c0b0 +6 | [лог](logs/2026-09-13T20-31-18Z-unit-3e71.log) | Финальный код: база, конфигурация, API и доменные правила |
| 14.09.2026 01:31 | lint | ✅ без ошибок | 23 с | c76c0b0 +7 | [лог](logs/2026-09-13T20-31-18Z-lint-ef7c.log) | Финальная проверка изменений подключения |
| 14.09.2026 01:31 | typecheck | ✅ без ошибок | 26 с | c76c0b0 +7 | [лог](logs/2026-09-13T20-31-18Z-typecheck-d58d.log) | Финальный код: серверные слоты метаданных и все workspace |
| 14.09.2026 01:23 | unit (частично: tests/unit/launchd-install.test.ts -t exely-sync) | ❌ упало 1 из 5, пропущено 4 | 1 с | b748448 +3 | [лог](logs/2026-09-13T20-23-30Z-unit-e6d9.log) | red: exely-sync every 5 minutes (owner 13.09.2026) |
| 14.09.2026 01:24 | unit (частично: tests/unit/launchd-install.test.ts tests/unit/auto-sync.test.ts scripts/imports/src/exely/auto-sync.test.ts) | ✅ 16 из 16 | 13 с | b748448 +5 | [лог](logs/2026-09-13T20-24-16Z-unit-ceee.log) | green: exely-sync every 5 minutes (owner 13.09.2026) |
| 14.09.2026 01:32 | unit (частично: scripts/reconciliation/src/test-data-purge-rules.test.ts) | ❌ код выхода 1 | 1 с | b748448 +6 | [лог](logs/2026-09-13T20-32-16Z-unit-8fe0.log) | red: test-data purge rules (plan live-db-clean, step A) |
| 14.09.2026 01:33 | unit (частично: scripts/reconciliation/src/test-data-purge-rules.test.ts) | ✅ 11 из 11 | 1 с | b748448 +7 | [лог](logs/2026-09-13T20-33-07Z-unit-c237.log) | green: test-data purge rules (plan live-db-clean, step A) |
| 14.09.2026 01:22 | e2e (частично: --workers=1) | ❌ упало 9 из 32, пропущено 10 | 33 мин 25 с | b748448 +2 | [лог](logs/2026-09-13T20-22-25Z-e2e-090d.log) | after merge b748448: premium UI (drawers, shell), UI quality audit, chessboard month + live data/Channex; one worker |
| 14.09.2026 01:56 | typecheck | ✅ без ошибок | 8 с | aeb2c51 +8 | [лог](logs/2026-09-13T20-56-22Z-typecheck-4364.log) | after merge aeb2c51 (PR #5) |
| 14.09.2026 01:56 | lint | ✅ без ошибок | 12 с | aeb2c51 +8 | [лог](logs/2026-09-13T20-56-31Z-lint-0c13.log) | after merge aeb2c51 (PR #5) |
| 14.09.2026 02:03 | typecheck | ✅ без ошибок | 5 с | 9ce7b2f +14 | [лог](logs/2026-09-13T21-03-20Z-typecheck-a4f9.log) | e2e specs switch reservation card tabs (cardTab helper) |
| 14.09.2026 02:03 | lint | ✅ без ошибок | 12 с | 9ce7b2f +14 | [лог](logs/2026-09-13T21-03-26Z-lint-c623.log) | e2e specs switch reservation card tabs (cardTab helper) |
| 14.09.2026 02:03 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/chessboard-unassigned.spec.ts tests/e2e/manual-reservation.spec.ts --workers=1) | ❌ упало 2 из 3 | 1 ч 23 мин | 9ce7b2f +14 | [лог](logs/2026-09-13T21-03-38Z-e2e-9c9f.log) | green check of card tabs helper on 3 specs (aeb2c51 + spec edits) |
| 14.09.2026 12:37 | e2e (частично: tests/e2e/finance.spec.ts tests/e2e/manual-reservation.spec.ts --workers=1) | ✅ 2 из 2 | 1 мин 18 с | 9ce7b2f +14 | [лог](logs/2026-09-14T07-37-47Z-e2e-c922.log) | rerun after Mac woke up and API restart: finance + manual reservation with card tabs |
| 14.09.2026 12:39 | e2e (частично: --workers=1) | ✅ 32 из 32 | 16 мин 56 с | 9ce7b2f +14 | [лог](logs/2026-09-14T07-39-15Z-e2e-3bbe.log) | full e2e on main 9ce7b2f (PR #2-#5 merged) with reservation card tabs in specs |
| 14.09.2026 01:46 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-week.spec.ts --workers=1) | ❌ упало 1 из 1 | 27 с | fc05d03 +2 | [лог](logs/2026-09-13T20-46-30Z-e2e-9a64.log) | RED: requested calendar week is still a month |
| 14.09.2026 01:50 | unit (частично: apps/web/src/app/chessboard) | ✅ 24 из 24 | 1 с | fc05d03 +6 | [лог](logs/2026-09-13T20-50-03Z-unit-c623.log) | Calendar week and existing month/date/drag behavior |
| 14.09.2026 01:51 | typecheck | ✅ без ошибок | 34 с | fc05d03 +10 | [лог](logs/2026-09-13T20-51-23Z-typecheck-286e.log) | Weekly view types across root, API and frontend |
| 14.09.2026 01:51 | lint | ✅ без ошибок | 14 с | fc05d03 +10 | [лог](logs/2026-09-13T20-51-59Z-lint-97d8.log) | Weekly view lint |
| 14.09.2026 01:50 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts --workers=1) | ❌ упало 4 из 17 | 7 мин 19 с | fc05d03 +10 | [лог](logs/2026-09-13T20-50-05Z-e2e-001c.log) | Weekly default, responsive seven columns, controls and retained month |
| 14.09.2026 01:58 | lint | ✅ без ошибок | 26 с | fc05d03 +10 | [лог](logs/2026-09-13T20-58-39Z-lint-e233.log) | Final weekly calendar review |
| 14.09.2026 01:58 | typecheck | ✅ без ошибок | 31 с | fc05d03 +10 | [лог](logs/2026-09-13T20-58-39Z-typecheck-b6c2.log) | Final weekly calendar and browser regression types |
| 14.09.2026 01:58 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts tests/ui/premium.spec.ts tests/ui/works | ✅ 19 из 19 | 2 мин 33 с | fc05d03 +10 | [лог](logs/2026-09-13T20-58-14Z-e2e-b090.log) | Calendar UI regression with hydrated history and desktop sidebar controls |
| 14.09.2026 02:02 | unit (частично: apps/web/src/app/chessboard) | ✅ 24 из 24 | 1 с | fc05d03 +5 | [лог](logs/2026-09-13T21-02-11Z-unit-601e.log) | Final calendar date arithmetic and drag regression |
| 14.09.2026 02:02 | typecheck | ✅ без ошибок | 12 с | fc05d03 +9 | [лог](logs/2026-09-13T21-02-12Z-typecheck-fcfb.log) | Final generated route declarations after production build |
| 14.09.2026 03:21 | typecheck | ✅ без ошибок | 11 с | b22fa32 +5 | [лог](logs/2026-09-13T22-21-19Z-typecheck-d168.log) | Audit harness and current frontend/backend contracts |
| 14.09.2026 03:21 | e2e (частично: --config tests/live-system/playwright.config.ts) | ❌ упало 1 из 1 | 45 с | b22fa32 +1 | [лог](logs/2026-09-13T22-21-03Z-e2e-c94b.log) | Supabase: committed synthetic records, provider publisher isolated, exact own cleanup |
| 14.09.2026 03:21 | unit | ✅ 650 из 650 | 5 с | b22fa32 +1 | [лог](logs/2026-09-13T22-21-49Z-unit-4cba.log) | Complete isolated unit/contract regression for system audit |
| 14.09.2026 03:24 | e2e (частично: --config tests/live-system/playwright.config.ts --workers=1) | ❌ упало 1 из 1 | 1 мин 15 с | b22fa32 +1 | [лог](logs/2026-09-13T22-24-10Z-e2e-0bd2.log) | Live persistence including document encryption, finance, blocks, sites; corrected expected 422 validation contract |
| 14.09.2026 03:28 | e2e (частично: --config tests/ui/playwright.config.ts payment-draft.spec.ts --workers=1) | ❌ упало 1 из 2 | 31 с | b22fa32 +2 | [лог](logs/2026-09-13T22-28-00Z-e2e-e502.log) | RED: updating a folio must not replace an entered payment with full debt |
| 14.09.2026 03:29 | e2e (частично: --config tests/ui/playwright.config.ts payment-draft.spec.ts --workers=1) | ✅ 2 из 2 | 17 с | b22fa32 +3 | [лог](logs/2026-09-13T22-29-10Z-e2e-162e.log) | GREEN: preserve payment draft while refreshing default amount for untouched input |
| 14.09.2026 03:30 | lint | ❌ ошибок: 2 | 10 с | b22fa32 +7 | [лог](logs/2026-09-13T22-30-19Z-lint-79a1.log) | Review system audit and payment draft changes |
| 14.09.2026 03:30 | typecheck | ✅ без ошибок | 13 с | b22fa32 +7 | [лог](logs/2026-09-13T22-30-19Z-typecheck-780c.log) | Final contracts after payment input fix and live audit coverage |
| 14.09.2026 03:30 | e2e (частично: --config tests/live-system/playwright.config.ts --workers=1) | ✅ 1 из 1 | 2 мин | b22fa32 +3 | [лог](logs/2026-09-13T22-30-09Z-e2e-db54.log) | Live Supabase: payment draft fix, full marked-record lifecycle, guest/document, dates, finance, blocks, sites |
| 14.09.2026 03:32 | lint | ✅ без ошибок | 6 с | b22fa32 +7 | [лог](logs/2026-09-13T22-32-47Z-lint-413e.log) | Correct audit cleanup error reporting without throwing from finally |
| 14.09.2026 03:36 | unit | ✅ 650 из 650 | 11 с | b22fa32 +2 | [лог](logs/2026-09-13T22-36-24Z-unit-2194.log) | Final isolated unit/contracts after payment state fix |
| 14.09.2026 03:36 | typecheck | ✅ без ошибок | 19 с | b22fa32 +7 | [лог](logs/2026-09-13T22-36-25Z-typecheck-6b51.log) | Final audit cleanup and application types |
| 14.09.2026 03:32 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 3 из 78 | 5 мин 41 с | b22fa32 +3 | [лог](logs/2026-09-13T22-32-46Z-e2e-1e1e.log) | Complete UI regression of all sections after payment draft fix |
| 14.09.2026 03:39 | e2e (частично: --config tests/ui/playwright.config.ts premium.spec.ts workspace.spec.ts --workers=1) | ✅ 31 из 31 | 2 мин 1 с | b22fa32 +5 | [лог](logs/2026-09-13T22-39-38Z-e2e-d1d4.log) | Retest route and Channex scenarios using accessible visible UI, excluding hidden streamed copies |
| 14.09.2026 03:42 | lint | ✅ без ошибок | 8 с | b22fa32 +9 | [лог](logs/2026-09-13T22-42-12Z-lint-3eb5.log) | Final code and stable UI selectors |
| 14.09.2026 03:41 | e2e (частично: --config tests/live-system/playwright.config.ts --workers=1) | ✅ 1 из 1 | 2 мин 4 с | b22fa32 +5 | [лог](logs/2026-09-13T22-41-42Z-e2e-1ef0.log) | Final Supabase persistence and cleanup verification on completed audit code |
| 14.09.2026 03:45 | unit | ✅ 650 из 650 | 8 с | b22fa32 +1 | [лог](logs/2026-09-13T22-45-09Z-unit-05a3.log) | Final unit fingerprint with normal Next generated types restored |
| 14.09.2026 03:45 | typecheck | ✅ без ошибок | 15 с | b22fa32 +8 | [лог](logs/2026-09-13T22-45-08Z-typecheck-a901.log) | Final root/API/web types after production build and normal preview restart |
| 14.09.2026 12:46 | unit (частично: packages/database/src/schema.test.ts tests/unit/test-schema-plan.test.ts apps/api/src/database/connection.test.ts) | ❌ упало 1 из 7 | 3 с | 9ce7b2f +5 | [лог](logs/2026-09-14T07-46-04Z-unit-131e.log) | red: autotests in schema pms_test (ADR-039) |
| 14.09.2026 12:49 | unit (частично: packages/database/src/schema.test.ts tests/unit/test-schema-plan.test.ts apps/api/src/database/connection.test.ts) | ✅ 16 из 16 | 2 с | 9ce7b2f +11 | [лог](logs/2026-09-14T07-49-07Z-unit-0d27.log) | green: autotests in schema pms_test (ADR-039) |
| 14.09.2026 12:54 | integration | ❌ упало 5 из 17 | 3 мин 21 с | 9ce7b2f +11 | [лог](logs/2026-09-14T07-54-12Z-integration-3391.log) | autotests in schema pms_test (ADR-039): full integration set |
| 14.09.2026 13:01 | integration (частично: tests/integration/test-schema.test.ts) | ❌ упало 1 из 1 | 4 с | 76f729b +12 | [лог](logs/2026-09-14T08-01-37Z-integration-5f85.log) | red: raw SQL must run in schema pms_test (ADR-040) |
| 14.09.2026 13:01 | integration (частично: tests/integration/test-schema.test.ts tests/integration/system-incidents.test.ts tests/integration/web-analytics.test.ts) | ✅ 7 из 7 | 18 с | 76f729b +12 | [лог](logs/2026-09-14T08-01-54Z-integration-b028.log) | green: raw SQL runs in schema pms_test (ADR-040) |
| 14.09.2026 13:05 | integration | ✅ 18 из 18 | 3 мин 22 с | 76f729b +12 | [лог](logs/2026-09-14T08-05-03Z-integration-7879.log) | autotests in schema pms_test (ADR-040): full integration set with search_path |
| 14.09.2026 13:08 | e2e (частично: --workers=1) | ✅ 23 из 23 | 11 мин 5 с | 76f729b +14 | [лог](logs/2026-09-14T08-08-54Z-e2e-5481.log) | autotests in schema pms_test (ADR-040): isolated stand 3100/3101, full run |
| 14.09.2026 13:37 | unit (частично: packages/database/src/pool-timeouts.test.ts) | ❌ упало 4 из 5 | 14 с | 1cb30bb +1 | [лог](logs/2026-09-14T08-37-50Z-unit-a783.log) | ADR-043 red: pool timeouts on current createPrismaClient (no bounds) |
| 14.09.2026 13:38 | unit (частично: packages/database/src/pool-timeouts.test.ts) | ❌ упало 1 из 5 | 4 с | 1cb30bb +2 | [лог](logs/2026-09-14T08-38-51Z-unit-4cc5.log) | ADR-043 experiment: pg built-in query_timeout + connectionTimeoutMillis + keepAlive only (expected: transaction test still red) |
| 14.09.2026 13:40 | unit (частично: packages/database/src/pool-timeouts.test.ts) | ✅ 5 из 5 | 4 с | 1cb30bb +3 | [лог](logs/2026-09-14T08-40-41Z-unit-af06.log) | ADR-043 green: connection closed on query silence, connect/acquire bound, keepAlive |
| 14.09.2026 13:41 | unit | ✅ 729 из 729 | 14 с | 1cb30bb +4 | [лог](logs/2026-09-14T08-41-36Z-unit-a897.log) | ADR-043 full unit after pool timeouts (worktree claude/elated-noether-e3dda0 on main 1cb30bb) |
| 14.09.2026 13:41 | typecheck | ❌ ошибок: 1 | 8 с | 1cb30bb +4 | [лог](logs/2026-09-14T08-41-58Z-typecheck-f279.log) | ADR-043 pool timeouts |
| 14.09.2026 13:42 | typecheck | ✅ без ошибок | 5 с | 1cb30bb +4 | [лог](logs/2026-09-14T08-42-24Z-typecheck-ee12.log) | ADR-043 pool timeouts (after test typing fix) |
| 14.09.2026 13:42 | lint | ✅ без ошибок | 5 с | 1cb30bb +4 | [лог](logs/2026-09-14T08-42-29Z-lint-4e70.log) | ADR-043 pool timeouts |
| 14.09.2026 13:45 | unit | ✅ 729 из 729 | 13 с | 1cb30bb +4 | [лог](logs/2026-09-14T08-45-53Z-unit-ee5c.log) | ADR-043 final code: full unit after test typing fix |
| 14.09.2026 13:19 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 2 из 9 | 1 с | 76f729b +18 | [лог](logs/2026-09-14T08-19-24Z-unit-6cda.log) | red: Exely seat swaps and chains do not converge in import (system trace 14.09: 13 stays on other beds) |
| 14.09.2026 13:19 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ✅ 9 из 9 | 1 с | 76f729b +18 | [лог](logs/2026-09-14T08-19-54Z-unit-60e6.log) | green: import plans Exely seats for the whole batch (swaps and chains converge, incumbent keeps a double-sold bed) |
| 14.09.2026 13:30 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 2 из 11 | 1 с | 1cb30bb +7 | [лог](logs/2026-09-14T08-30-33Z-unit-1380.log) | red: batch seating must not unseat a stay for a neighbour when the Exely seat is taken on past nights (live rehearsal 14.09: unseated 2 -> 4) |
| 14.09.2026 13:32 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ✅ 11 из 11 | 1 с | 1cb30bb +7 | [лог](logs/2026-09-14T08-32-08Z-unit-b1f6.log) | green: batch seating never unseats a stay; swaps, cycles and chains converge when the Exely seat is really free |
| 14.09.2026 13:44 | unit | ✅ 740 из 740 | 14 с | 1cb30bb +7 | [лог](logs/2026-09-14T08-44-12Z-unit-02fa.log) | full unit after batch Exely seating (seat-plan.ts) and system trace check |
| 14.09.2026 12:54 | unit (частично: scripts/reconciliation/src/system-trace.test.ts) | ✅ 9 из 9 | 1 с | 9ce7b2f +16 | [лог](logs/2026-09-14T07-54-24Z-unit-4592.log) | system trace: WETOP HTML parsing and layer comparison (new check, owner request 14.09) |
| 14.09.2026 14:17 | typecheck | ✅ без ошибок | 6 с | 38eab10 +2 | [лог](logs/2026-09-14T09-17-38Z-typecheck-f729.log) | ADR-043 drill: export databasePoolTimeouts, scripts/ops/db-dead-connection-drill.ts (after merging main d6d1d30) |
| 14.09.2026 14:17 | lint | ✅ без ошибок | 5 с | 38eab10 +2 | [лог](logs/2026-09-14T09-17-45Z-lint-f3b8.log) | ADR-043 drill: export databasePoolTimeouts, scripts/ops/db-dead-connection-drill.ts (after merging main d6d1d30) |
| 14.09.2026 14:17 | unit | ✅ 749 из 749 | 13 с | 38eab10 +2 | [лог](logs/2026-09-14T09-17-50Z-unit-2652.log) | ADR-043 drill: export databasePoolTimeouts, scripts/ops/db-dead-connection-drill.ts (after merging main d6d1d30) |
| 14.09.2026 14:20 | lint | ✅ без ошибок | 4 с | 95d9300 +1 | [лог](logs/2026-09-14T09-20-43Z-lint-7c99.log) | ADR-043 drill: handshake sniff (TLS or plaintext to pooler) |
| 14.09.2026 14:24 | lint | ✅ без ошибок | 5 с | deee9ac +1 | [лог](logs/2026-09-14T09-24-05Z-lint-703a.log) | ADR-043 drill: auth method of the pooler reply |
| 14.09.2026 14:28 | typecheck | ✅ без ошибок | 9 с | 2e852cd +1 | [лог](logs/2026-09-14T09-28-01Z-typecheck-91a0.log) | ADR-043 pool.ts comment (TLS wording) after drill |
| 14.09.2026 14:28 | lint | ✅ без ошибок | 5 с | 2e852cd +1 | [лог](logs/2026-09-14T09-28-10Z-lint-1b2f.log) | ADR-043 pool.ts comment (TLS wording) after drill |
| 14.09.2026 14:28 | unit | ✅ 749 из 749 | 12 с | 2e852cd +1 | [лог](logs/2026-09-14T09-28-16Z-unit-dcec.log) | ADR-043 pool.ts comment (TLS wording) after drill |
| 14.09.2026 14:23 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 4 из 17 | 1 с | deee9ac +3 | [лог](logs/2026-09-14T09-23-23Z-unit-f0cb.log) | red: ADR-044 move inside the stay onto the Exely seat (planner in segments, rule not implemented yet) |
| 14.09.2026 14:25 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 1 из 17 | 1 с | deee9ac +3 | [лог](logs/2026-09-14T09-25-03Z-unit-7905.log) | green: ADR-044 seats a stay with one move onto the Exely seat when the move already happened |
| 14.09.2026 14:26 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 1 из 17 | 1 с | 2e852cd +3 | [лог](logs/2026-09-14T09-26-13Z-unit-3b36.log) | green: ADR-044 targets rotate in cycles (a stay moving inside its stay swaps with a neighbour) |
| 14.09.2026 14:27 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ✅ 17 из 17 | 1 с | 2e852cd +3 | [лог](logs/2026-09-14T09-27-32Z-unit-7f4f.log) | green: ADR-044 settled neighbours and past nights block the Exely seat, movable neighbours do not |
| 14.09.2026 14:31 | integration (частично: tests/integration/reservations-import.test.ts) | ✅ 5 из 5 | 2 мин 8 с | 2e852cd +4 | [лог](logs/2026-09-14T09-31-38Z-integration-719f.log) | ADR-044 in the importer on a real database (pms_test): move inside the stay, two beds with one move, repeat unchanged |
| 14.09.2026 14:34 | integration (частично: tests/integration/reservations-import.test.ts -t ADR-044\|Q-120) | ❌ упало 2 из 5, пропущено 3 | 41 с | 2e852cd +2 | [лог](logs/2026-09-14T09-34-16Z-integration-9a75.log) | red: ADR-044 integration cases on the committed importer (4f34a45 seating, no move inside the stay) |
| 14.09.2026 14:39 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 1 из 19 | 1 с | 815813c +4 | [лог](logs/2026-09-14T09-39-18Z-unit-b777.log) | red: ADR-044 group rotation — two neighbours free the Exely seat on different nights (live case 14.09) |
| 14.09.2026 14:39 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ✅ 19 из 19 | 1 с | 815813c +4 | [лог](logs/2026-09-14T09-39-38Z-unit-168d.log) | green: ADR-044 closed groups rotate together (cycles, fans, chains over several rounds) |
| 14.09.2026 14:43 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ❌ упало 1 из 20 | 1 с | 8fdabe6 +4 | [лог](logs/2026-09-14T09-43-12Z-unit-cd0f.log) | red: ADR-044 nine-booking live chain — goals must see history nights of neighbours moving in the same group |
| 14.09.2026 14:43 | unit (частично: scripts/imports/src/exely/seat-plan.test.ts) | ✅ 20 из 20 | 1 с | 8fdabe6 +4 | [лог](logs/2026-09-14T09-43-41Z-unit-f2c1.log) | green: ADR-044 group goals see history nights of neighbours moving in the same group (nine-booking live chain) |
| 14.09.2026 14:44 | unit (частично: apps/api/src/reservations/rate-plans-read.test.ts) | ❌ упало 1 из 1 | 1 с | 8fdabe6 +5 | [лог](logs/2026-09-14T09-44-31Z-unit-e3fc.log) | B9 red: rate plans lookup must not need a transaction |
| 14.09.2026 14:46 | unit (частично: apps/api/src/reservations/rate-plans-read.test.ts apps/api/src/reservations/reservations.controller.test.ts apps/api/src/web-booking/web-booking | ✅ 53 из 53 | 2 с | 8fdabe6 +11 | [лог](logs/2026-09-14T09-46-10Z-unit-ee86.log) | B9 green: rate plans and widget quote read without a transaction |
| 14.09.2026 14:46 | unit | ✅ 759 из 759 | 12 с | 8fdabe6 +13 | [лог](logs/2026-09-14T09-46-46Z-unit-04db.log) | full unit with ADR-044 seating (move inside the stay) in the Exely import |
| 14.09.2026 14:46 | integration (частично: tests/integration/reservations-import.test.ts) | ✅ 5 из 5 | 2 мин 12 с | 8fdabe6 +14 | [лог](logs/2026-09-14T09-46-58Z-integration-2620.log) | green: ADR-044 importer on a real database (pms_test) with group rotation planner |
| 14.09.2026 14:52 | unit (частично: apps/api/src/channels/outbox.test.ts apps/api/src/rates/rates.controller.test.ts) | ❌ упало 7 из 17 | 1 с | eb1e3f5 +3 | [лог](logs/2026-09-14T09-52-19Z-unit-9044.log) | B3 B4 B5 red: occupancy price to channels, zero price and min stay 0, Channex warnings, rates+outbox atomic |
| 14.09.2026 14:54 | unit (частично: apps/api/src/channels/outbox.test.ts apps/api/src/rates/rates.controller.test.ts apps/api/src/channels apps/api/src/rates apps/api/src/guard) | ✅ 136 из 136 | 2 с | eb1e3f5 +8 | [лог](logs/2026-09-14T09-54-53Z-unit-d64b.log) | B3 B4 B5 green: channel rate only for category capacity, zero price rejected, min/max stay 0 = none, Channex warnings kept, rates+audit+outbox in one transactio |
| 14.09.2026 14:55 | unit (частично: apps/api/src/channels apps/api/src/rates apps/api/src/guard apps/api/src/reservations apps/api/src/web-booking) | ✅ 165 из 165 | 2 с | eb1e3f5 +8 | [лог](logs/2026-09-14T09-55-48Z-unit-43cf.log) | B3 B4 B5 green on final code: channels, rates, guard, reservations, web-booking |
| 14.09.2026 14:58 | integration (частично: tests/integration/reservation-capacity.test.ts) | ❌ упало 1 из 1 | 26 с | 917c303 +1 | [лог](logs/2026-09-14T09-58-23Z-integration-59f7.log) | B2 red: places without a unit counted one by one — category oversold |
| 14.09.2026 15:01 | unit (частично: apps/api/src/reservations apps/api/src/channels apps/api/src/web-booking) | ✅ 126 из 126 | 2 с | 917c303 +11 | [лог](logs/2026-09-14T10-01-19Z-unit-220e.log) | B2 unit regression: reservations, channels, web-booking with category locks |
| 14.09.2026 15:01 | integration (частично: tests/integration/reservation-capacity.test.ts tests/integration/manual-reservation.test.ts) | ❌ упало 1 из 2 | 1 мин 17 с | 917c303 +5 | [лог](logs/2026-09-14T10-01-47Z-integration-4853.log) | B2 green: places of one booking counted together per category, category advisory lock, no unit given twice |
| 14.09.2026 15:04 | integration (частично: tests/integration/reservation-capacity.test.ts) | ❌ упало 1 из 1 | 26 с | 551c575 +3 | [лог](logs/2026-09-14T10-04-13Z-integration-4bad.log) | B2 red on committed code (corrected test: category of 2 units, 3 unassigned places) |
| 14.09.2026 15:04 | integration (частично: tests/integration/reservation-capacity.test.ts tests/integration/manual-reservation.test.ts) | ✅ 2 из 2 | 1 мин 21 с | 551c575 +5 | [лог](logs/2026-09-14T10-04-49Z-integration-57e8.log) | B2 green: places of one booking counted together per category, category advisory lock, no unit given twice |
| 14.09.2026 15:10 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/reservation-tariff.spec.ts --workers=1) | ❌ упало 2 из 2 | 42 с | 4307510 +35 | [лог](logs/2026-09-14T10-10-39Z-e2e-73db.log) | B1 B8 red: date change sends the first tariff; extend without tariff has no tariff choice |
| 14.09.2026 15:14 | unit (частично: apps/api/src/reservations apps/api/src/channels apps/api/src/chessboard apps/api/src/web-booking apps/web/src) | ✅ 191 из 191 | 7 с | 4307510 +44 | [лог](logs/2026-09-14T10-14-24Z-unit-fe71.log) | B1 B8: card items carry their tariff; unit regression api + web |
| 14.09.2026 15:14 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/reservation-tariff.spec.ts --workers=1) | ✅ 2 из 2 | 11 с | 4307510 +46 | [лог](logs/2026-09-14T10-14-31Z-e2e-5e42.log) | B1 B8 green: date change keeps the booking tariff; no-tariff stays ask for a tariff (dates, +1 night) |
| 14.09.2026 15:14 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts tests/ui/payment-draft.spec.ts --workers=1) | ❌ упало 2 из 33 | 7 мин 35 с | 4307510 +46 | [лог](logs/2026-09-14T10-14-54Z-e2e-579b.log) | B1 B8 regression: workspace, premium, payment draft UI after card tariff fields |
| 14.09.2026 15:22 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts --workers=1) | ❌ упало 2 из 6 | 7 мин 36 с | 4307510 +47 | [лог](logs/2026-09-14T10-22-59Z-e2e-cff1.log) | B1 B8 regression rerun: premium UI spec alone (drawer, themes) on the same code |
| 14.09.2026 15:48 | unit (частично: apps/api/src/finance/finance.controller.test.ts) | ❌ упало 1 из 10 | 1 мин 46 с | d3394a9 +39 | [лог](logs/2026-09-14T10-48-20Z-unit-c64c.log) | B7 red: voiding a late check-out charge leaves the neighbour night blocked |
| 14.09.2026 15:52 | unit (частично: apps/api/src/finance apps/api/src/units apps/api/src/reservations) | ✅ 33 из 33 | 2 с | d3394a9 +40 | [лог](logs/2026-09-14T10-52-09Z-unit-27f4.log) | B7 green: voiding a stay-extra charge releases its neighbour-night block through the unit command |
| 14.09.2026 15:54 | unit (частично: apps/api/src/reservations/reservations.controller.test.ts apps/web/src/lib/api.test.ts) | ❌ упало 2 из 30 | 2 с | 54a083b +39 | [лог](logs/2026-09-14T10-54-36Z-unit-eaca.log) | B6 red: committed booking answered 500 when the channel delta failed; 5xx on a command shows raw Internal server error |
| 14.09.2026 15:56 | unit (частично: apps/api/src/reservations apps/api/src/units apps/api/src/finance apps/api/src/channels apps/api/src/web-booking apps/web/src/lib) | ✅ 154 из 154 | 2 с | 54a083b +43 | [лог](logs/2026-09-14T10-56-03Z-unit-6d46.log) | B6 green: channel delta after commit never turns a committed command into 500; 5xx on a command asks to check before retrying |
| 14.09.2026 15:59 | unit (частично: apps/site/src/lib/posts.test.ts) | ✅ 10 из 10 | 1 с | b7e0674 +37 | [лог](logs/2026-09-14T10-59-10Z-unit-88d1.log) | wetop.ai landing: blog front matter parser — required fields, date format, drafts excluded, README skipped |
| 14.09.2026 15:59 | unit (частично: apps/site/src/lib/posts.test.ts) | ✅ 10 из 10 | 1 с | b7e0674 +37 | [лог](logs/2026-09-14T10-59-35Z-unit-13f8.log) | wetop.ai landing after prettier: blog parser tests on final code |
| 14.09.2026 16:01 | unit (частично: apps/api/src/web-booking/web-booking.controller.test.ts) | ❌ упало 1 из 11 | 1 с | 0fa4c28 +2 | [лог](logs/2026-09-14T11-01-48Z-unit-a5b5.log) | D3 red: behind the tunnel every visitor shares 127.0.0.1 — booking limit is global |
| 14.09.2026 16:02 | unit (частично: apps/api/src/web-booking) | ✅ 11 из 11 | 1 с | 0fa4c28 +4 | [лог](logs/2026-09-14T11-02-28Z-unit-5963.log) | D3 green: booking limits count the visitor from CF-Connecting-IP when the request comes through the tunnel |
| 14.09.2026 16:04 | unit (частично: apps/api/src/channels/webhook-health.test.ts apps/api/src/channels/schedule.test.ts) | ❌ упало 2 из 35 | 1 с | 0fa4c28 +6 | [лог](logs/2026-09-14T11-04-58Z-unit-2d9a.log) | D4 red: webhook registered at a non-permanent address counts as fine; a login redirect counts as a live address |
| 14.09.2026 16:06 | unit (частично: apps/api/src/channels apps/api/src/guard apps/api/src/web-booking) | ✅ 136 из 136 | 2 с | 0fa4c28 +9 | [лог](logs/2026-09-14T11-06-26Z-unit-c687.log) | D3 D4 green: visitor IP from CF-Connecting-IP via tunnel; webhook secret constant-time; wrong registered address and login redirect are not a live webhook |
| 14.09.2026 16:08 | unit (частично: apps/api/src/channels/channels.controller.test.ts) | ❌ упало 1 из 5 | 3 с | 6df2c54 +2 | [лог](logs/2026-09-14T11-08-39Z-unit-dac5.log) | D1 red: with a permanent PUBLIC_API_URL the quick tunnel could still re-register the webhook to itself |
| 14.09.2026 16:09 | unit (частично: apps/api/src/channels) | ✅ 99 из 99 | 1 с | 6df2c54 +3 | [лог](logs/2026-09-14T11-09-13Z-unit-f4a3.log) | D1 green: with PUBLIC_API_URL set the webhook registers only to the permanent address |
| 14.09.2026 16:13 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/login-access.spec.ts --workers=1) | ❌ упало 1 из 2 | 23 с | 354979c +2 | [лог](logs/2026-09-14T11-13-02Z-e2e-e50d.log) | D5 red: behind Cloudflare Access the login screen still shows a password form and no identity/logout |
| 14.09.2026 16:14 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/login-access.spec.ts tests/ui/premium.spec.ts --workers=1) | ❌ упало 1 из 8 | 42 с | 354979c +5 | [лог](logs/2026-09-14T11-14-07Z-e2e-1f7c.log) | D5 green: login behind Access shows identity and logout; old login screen and premium UI unchanged |
| 14.09.2026 16:15 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ❌ упало 1 из 1 | 7 с | 354979c +5 | [лог](logs/2026-09-14T11-15-13Z-e2e-e100.log) | D5 rerun: premium rooms filters test alone (strict-mode duplicate select during streaming) |
| 14.09.2026 16:16 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ❌ упало 1 из 1 | 7 с | 354979c +5 | [лог](logs/2026-09-14T11-16-22Z-e2e-2bd5.log) | D5 bisect: rooms filters test with poweredByHeader only (no experimental.serverActions) |
| 14.09.2026 16:16 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ❌ упало 1 из 1 | 7 с | 354979c +4 | [лог](logs/2026-09-14T11-16-52Z-e2e-3272.log) | D5 bisect: rooms filters test with HEAD next.config, try 1 |
| 14.09.2026 16:16 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ✅ 1 из 1 | 6 с | 354979c +4 | [лог](logs/2026-09-14T11-16-59Z-e2e-8c53.log) | D5 bisect: rooms filters test with HEAD next.config, try 2 |
| 14.09.2026 16:17 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ❌ упало 1 из 1 | 7 с | 354979c +5 | [лог](logs/2026-09-14T11-17-05Z-e2e-66bc.log) | D5 bisect: rooms filters test with new next.config, try 1 |
| 14.09.2026 16:17 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ❌ упало 1 из 1 | 6 с | 354979c +5 | [лог](logs/2026-09-14T11-17-12Z-e2e-9ed1.log) | D5 bisect: rooms filters test with new next.config, try 2 |
| 14.09.2026 16:17 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ✅ 1 из 1 | 7 с | 354979c +6 | [лог](logs/2026-09-14T11-17-49Z-e2e-abb1.log) | rooms filters UI test scoped to main (hidden streaming copy), new next.config, try 1 |
| 14.09.2026 16:17 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ✅ 1 из 1 | 6 с | 354979c +6 | [лог](logs/2026-09-14T11-17-56Z-e2e-9c49.log) | rooms filters UI test scoped to main (hidden streaming copy), new next.config, try 2 |
| 14.09.2026 16:18 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts:88 --workers=1) | ✅ 1 из 1 | 6 с | 354979c +6 | [лог](logs/2026-09-14T11-18-02Z-e2e-74fb.log) | rooms filters UI test scoped to main (hidden streaming copy), new next.config, try 3 |
| 14.09.2026 16:22 | unit (частично: apps/api/src/channels/connection.test.ts) | ❌ упало 1 из 10 | 1 с | d9a97e7 +2 | [лог](logs/2026-09-14T11-22-59Z-unit-5e3a.log) | wave 3 red: connections 'last import' reads an audit action nobody writes |
| 14.09.2026 16:24 | unit (частично: apps/api/src/channels/channels.controller.test.ts) | ❌ упало 1 из 6 | 16 с | d9a97e7 +4 | [лог](logs/2026-09-14T11-24-15Z-unit-3951.log) | wave 3 red: webhook status waits on a silent Channex indefinitely (connections page hangs) |
| 14.09.2026 16:25 | unit (частично: apps/api/src/channels) | ✅ 101 из 101 | 2 с | d9a97e7 +5 | [лог](logs/2026-09-14T11-25-09Z-unit-fa93.log) | wave 3 green: connections last import from pull events; webhook status bounded 504 instead of hanging |
| 14.09.2026 16:26 | unit (частично: apps/api/src/audit/audit.service.test.ts) | ❌ упало 2 из 2 | 1 с | 1aad24e +2 | [лог](logs/2026-09-14T11-26-54Z-unit-9992.log) | wave 3 red: journal search only over last 200 rows, exely.sync floods the list |
| 14.09.2026 16:27 | unit (частично: apps/api/src/audit) | ✅ 2 из 2 | 1 с | 1aad24e +4 | [лог](logs/2026-09-14T11-27-57Z-unit-e16a.log) | wave 3 green: journal searches the whole history in the database, exely.sync hidden unless asked |
| 14.09.2026 16:29 | unit (частично: apps/web/src/lib/almaty.test.ts) | ❌ код выхода 1 | 1 с | d6be239 +2 | [лог](logs/2026-09-14T11-29-56Z-unit-6bc5.log) | wave 3 red: payment and refund dates on the booking card are cut from UTC (night payments show yesterday) |
| 14.09.2026 16:30 | unit (частично: apps/web/src) | ✅ 61 из 61 | 1 с | d6be239 +5 | [лог](logs/2026-09-14T11-30-18Z-unit-28c4.log) | wave 3 green: payment/refund dates by Almaty day; freshness warns after 15 min (sync every 5 min) |
| 15.09.2026 16:35 | typecheck | ✅ без ошибок | 16 с | 002173a +1 | [лог](logs/2026-09-15T11-35-58Z-typecheck-933d.log) |  |
| 15.09.2026 16:36 | lint | ✅ без ошибок | 11 с | 002173a +1 | [лог](logs/2026-09-15T11-36-21Z-lint-d8a9.log) |  |
| 15.09.2026 16:36 | unit | ✅ 788 из 788 | 19 с | 002173a +1 | [лог](logs/2026-09-15T11-36-38Z-unit-a926.log) |  |
| 15.09.2026 16:37 | e2e (частично: --workers=1) | ❌ упало 20 из 23, пропущено 2 | 1 мин 16 с | 002173a +1 | [лог](logs/2026-09-15T11-37-08Z-e2e-31ee.log) | отмена заранее — без штрафа, незаезд — со штрафом за первую ночь, стойка может его снять |
| 15.09.2026 16:44 | unit | ✅ 790 из 790 | 18 с | 527908e +3 | [лог](logs/2026-09-15T11-44-32Z-unit-e138.log) |  |
| 15.09.2026 16:45 | typecheck | ✅ без ошибок | 34 с | 527908e +3 | [лог](logs/2026-09-15T11-45-03Z-typecheck-ae88.log) |  |
| 15.09.2026 16:45 | lint | ✅ без ошибок | 28 с | 527908e +3 | [лог](logs/2026-09-15T11-45-43Z-lint-66c1.log) |  |
| 15.09.2026 16:46 | e2e | ❌ упало 2 из 23 | 9 мин 38 с | 527908e +3 | [лог](logs/2026-09-15T11-46-56Z-e2e-7e89.log) | перетаскивание клетки брони на свободную койку той же категории переселяет с даты клетки |
| 15.09.2026 16:44 | e2e (частично: --workers=1) | ❌ упало 3 из 23 | 15 мин 47 с | 527908e +3 | [лог](logs/2026-09-15T11-44-58Z-e2e-f8d4.log) | заселить → карточка и шахматка показывают «заселён» → выселить; незаезд освобождает ячейку |
| 15.09.2026 17:02 | e2e (частично: --workers=1 tests/e2e/check-in-out.spec.ts tests/e2e/chessboard-drag.spec.ts tests/e2e/full-day.spec.ts) | ✅ 4 из 4 | 4 мин 8 с | 527908e +3 | [лог](logs/2026-09-15T12-02-42Z-e2e-0f89.log) |  |
| 15.09.2026 17:24 | unit | ✅ 793 из 793 | 45 с | e0a9f7e +3 | [лог](logs/2026-09-15T12-24-26Z-unit-b8a7.log) |  |
| 15.09.2026 17:25 | typecheck | ✅ без ошибок | 13 с | e0a9f7e +3 | [лог](logs/2026-09-15T12-25-18Z-typecheck-8e9c.log) |  |
| 15.09.2026 17:25 | lint | ✅ без ошибок | 10 с | e0a9f7e +3 | [лог](logs/2026-09-15T12-25-32Z-lint-3d25.log) |  |
| 15.09.2026 20:25 | unit | ✅ 795 из 795 | 42 с | 0f6466c +7 | [лог](logs/2026-09-15T15-25-21Z-unit-71db.log) |  |
| 15.09.2026 20:26 | typecheck | ✅ без ошибок | 8 с | 0f6466c +7 | [лог](logs/2026-09-15T15-26-03Z-typecheck-1137.log) |  |
| 15.09.2026 20:26 | lint | ✅ без ошибок | 5 с | 0f6466c +7 | [лог](logs/2026-09-15T15-26-12Z-lint-5a9c.log) |  |
| 15.09.2026 20:30 | e2e (частично: --workers=1) | ✅ 23 из 23 | 12 мин 33 с | 937e47b +1 | [лог](logs/2026-09-15T15-30-04Z-e2e-9242.log) |  |
| 15.09.2026 20:42 | unit | ✅ 800 из 800 | 43 с | 937e47b +4 | [лог](logs/2026-09-15T15-42-56Z-unit-b983.log) |  |
| 15.09.2026 20:43 | typecheck | ✅ без ошибок | 8 с | 937e47b +4 | [лог](logs/2026-09-15T15-43-40Z-typecheck-8fd0.log) |  |
| 15.09.2026 20:43 | lint | ✅ без ошибок | 7 с | 937e47b +4 | [лог](logs/2026-09-15T15-43-48Z-lint-3fcc.log) |  |
| 15.09.2026 20:47 | unit | ✅ 804 из 804 | 43 с | 7a0a9be +4 | [лог](logs/2026-09-15T15-47-17Z-unit-00d2.log) |  |
| 15.09.2026 20:48 | typecheck | ✅ без ошибок | 8 с | 7a0a9be +4 | [лог](logs/2026-09-15T15-48-01Z-typecheck-04f7.log) |  |
| 15.09.2026 20:48 | lint | ✅ без ошибок | 6 с | 7a0a9be +4 | [лог](logs/2026-09-15T15-48-09Z-lint-528e.log) |  |
| 15.09.2026 20:54 | unit | ✅ 806 из 806 | 45 с | 0e924c0 +3 | [лог](logs/2026-09-15T15-54-22Z-unit-e196.log) |  |
| 15.09.2026 20:55 | typecheck | ✅ без ошибок | 9 с | 0e924c0 +3 | [лог](logs/2026-09-15T15-55-07Z-typecheck-6a8d.log) |  |
| 15.09.2026 20:55 | lint | ✅ без ошибок | 6 с | 0e924c0 +3 | [лог](logs/2026-09-15T15-55-17Z-lint-4589.log) |  |
| 15.09.2026 20:52 | e2e | ✅ 23 из 23 | 7 мин 4 с | 0e924c0 +1 | [лог](logs/2026-09-15T15-52-14Z-e2e-8246.log) |  |
| 15.09.2026 21:00 | e2e | ✅ 23 из 23 | 11 мин 43 с | 4971836 +1 | [лог](logs/2026-09-15T16-00-41Z-e2e-10ef.log) |  |
| 15.09.2026 21:12 | integration | ✅ 21 из 21 | 4 мин 44 с | 4971836 | [лог](logs/2026-09-15T16-12-44Z-integration-6a86.log) |  |
| 15.09.2026 21:38 | unit | ✅ 809 из 809 | 42 с | aa92492 +4 | [лог](logs/2026-09-15T16-38-47Z-unit-47c8.log) |  |
| 15.09.2026 21:39 | typecheck | ✅ без ошибок | 7 с | aa92492 +4 | [лог](logs/2026-09-15T16-39-30Z-typecheck-08d5.log) |  |
| 15.09.2026 21:39 | lint | ✅ без ошибок | 5 с | aa92492 +4 | [лог](logs/2026-09-15T16-39-37Z-lint-eef9.log) |  |
| 15.09.2026 21:50 | e2e (частично: --workers=1 tests/e2e/desk-day.spec.ts) | ✅ 2 из 2 | 1 мин 5 с | 09470aa +5 | [лог](logs/2026-09-15T16-50-56Z-e2e-2056.log) |  |
| 15.09.2026 21:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --workers=1) | ✅ 25 из 25 | 1 мин 6 с | 09470aa +5 | [лог](logs/2026-09-15T16-52-13Z-e2e-a9eb.log) |  |
| 16.09.2026 00:54 | unit | ❌ упало 3 из 591 | 1 мин 34 с | c22f3fa +2 | [лог](logs/2026-09-15T19-54-16Z-unit-582c.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 00:56 | unit | ❌ упало 3 из 814 | 1 мин 32 с | c22f3fa +2 | [лог](logs/2026-09-15T19-56-17Z-unit-42ac.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 00:58 | typecheck | ✅ без ошибок | 18 с | c22f3fa +2 | [лог](logs/2026-09-15T19-58-02Z-typecheck-18b1.log) |  |
| 16.09.2026 00:58 | lint | ✅ без ошибок | 10 с | c22f3fa +2 | [лог](logs/2026-09-15T19-58-21Z-lint-1989.log) |  |
| 16.09.2026 01:37 | unit | ❌ упало 3 из 882 | 1 мин 32 с | 7c96e0f +49 | [лог](logs/2026-09-15T20-37-49Z-unit-c9dc.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 01:39 | typecheck | ✅ без ошибок | 17 с | 7c96e0f +50 | [лог](logs/2026-09-15T20-39-31Z-typecheck-7f3c.log) |  |
| 16.09.2026 01:39 | lint | ✅ без ошибок | 11 с | 7c96e0f +50 | [лог](logs/2026-09-15T20-39-49Z-lint-9ddd.log) |  |
| 16.09.2026 01:40 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/login-access.spec.ts --workers=1) | ❌ упало 5 из 5 | 12 с | 7c96e0f +50 | [лог](logs/2026-09-15T20-40-18Z-e2e-b720.log) | форма входа просит почту и пароль |
| 16.09.2026 01:57 | typecheck | ✅ без ошибок | 22 с | 7c96e0f +50 | [лог](logs/2026-09-15T20-57-33Z-typecheck-7e5b.log) |  |
| 16.09.2026 01:58 | unit | ❌ упало 3 из 882 | 1 мин 32 с | 7c96e0f +48 | [лог](logs/2026-09-15T20-58-02Z-unit-8789.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 01:59 | lint | ✅ без ошибок | 12 с | 7c96e0f +50 | [лог](logs/2026-09-15T20-59-34Z-lint-4df1.log) |  |
| 16.09.2026 01:59 | e2e (частично: --config /tmp/claude-0/-home-user-wetop-ai/d53a306b-407f-54a0-b7fa-92247464fd59/scratchpad/ui-local.config.ts login-access --workers=1) | ✅ 5 из 5 | 14 с | 7c96e0f +50 | [лог](logs/2026-09-15T20-59-52Z-e2e-1338.log) |  |
| 16.09.2026 02:00 | unit | ❌ упало 3 из 882 | 1 мин 32 с | af2dea7 | [лог](logs/2026-09-15T21-00-59Z-unit-c6b3.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 02:02 | e2e (частично: --config /tmp/claude-0/-home-user-wetop-ai/d53a306b-407f-54a0-b7fa-92247464fd59/scratchpad/ui-local.config.ts login-access --workers=1) | ✅ 5 из 5 | 13 с | af2dea7 | [лог](logs/2026-09-15T21-02-31Z-e2e-79d1.log) |  |
| 16.09.2026 02:22 | unit | ❌ упало 3 из 915 | 1 мин 32 с | e06f7f4 +26 | [лог](logs/2026-09-15T21-22-10Z-unit-789b.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 02:23 | typecheck | ✅ без ошибок | 21 с | e06f7f4 +27 | [лог](logs/2026-09-15T21-23-48Z-typecheck-0b58.log) |  |
| 16.09.2026 02:24 | lint | ✅ без ошибок | 9 с | e06f7f4 +27 | [лог](logs/2026-09-15T21-24-10Z-lint-b8c5.log) |  |
| 16.09.2026 02:35 | e2e (частично: --config /tmp/claude-0/-home-user-wetop-ai/d53a306b-407f-54a0-b7fa-92247464fd59/scratchpad/ui-local.config.ts password-reset --workers=1) | ✅ 7 из 7 | 14 с | 976f221 | [лог](logs/2026-09-15T21-35-36Z-e2e-ac57.log) |  |
| 16.09.2026 02:48 | unit | ❌ упало 3 из 930 | 1 мин 32 с | 897fa80 +21 | [лог](logs/2026-09-15T21-48-31Z-unit-0fff.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 02:50 | typecheck | ✅ без ошибок | 20 с | 897fa80 +22 | [лог](logs/2026-09-15T21-50-10Z-typecheck-c71a.log) |  |
| 16.09.2026 02:50 | lint | ✅ без ошибок | 10 с | 897fa80 +22 | [лог](logs/2026-09-15T21-50-31Z-lint-42f7.log) |  |
| 15.09.2026 22:00 | unit | ✅ 809 из 809 | 42 с | c22f3fa +19 | [лог](logs/2026-09-15T17-00-54Z-unit-821f.log) |  |
| 15.09.2026 22:02 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts tests/ui/quality.spec.ts tests/ui/accessibility.spec.t | ❌ упало 4 из 53 | 4 мин 16 с | c22f3fa +23 | [лог](logs/2026-09-15T17-02-59Z-e2e-fd17.log) | доступность всех разделов: light, 1440px |
| 15.09.2026 22:08 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/accessibility.spec.ts --workers=1) | ✅ 8 из 8 | 2 мин 14 с | c22f3fa +24 | [лог](logs/2026-09-15T17-08-21Z-e2e-55b1.log) |  |
| 15.09.2026 22:10 | typecheck | ✅ без ошибок | 9 с | c22f3fa +24 | [лог](logs/2026-09-15T17-10-53Z-typecheck-788c.log) |  |
| 15.09.2026 22:11 | lint | ✅ без ошибок | 5 с | c22f3fa +24 | [лог](logs/2026-09-15T17-11-02Z-lint-6f4d.log) |  |
| 15.09.2026 22:19 | unit | ✅ 809 из 809 | 43 с | c22f3fa +23 | [лог](logs/2026-09-15T17-19-21Z-unit-6112.log) |  |
| 15.09.2026 22:11 | e2e | ✅ 23 из 23 | 11 мин 46 с | c22f3fa +24 | [лог](logs/2026-09-15T17-11-17Z-e2e-8347.log) |  |
| 15.09.2026 22:25 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts --workers=1) | ✅ 31 из 31 | 1 мин 29 с | 0785c76 +4 | [лог](logs/2026-09-15T17-25-18Z-e2e-a1b2.log) |  |
| 15.09.2026 22:27 | e2e | ✅ 23 из 23 | 12 мин 28 с | 0785c76 +4 | [лог](logs/2026-09-15T17-27-03Z-e2e-14c1.log) |  |
| 16.09.2026 02:55 | unit | ✅ 811 из 811 | 43 с | 0785c76 +13 | [лог](logs/2026-09-15T21-55-33Z-unit-7d2c.log) |  |
| 16.09.2026 02:56 | typecheck | ✅ без ошибок | 13 с | 0785c76 +13 | [лог](logs/2026-09-15T21-56-17Z-typecheck-28f4.log) |  |
| 16.09.2026 02:56 | lint | ✅ без ошибок | 9 с | 0785c76 +13 | [лог](logs/2026-09-15T21-56-31Z-lint-4266.log) |  |
| 16.09.2026 02:56 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts tests/ui/quality.spec.ts tests/ui/accessibility.spec.t | ❌ упало 4 из 53 | 7 мин 13 с | 0785c76 +13 | [лог](logs/2026-09-15T21-56-54Z-e2e-70a3.log) | доступность всех разделов: light, 1440px |
| 16.09.2026 03:05 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/accessibility.spec.ts --workers=1) | ✅ 8 из 8 | 4 мин 36 с | 0785c76 +13 | [лог](logs/2026-09-15T22-05-32Z-e2e-37cb.log) |  |
| 16.09.2026 03:30 | typecheck | ✅ без ошибок | 14 с | d78c677 +50 | [лог](logs/2026-09-15T22-30-53Z-typecheck-a658.log) |  |
| 16.09.2026 03:31 | lint | ✅ без ошибок | 10 с | d78c677 +50 | [лог](logs/2026-09-15T22-31-08Z-lint-389e.log) |  |
| 16.09.2026 03:13 | integration | ✅ 21 из 26, пропущено 5 | 5 мин 13 с | b705b0d | [лог](logs/2026-09-15T22-13-31Z-integration-fddb.log) |  |
| 16.09.2026 03:12 | e2e | ❌ упало 10 из 23, пропущено 2 | 6 ч | b705b0d +1 | [лог](logs/2026-09-15T22-12-55Z-e2e-f435.log) | стойка: занятую койку не продать дважды, «+ 1 ночь» и переселение с пересчётом |
| 16.09.2026 11:54 | unit | ✅ 854 из 854 | 43 с | b705b0d +10 | [лог](logs/2026-09-16T06-54-46Z-unit-e2ad.log) |  |
| 16.09.2026 11:51 | integration | ✅ 21 из 26, пропущено 5 | 5 мин 8 с | b705b0d +6 | [лог](logs/2026-09-16T06-51-24Z-integration-f145.log) |  |
| 16.09.2026 11:57 | e2e | ⏹ прерван | 11 мин 51 с | f936676 +7 | [лог](logs/2026-09-16T06-57-00Z-e2e-b598.log) |  |
| 16.09.2026 12:09 | integration | ✅ 26 из 26 | 5 мин 17 с | f936676 +6 | [лог](logs/2026-09-16T07-09-00Z-integration-eca2.log) |  |
| 16.09.2026 12:22 | integration | ❌ код выхода 1 | 4 с | f936676 +18 | [лог](logs/2026-09-16T07-22-20Z-integration-3c85.log) |  |
| 16.09.2026 12:23 | unit | ✅ 872 из 872 | 45 с | f936676 +33 | [лог](logs/2026-09-16T07-23-26Z-unit-3da4.log) | Срез 14: дашборд — домен, API, форматирование |
| 16.09.2026 12:14 | e2e | ⏹ прерван | 38 мин 24 с | f936676 +18 | [лог](logs/2026-09-16T07-14-43Z-e2e-b739.log) |  |
| 16.09.2026 12:24 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 29 мин 28 с | f936676 +35 | [лог](logs/2026-09-16T07-24-41Z-e2e-aff6.log) | Срез 14: главная-дашборд, изолированный UI без БД |
| 16.09.2026 12:55 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 5 из 81 | 16 мин 4 с | f936676 +35 | [лог](logs/2026-09-16T07-55-03Z-e2e-e2bd.log) | Срез 14: главная-дашборд, изолированный UI без БД (повтор после снятия осиротевшего стенда на 3100) |
| 16.09.2026 13:11 | e2e | ❌ упало 4 из 23, пропущено 2 | 17 мин 4 с | f936676 +35 | [лог](logs/2026-09-16T08-11-35Z-e2e-bdb4.log) | клик по занятой клетке открывает карточку брони с проживаниями |
| 16.09.2026 13:29 | e2e (частично: tests/e2e/desk-day.spec.ts --workers=1) | ❌ упало 1 из 2 | 1 мин 55 с | 3d01cb9 +37 | [лог](logs/2026-09-16T08-29-25Z-e2e-e1be.log) | Срез 14: главная-дашборд, заезд виден в счётчике и в «Требуют внимания» (изолированный стенд) |
| 16.09.2026 13:31 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-month.spec.ts tests/ui/chessboard-week.spec.ts tests/ui/workspace.spec.ts --workers=1) | ❌ упало 1 из 42 | 6 мин 40 с | 3d01cb9 +37 | [лог](logs/2026-09-16T08-31-41Z-e2e-0bee.log) | Шахматка: месяц/неделя без переполнения на 768 и 320; подключения: точный локатор факта |
| 16.09.2026 13:38 | e2e (частично: --workers=1 tests/e2e/chessboard.spec.ts tests/e2e/stay-extras.spec.ts tests/e2e/web-analytics.spec.ts) | ✅ 7 из 7 | 2 мин 5 с | 2965fed +37 | [лог](logs/2026-09-16T08-38-46Z-e2e-3ec1.log) |  |
| 16.09.2026 13:58 | e2e (частично: tests/e2e/desk-day.spec.ts --workers=1) | ✅ 2 из 2 | 1 мин 20 с | 34d5752 +38 | [лог](logs/2026-09-16T08-58-20Z-e2e-a854.log) | Срез 14: главная-дашборд, заезд виден в счётчике и в «Требуют внимания» с номером брони (изолированный стенд) |
| 16.09.2026 13:59 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/chessboard-week.spec.ts --workers=1) | ✅ 7 из 7 | 1 мин 35 с | 34d5752 +38 | [лог](logs/2026-09-16T08-59-41Z-e2e-7f0c.log) | Шахматка: подпись ночей тем же цветом, что имя — контраст в тёмной теме |
| 16.09.2026 14:33 | typecheck | ✅ без ошибок | 40 с | 6e58ff3 +8 | [лог](logs/2026-09-16T09-33-12Z-typecheck-6c19.log) |  |
| 16.09.2026 14:33 | lint | ✅ без ошибок | 28 с | 6e58ff3 +8 | [лог](logs/2026-09-16T09-33-55Z-lint-66c8.log) |  |
| 16.09.2026 15:29 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-reference) | ❌ упало 2 из 2 | 7 с | 58af544 +2 | [лог](logs/2026-09-16T10-29-01Z-e2e-a4f6.log) | снимки текущих экранов для дизайн-системы, шаг 1 |
| 16.09.2026 15:29 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-reference) | ✅ 2 из 2 | 43 с | 58af544 +3 | [лог](logs/2026-09-16T10-29-30Z-e2e-ab0f.log) | снимки текущих экранов для дизайн-системы, шаг 1 |
| 16.09.2026 15:31 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-reference) | ✅ 2 из 2 | 35 с | 58af544 +3 | [лог](logs/2026-09-16T10-31-43Z-e2e-8976.log) | снимки для дизайн-системы, шаг 1; отпечаток без next-env.d.ts |
| 16.09.2026 15:43 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-reference) | ✅ 2 из 2 | 35 с | 73aca24 +5 | [лог](logs/2026-09-16T10-43-56Z-e2e-a581.log) | снимки после генерации tokens.css — сравнение с шагом 1 |
| 16.09.2026 15:46 | unit | ❌ упало 3 из 843 | 1 мин 34 с | 73aca24 +6 | [лог](logs/2026-09-16T10-46-42Z-unit-e71a.log) | дизайн-система шаг 2: генератор токенов, контраст, отпечаток без next-env |
| 16.09.2026 15:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-system --update-snapshots) | ❌ упало 3 из 8 | 45 с | 1bbbe4b +15 | [лог](logs/2026-09-16T10-59-02Z-e2e-6403.log) | страница компонентов: первый прогон, эталоны снимаются |
| 16.09.2026 16:01 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-system --update-snapshots) | ✅ 8 из 8 | 41 с | 1bbbe4b +17 | [лог](logs/2026-09-16T11-01-50Z-e2e-fb34.log) | страница компонентов: axe и эталоны после починки tablist и danger-soft |
| 16.09.2026 16:06 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 91 из 91 | 9 мин 10 с | 1bbbe4b +17 | [лог](logs/2026-09-16T11-06-10Z-e2e-9daf.log) | полный UI-набор после шага 4: новые компоненты, страница /design-system, перекраска danger-soft |
| 16.09.2026 16:49 | unit | ❌ упало 4 из 968 | 1 мин 33 с | f42581d +50 | [лог](logs/2026-09-16T11-49-56Z-unit-4e34.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 16:52 | unit | ❌ упало 3 из 968 | 1 мин 32 с | f42581d +50 | [лог](logs/2026-09-16T11-52-12Z-unit-b4c7.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 16.09.2026 16:53 | typecheck | ✅ без ошибок | 17 с | f42581d +50 | [лог](logs/2026-09-16T11-53-48Z-typecheck-c247.log) |  |
| 16.09.2026 16:54 | lint | ✅ без ошибок | 11 с | f42581d +50 | [лог](logs/2026-09-16T11-54-06Z-lint-7fb1.log) |  |
| 16.09.2026 17:02 | unit | ✅ 970 из 973, пропущено 3 | 41 с | b0ff6b2 +3 | [лог](logs/2026-09-16T12-02-26Z-unit-1fd0.log) |  |
| 16.09.2026 17:03 | typecheck | ✅ без ошибок | 13 с | b0ff6b2 +4 | [лог](logs/2026-09-16T12-03-16Z-typecheck-14d1.log) |  |
| 16.09.2026 17:03 | lint | ✅ без ошибок | 9 с | b0ff6b2 +4 | [лог](logs/2026-09-16T12-03-30Z-lint-06b1.log) |  |
| 16.09.2026 17:08 | unit | ✅ 972 из 975, пропущено 3 | 41 с | de1445c +2 | [лог](logs/2026-09-16T12-08-25Z-unit-9a03.log) |  |
| 16.09.2026 17:09 | typecheck | ❌ ошибок: 1 | 13 с | de1445c +4 | [лог](logs/2026-09-16T12-09-11Z-typecheck-364a.log) | TS2769 |
| 16.09.2026 17:09 | lint | ✅ без ошибок | 9 с | de1445c +4 | [лог](logs/2026-09-16T12-09-25Z-lint-0a80.log) |  |
| 16.09.2026 17:10 | typecheck | ✅ без ошибок | 13 с | de1445c +4 | [лог](logs/2026-09-16T12-10-02Z-typecheck-d803.log) |  |
| 16.09.2026 17:10 | lint | ✅ без ошибок | 9 с | de1445c +4 | [лог](logs/2026-09-16T12-10-16Z-lint-c107.log) |  |
| 16.09.2026 17:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 103 из 103 | 9 мин 22 с | f027dc7 | [лог](logs/2026-09-16T12-11-31Z-e2e-bcc9.log) |  |
| 16.09.2026 17:26 | e2e (частично: --config tests/ui/playwright.auth.config.ts) | ✅ 4 из 4 | 10 с | f027dc7 +4 | [лог](logs/2026-09-16T12-26-21Z-e2e-2d0e.log) | стойка с включённым замком: шаг 5 порядка включения |
| 16.09.2026 17:26 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 103 из 103 | 8 мин | f027dc7 +4 | [лог](logs/2026-09-16T12-26-35Z-e2e-6d42.log) |  |
| 16.09.2026 17:34 | unit | ✅ 972 из 975, пропущено 3 | 41 с | f027dc7 +1 | [лог](logs/2026-09-16T12-34-54Z-unit-86a8.log) |  |
| 16.09.2026 17:35 | typecheck | ✅ без ошибок | 18 с | f027dc7 +4 | [лог](logs/2026-09-16T12-35-36Z-typecheck-65f6.log) |  |
| 16.09.2026 17:35 | lint | ✅ без ошибок | 9 с | f027dc7 +4 | [лог](logs/2026-09-16T12-35-54Z-lint-3635.log) |  |
| 16.09.2026 14:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 81 | 20 мин 37 с | 6e58ff3 +7 | [лог](logs/2026-09-16T09-15-37Z-e2e-eee9.log) | Срез 14 + починка шахматки: полный изолированный UI-набор |
| 16.09.2026 14:36 | e2e | ✅ 23 из 23 | 12 мин 39 с | 9b376b6 +7 | [лог](logs/2026-09-16T09-36-35Z-e2e-8599.log) |  |
| 16.09.2026 14:49 | unit | ✅ 872 из 872 | 1 мин 1 с | 9b376b6 +7 | [лог](logs/2026-09-16T09-49-54Z-unit-3465.log) |  |
| 16.09.2026 14:49 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts --workers=1) | ❌ упало 1 из 6 | 4 мин 22 с | 9b376b6 +7 | [лог](logs/2026-09-16T09-49-20Z-e2e-a932.log) | Повтор premium после полного набора: единственный красный — таймаут 180 с и «Нет связи с API» под нагрузкой |
| 16.09.2026 16:43 | integration | ✅ 26 из 26 | 6 мин 9 с | 583045a +6 | [лог](logs/2026-09-16T11-43-35Z-integration-4f79.log) |  |
| 16.09.2026 16:49 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts --workers=1) | ✅ 6 из 6 | 1 мин 1 с | 583045a +7 | [лог](logs/2026-09-16T11-49-50Z-e2e-dee0.log) | Повтор premium на свободной машине: в наборе браузер падал (session closed) при свопе 15 из 16 ГБ |
| 16.09.2026 17:01 | integration | ✅ 26 из 26 | 5 мин 16 с | 3a6a2be +6 | [лог](logs/2026-09-16T12-01-08Z-integration-b23a.log) |  |
| 16.09.2026 17:15 | unit | ❌ упало 1 из 890 | 43 с | d7db160 +10 | [лог](logs/2026-09-16T12-15-35Z-unit-bcd8.log) | scripts/ops/channex-tunnel.sh: постоянный адрес важнее быстрого туннеля в Channex записан одноразовый туннель — работаем как прежде |
| 16.09.2026 17:18 | unit | ✅ 890 из 890 | 1 мин 4 с | 35ede3e +10 | [лог](logs/2026-09-16T12-18-22Z-unit-630b.log) |  |
| 16.09.2026 17:19 | lint | ✅ без ошибок | 13 с | 35ede3e +10 | [лог](logs/2026-09-16T12-19-27Z-lint-e7d0.log) |  |
| 16.09.2026 17:19 | unit (частично: packages/integrations/src/mail) | ✅ 16 из 16 | 2 с | 35ede3e +10 | [лог](logs/2026-09-16T12-19-52Z-unit-278b.log) |  |
| 16.09.2026 17:19 | typecheck | ✅ без ошибок | 20 с | 35ede3e +10 | [лог](logs/2026-09-16T12-19-52Z-typecheck-a874.log) |  |
| 16.09.2026 17:37 | unit | ✅ 974 из 977, пропущено 3 | 1 мин 1 с | f75142f | [лог](logs/2026-09-16T12-37-09Z-unit-f3d2.log) |  |
| 16.09.2026 17:38 | typecheck | ✅ без ошибок | 14 с | f75142f | [лог](logs/2026-09-16T12-38-15Z-typecheck-a88b.log) |  |
| 16.09.2026 17:38 | lint | ✅ без ошибок | 9 с | f75142f | [лог](logs/2026-09-16T12-38-30Z-lint-2711.log) |  |
| 16.09.2026 18:13 | unit | ❌ упало 2 из 990, пропущено 3 | 1 мин 1 с | 776fca3 +17 | [лог](logs/2026-09-16T13-13-21Z-unit-7f63.log) | reservation directory is a bounded read projection scopes and limits reads, preserving empty data and decimal-safe money |
| 16.09.2026 18:15 | unit | ✅ 987 из 990, пропущено 3 | 1 мин 1 с | 776fca3 +17 | [лог](logs/2026-09-16T13-15-02Z-unit-d04c.log) |  |
| 16.09.2026 18:16 | typecheck | ✅ без ошибок | 13 с | 776fca3 +18 | [лог](logs/2026-09-16T13-16-03Z-typecheck-4d86.log) |  |
| 16.09.2026 18:16 | lint | ✅ без ошибок | 9 с | 776fca3 +18 | [лог](logs/2026-09-16T13-16-17Z-lint-ad98.log) |  |
| 16.09.2026 18:16 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 108 из 108 | 8 мин 8 с | 776fca3 +18 | [лог](logs/2026-09-16T13-16-31Z-e2e-ad03.log) |  |
| 16.09.2026 18:28 | unit | ✅ 987 из 990, пропущено 3 | 1 мин 1 с | 776fca3 +20 | [лог](logs/2026-09-16T13-28-32Z-unit-053b.log) |  |
| 16.09.2026 18:29 | typecheck | ✅ без ошибок | 13 с | 776fca3 +22 | [лог](logs/2026-09-16T13-29-34Z-typecheck-41e3.log) |  |
| 16.09.2026 18:29 | lint | ✅ без ошибок | 9 с | 776fca3 +22 | [лог](logs/2026-09-16T13-29-47Z-lint-ad0d.log) |  |
| 16.09.2026 18:30 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 110 | 8 мин 6 с | 776fca3 +22 | [лог](logs/2026-09-16T13-30-01Z-e2e-14d8.log) | пустые ответы дают нули; сбой API не выдаётся за пустую базу |
| 16.09.2026 18:38 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 110 из 110 | 8 мин 7 с | 776fca3 +23 | [лог](logs/2026-09-16T13-38-44Z-e2e-bbbe.log) |  |
| 16.09.2026 17:42 | unit (частично: packages/integrations/src/mail) | ✅ 30 из 30 | 2 с | 31e81a8 +4 | [лог](logs/2026-09-16T12-42-51Z-unit-bf2a.log) |  |
| 16.09.2026 17:57 | unit (частично: packages/shared/src/auth-hash.test.ts packages/domain/src/accounts) | ✅ 57 из 57 | 1 с | de281bf +7 | [лог](logs/2026-09-16T12-57-24Z-unit-2428.log) |  |
| 16.09.2026 18:08 | unit (частично: apps/api/src/accounts packages/domain/src/accounts) | ❌ упало 1 из 85 | 13 с | c20f55b +14 | [лог](logs/2026-09-16T13-08-12Z-unit-7f9d.log) | кто вошёл и выход чужой или выдуманный ключ — 401 |
| 16.09.2026 18:10 | unit (частично: apps/api/src/accounts packages/domain/src/accounts) | ✅ 85 из 85 | 3 с | c20f55b +14 | [лог](logs/2026-09-16T13-10-00Z-unit-1ca5.log) |  |
| 16.09.2026 18:11 | integration | ✅ 26 из 26 | 6 мин 24 с | da3339f | [лог](logs/2026-09-16T13-11-27Z-integration-8c81.log) |  |
| 16.09.2026 23:20 | typecheck | ✅ без ошибок | 19 с | 275cdc2 | [лог](logs/2026-09-16T18-20-29Z-typecheck-0e2d.log) | подключение к проекту: проверка состояния на HEAD 275cdc2 |
| 16.09.2026 23:20 | lint | ✅ без ошибок | 11 с | 275cdc2 | [лог](logs/2026-09-16T18-20-49Z-lint-c2b9.log) | подключение к проекту: проверка состояния на HEAD 275cdc2 |
| 16.09.2026 23:21 | unit | ❌ упало 3 из 974 | 1 мин 36 с | 275cdc2 | [лог](logs/2026-09-16T18-21-06Z-unit-8fd9.log) | подключение к проекту: проверка состояния на HEAD 275cdc2 |
| 16.09.2026 22:12 | unit | ❌ упало 2 из 1109, пропущено 3 | 1 мин 3 с | d73556a +42 | [лог](logs/2026-09-16T17-12-33Z-unit-f442.log) | parseAccountsArgs без имени или с непохожей почтой не создаём |
| 16.09.2026 22:13 | unit | ✅ 1106 из 1109, пропущено 3 | 1 мин 1 с | d73556a +43 | [лог](logs/2026-09-16T17-13-55Z-unit-939c.log) |  |
| 16.09.2026 22:15 | typecheck | ✅ без ошибок | 13 с | d73556a +43 | [лог](logs/2026-09-16T17-15-02Z-typecheck-ebce.log) |  |
| 16.09.2026 22:15 | lint | ✅ без ошибок | 8 с | d73556a +43 | [лог](logs/2026-09-16T17-15-15Z-lint-4138.log) |  |
| 16.09.2026 22:16 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 110 из 110 | 8 мин 53 с | d73556a +43 | [лог](logs/2026-09-16T17-16-05Z-e2e-a84d.log) |  |
| 16.09.2026 22:25 | e2e (частично: --config tests/ui/playwright.auth.config.ts) | ✅ 4 из 4 | 10 с | d73556a +43 | [лог](logs/2026-09-16T17-25-03Z-e2e-926c.log) |  |
| 16.09.2026 22:28 | unit | ✅ 1107 из 1110, пропущено 3 | 1 мин 1 с | e2ae6bf +2 | [лог](logs/2026-09-16T17-28-08Z-unit-9264.log) |  |
| 16.09.2026 22:29 | lint | ✅ без ошибок | 8 с | e2ae6bf +2 | [лог](logs/2026-09-16T17-29-09Z-lint-1adb.log) |  |
| 16.09.2026 22:29 | typecheck | ✅ без ошибок | 13 с | e2ae6bf +2 | [лог](logs/2026-09-16T17-29-18Z-typecheck-30d0.log) |  |
| 16.09.2026 23:30 | typecheck | ✅ без ошибок | 19 с | d0ba978 | [лог](logs/2026-09-16T18-30-55Z-typecheck-105a.log) | после слияния PR #11 |
| 16.09.2026 23:31 | lint | ✅ без ошибок | 11 с | d0ba978 | [лог](logs/2026-09-16T18-31-15Z-lint-a931.log) | после слияния PR #11 |
| 16.09.2026 23:31 | unit | ✅ 1107 из 1110, пропущено 3 | 1 мин 2 с | d0ba978 | [лог](logs/2026-09-16T18-31-27Z-unit-8a13.log) | после слияния PR #11 |
| 15.09.2026 10:41 | typecheck | ❌ ошибок: 501 | 14 с | 002173a | [лог](logs/2026-09-15T05-41-23Z-typecheck-599a.log) | подключение новой сессии: проверка состояния на чистом клоне (Claude Code web) |
| 15.09.2026 10:41 | typecheck | ✅ без ошибок | 12 с | 002173a | [лог](logs/2026-09-15T05-41-57Z-typecheck-a714.log) | подключение сессии: чистый клон + prisma generate (Claude Code web) |
| 15.09.2026 10:42 | lint | ✅ без ошибок | 8 с | 002173a | [лог](logs/2026-09-15T05-42-12Z-lint-dd83.log) | подключение сессии: проверка состояния (Claude Code web) |
| 15.09.2026 10:42 | unit | ❌ упало 3 из 788 | 1 мин 37 с | 002173a | [лог](logs/2026-09-15T05-42-24Z-unit-0e58.log) | подключение сессии: проверка состояния (Claude Code web) |
| 15.09.2026 10:55 | unit | ✅ 783 из 788, пропущено 5 | 14 с | ab4d0d2 +4 | [лог](logs/2026-09-15T05-55-57Z-unit-f7bc.log) | launchd-тесты пропускаются без macOS-программ: unit зелёный на Linux |
| 15.09.2026 10:56 | lint | ✅ без ошибок | 9 с | ab4d0d2 +4 | [лог](logs/2026-09-15T05-56-15Z-lint-eb3b.log) |  |
| 15.09.2026 10:56 | typecheck | ✅ без ошибок | 12 с | ab4d0d2 +4 | [лог](logs/2026-09-15T05-56-24Z-typecheck-5800.log) |  |
| 15.09.2026 11:05 | e2e (частично: --config tests/site/playwright.config.ts) | ❌ упало 5 из 6 | 10 с | 982d8bb +5 | [лог](logs/2026-09-15T06-05-15Z-e2e-717d.log) | главная wetop.ai: доступность, телефон, карточка ссылки, sitemap |
| 15.09.2026 11:05 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 6 из 6 | 9 с | 982d8bb +5 | [лог](logs/2026-09-15T06-05-33Z-e2e-ab12.log) | главная wetop.ai: доступность, телефон, карточка ссылки, sitemap (браузер через CHROMIUM_PATH) |
| 15.09.2026 11:05 | lint | ❌ ошибок: 23 | 8 с | 982d8bb +7 | [лог](logs/2026-09-15T06-05-47Z-lint-6ea2.log) | no-undef |
| 15.09.2026 11:05 | typecheck | ❌ ошибок: 2 | 12 с | 982d8bb +7 | [лог](logs/2026-09-15T06-05-55Z-typecheck-59c8.log) | TS2584 |
| 15.09.2026 11:06 | unit | ✅ 783 из 788, пропущено 5 | 13 с | 982d8bb +5 | [лог](logs/2026-09-15T06-06-07Z-unit-fc2d.log) |  |
| 15.09.2026 11:06 | lint | ❌ ошибок: 9 | 8 с | 982d8bb +8 | [лог](logs/2026-09-15T06-06-49Z-lint-96ad.log) | no-undef |
| 15.09.2026 11:06 | typecheck | ✅ без ошибок | 12 с | 982d8bb +7 | [лог](logs/2026-09-15T06-06-57Z-typecheck-8df0.log) |  |
| 15.09.2026 11:07 | lint | ✅ без ошибок | 8 с | 982d8bb +8 | [лог](logs/2026-09-15T06-07-16Z-lint-6abf.log) |  |
| 15.09.2026 11:07 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 6 из 6 | 9 с | 982d8bb +5 | [лог](logs/2026-09-15T06-07-36Z-e2e-839e.log) | главная wetop.ai после правок под lint и typecheck |
| 15.09.2026 11:12 | unit | ✅ 783 из 788, пропущено 5 | 14 с | 42f53eb | [лог](logs/2026-09-15T06-12-14Z-unit-5070.log) | документы 15.09: опросник (блок 10) входит в отпечаток набора |
| 15.09.2026 11:17 | integration | ❌ упало 1 из 21, пропущено 3 | 9 с | 47efbe9 | [лог](logs/2026-09-15T06-17-39Z-integration-ba2c.log) | integration на локальном пустом PostgreSQL 16 (без .env, без данных в public) |
| 15.09.2026 11:22 | integration | ✅ 21 из 21 | 11 с | 47efbe9 | [лог](logs/2026-09-15T06-22-58Z-integration-b0bc.log) | integration на пустом локальном PostgreSQL: pms_test заполняется сидом |
| 15.09.2026 11:24 | e2e | ❌ упало 10 из 23 | 1 мин 7 с | 47efbe9 +5 | [лог](logs/2026-09-15T06-24-34Z-e2e-c050.log) | e2e на пустом локальном PostgreSQL с сидом, браузер через CHROMIUM_PATH |
| 15.09.2026 11:31 | e2e | ❌ упало 2 из 23 | 1 мин 4 с | 47efbe9 +23 | [лог](logs/2026-09-15T06-31-02Z-e2e-6237.log) | e2e на сиде: page.goto ждёт ухода потокового сегмента (fixtures.ts) |
| 15.09.2026 11:34 | e2e | ✅ 23 из 23 | 43 с | 47efbe9 +25 | [лог](logs/2026-09-15T06-34-54Z-e2e-9e2e.log) | e2e на сиде: занятость сида до +2, окна спеков свободны; календарь 480 суток |
| 15.09.2026 11:35 | lint | ✅ без ошибок | 8 с | 47efbe9 +29 | [лог](logs/2026-09-15T06-35-53Z-lint-3a7b.log) |  |
| 15.09.2026 11:36 | typecheck | ✅ без ошибок | 16 с | 47efbe9 +29 | [лог](logs/2026-09-15T06-36-01Z-typecheck-406e.log) |  |
| 15.09.2026 11:36 | unit | ✅ 786 из 791, пропущено 5 | 13 с | 47efbe9 +5 | [лог](logs/2026-09-15T06-36-18Z-unit-472f.log) |  |
| 15.09.2026 11:38 | lint | ✅ без ошибок | 8 с | 7a5e486 | [лог](logs/2026-09-15T06-38-34Z-lint-610a.log) |  |
| 15.09.2026 11:38 | typecheck | ✅ без ошибок | 16 с | 7a5e486 | [лог](logs/2026-09-15T06-38-42Z-typecheck-57de.log) |  |
| 15.09.2026 11:38 | unit | ✅ 786 из 791, пропущено 5 | 13 с | 7a5e486 | [лог](logs/2026-09-15T06-38-59Z-unit-2d9f.log) |  |
| 15.09.2026 11:39 | e2e | ✅ 23 из 23 | 37 с | 7a5e486 | [лог](logs/2026-09-15T06-39-12Z-e2e-71a5.log) | повтор на закоммиченном коде |
| 15.09.2026 12:08 | unit (частично: apps/api/src/web-booking/web-booking.controller.test.ts) | ✅ 12 из 12 | 2 с | 4bce94d +4 | [лог](logs/2026-09-15T07-08-32Z-unit-deac.log) | red: бронь сразу после первого просмотра — сессия ещё не записана, привязка теряется (воспроизведено на стенде) |
| 15.09.2026 12:08 | lint | ✅ без ошибок | 10 с | 4bce94d +5 | [лог](logs/2026-09-15T07-08-35Z-lint-3044.log) |  |
| 15.09.2026 12:08 | typecheck | ❌ ошибок: 1 | 18 с | 4bce94d +5 | [лог](logs/2026-09-15T07-08-45Z-typecheck-060a.log) | TS2379 |
| 15.09.2026 12:09 | unit (частично: apps/api/src/web-booking/web-booking.controller.test.ts) | ❌ упало 1 из 12 | 2 с | 4bce94d +4 | [лог](logs/2026-09-15T07-09-24Z-unit-3013.log) | RED без flush перед привязкой: бронь сразу после первого просмотра теряет сессию |
| 15.09.2026 12:09 | unit (частично: apps/api/src/web-booking/web-booking.controller.test.ts) | ✅ 12 из 12 | 2 с | 4bce94d +4 | [лог](logs/2026-09-15T07-09-26Z-unit-8eca.log) | GREEN: очередь счётчика записывается до привязки сессии; журнал пишет настоящий итог привязки |
| 15.09.2026 12:09 | typecheck | ✅ без ошибок | 12 с | 4bce94d +5 | [лог](logs/2026-09-15T07-09-39Z-typecheck-e6ec.log) |  |
| 15.09.2026 12:09 | unit | ✅ 787 из 792, пропущено 5 | 13 с | 4bce94d +4 | [лог](logs/2026-09-15T07-09-52Z-unit-129c.log) |  |
| 15.09.2026 12:10 | lint | ✅ без ошибок | 8 с | 4bce94d +5 | [лог](logs/2026-09-15T07-10-06Z-lint-9a1b.log) |  |
| 15.09.2026 12:10 | e2e | ✅ 25 из 25 | 37 с | 4bce94d +5 | [лог](logs/2026-09-15T07-10-15Z-e2e-bbbf.log) | полный прогон на сиде: web-booking вернулся в изолированный стенд, привязка сессии после flush |
| 15.09.2026 12:22 | integration (частично: tests/integration/reservations-import.test.ts) | ❌ упало 1 из 6 | 3 с | 72ca4c6 +1 | [лог](logs/2026-09-15T07-22-35Z-integration-b74f.log) | RED Q-127/Q-128: исчезнувшее проживание не отменяется, удержанная оплата не начисляется |
| 15.09.2026 12:23 | integration (частично: tests/integration/reservations-import.test.ts) | ✅ 6 из 6 | 3 с | 72ca4c6 +3 | [лог](logs/2026-09-15T07-23-22Z-integration-bf53.log) | GREEN ADR-046/047: исчезнувшее проживание отменяется с предохранителями, удержание в Exely — начислением |
| 15.09.2026 12:24 | typecheck | ✅ без ошибок | 17 с | 72ca4c6 +5 | [лог](logs/2026-09-15T07-24-37Z-typecheck-9699.log) |  |
| 15.09.2026 12:24 | lint | ✅ без ошибок | 8 с | 72ca4c6 +5 | [лог](logs/2026-09-15T07-24-54Z-lint-530a.log) |  |
| 15.09.2026 12:25 | unit | ✅ 787 из 792, пропущено 5 | 13 с | 72ca4c6 +4 | [лог](logs/2026-09-15T07-25-02Z-unit-3870.log) |  |
| 15.09.2026 12:25 | integration | ✅ 22 из 22 | 7 с | 72ca4c6 +5 | [лог](logs/2026-09-15T07-25-16Z-integration-eac7.log) | ADR-046/047 на всём наборе |
| 15.09.2026 12:25 | e2e | ✅ 25 из 25 | 44 с | 72ca4c6 +4 | [лог](logs/2026-09-15T07-25-24Z-e2e-d7a1.log) | e2e на свежем сиде после ADR-046/047 (импорт с удержаниями) |
| 15.09.2026 12:43 | unit (частично: scripts/imports/src/exely/auto-sync.test.ts) | ❌ упало 2 из 13 | 2 с | 790f3cc +1 | [лог](logs/2026-09-15T07-43-24Z-unit-920f.log) | RED: дельта остатков не знает про исчезнувшие проживания (ревью 15.09, находка 2) |
| 15.09.2026 12:43 | integration (частично: tests/integration/reservations-import.test.ts) | ❌ упало 1 из 6 | 3 с | 790f3cc +2 | [лог](logs/2026-09-15T07-43-26Z-integration-1f11.log) | RED ревью 15.09: снимок отменяет проживания как живая карточка; заселённые и оплаченные тоже отменяются |
| 15.09.2026 12:44 | unit (частично: scripts/imports/src/exely/auto-sync.test.ts) | ✅ 13 из 13 | 1 с | 790f3cc +8 | [лог](logs/2026-09-15T07-44-48Z-unit-fb71.log) | GREEN: withVanished — ночи исчезнувших проживаний в дельте остатков |
| 15.09.2026 12:44 | integration (частично: tests/integration/reservations-import.test.ts) | ❌ упало 6 из 6 | 2 с | 790f3cc +9 | [лог](logs/2026-09-15T07-44-50Z-integration-ab18.log) | GREEN ревью 15.09: cancelVanished только для живых карточек; заселённые и оплаченные не трогаются, Q-134 |
| 15.09.2026 14:42 | integration (частично: tests/integration/reservations-import.test.ts) | ❌ код выхода 1 | 2 с | 790f3cc +9 | [лог](logs/2026-09-15T09-42-07Z-integration-2311.log) | GREEN ревью 15.09: cancelVanished только для живых карточек; заселённые и оплаченные не трогаются, Q-134 |
| 15.09.2026 14:42 | integration (частично: tests/integration/reservations-import.test.ts) | ✅ 6 из 6 | 3 с | 790f3cc +9 | [лог](logs/2026-09-15T09-42-47Z-integration-0ea9.log) | GREEN ревью 15.09: cancelVanished только для живых карточек; заселённые и оплаченные не трогаются, Q-134 |
| 15.09.2026 14:43 | typecheck | ✅ без ошибок | 13 с | 790f3cc +9 | [лог](logs/2026-09-15T09-43-04Z-typecheck-842c.log) |  |
| 15.09.2026 14:43 | lint | ✅ без ошибок | 9 с | 790f3cc +9 | [лог](logs/2026-09-15T09-43-17Z-lint-5cda.log) |  |
| 15.09.2026 14:43 | unit | ✅ 789 из 794, пропущено 5 | 14 с | 790f3cc +8 | [лог](logs/2026-09-15T09-43-27Z-unit-ddb3.log) |  |
| 15.09.2026 14:43 | integration | ✅ 22 из 22 | 8 с | 790f3cc +9 | [лог](logs/2026-09-15T09-43-41Z-integration-3f3b.log) | после ревью 15.09: cancelVanished, kept, общий ensureSingleActiveCharge |
| 15.09.2026 14:43 | e2e | ✅ 25 из 25 | 47 с | 790f3cc +8 | [лог](logs/2026-09-15T09-43-49Z-e2e-3eee.log) | после ревью 15.09 на свежем сиде |
| 15.09.2026 14:59 | lint | ✅ без ошибок | 8 с | 3673c5f +3 | [лог](logs/2026-09-15T09-59-39Z-lint-20c5.log) |  |
| 15.09.2026 14:59 | typecheck | ✅ без ошибок | 17 с | 3673c5f +3 | [лог](logs/2026-09-15T09-59-48Z-typecheck-4192.log) |  |
| 15.09.2026 15:00 | unit | ✅ 789 из 794, пропущено 5 | 14 с | 3673c5f +2 | [лог](logs/2026-09-15T10-00-05Z-unit-34c7.log) |  |
| 15.09.2026 15:04 | lint | ✅ без ошибок | 17 с | 5d4eb7c +2 | [лог](logs/2026-09-15T10-04-08Z-lint-a248.log) |  |
| 15.09.2026 15:00 | e2e (частично: --config tests/ui/playwright.config.ts) | ✅ 82 из 82 | 5 мин 25 с | 3673c5f +3 | [лог](logs/2026-09-15T10-00-21Z-e2e-9cb6.log) | UI-набор на синтетическом API целиком: ссылка в подписи подчёркнута (link-in-text-block) |
| 15.09.2026 15:38 | unit (частично: packages/domain/src/inventory/summarize.test.ts apps/api/src/rates/rates.controller.test.ts) | ❌ упало 2 из 9 | 3 с | 96184af +2 | [лог](logs/2026-09-15T10-38-14Z-unit-1b3e.log) | волна 3, партия 1: red до правки (capacityAdults, queued) |
| 15.09.2026 15:38 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g статус уборки\|удаление документа\|ограничено вместимостью\|несопоставленная категория\|история | ❌ упало 6 из 6 | 1 мин 53 с | 96184af +3 | [лог](logs/2026-09-15T10-38-19Z-e2e-2ca1.log) | волна 3, партия 1: red до правки |
| 15.09.2026 15:41 | unit (частично: packages/domain/src/inventory/summarize.test.ts apps/api/src/rates/rates.controller.test.ts apps/api/src/inventory/inventory.controller.test.ts  | ✅ 41 из 41 | 2 с | 96184af +19 | [лог](logs/2026-09-15T10-41-34Z-unit-f433.log) | волна 3, партия 1: green после правки |
| 15.09.2026 15:41 | typecheck | ❌ ошибок: 6 | 16 с | 96184af +20 | [лог](logs/2026-09-15T10-41-38Z-typecheck-006d.log) | волна 3, партия 1 |
| 15.09.2026 15:42 | typecheck | ✅ без ошибок | 13 с | 96184af +22 | [лог](logs/2026-09-15T10-42-10Z-typecheck-994b.log) | волна 3, партия 1 |
| 15.09.2026 15:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g статус уборки\|удаление документа\|ограничено вместимостью\|несопоставленная категория\|история | ❌ упало 1 из 6 | 1 мин | 96184af +22 | [лог](logs/2026-09-15T10-42-31Z-e2e-0590.log) | волна 3, партия 1: green после правки |
| 15.09.2026 15:43 | lint | ✅ без ошибок | 8 с | 96184af +22 | [лог](logs/2026-09-15T10-43-33Z-lint-609e.log) | волна 3, партия 1 |
| 15.09.2026 15:43 | unit (частично: scripts/reconciliation/src/inventory-compare.test.ts apps/api/src/units/units.controller.test.ts) | ✅ 7 из 7 | 2 с | 96184af +21 | [лог](logs/2026-09-15T10-43-42Z-unit-751e.log) | волна 3, партия 1: затронутые файлы |
| 15.09.2026 15:43 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g статус уборки\|удаление документа\|ограничено вместимостью\|несопоставленная категория\|история | ✅ 6 из 6 | 14 с | 96184af +22 | [лог](logs/2026-09-15T10-43-53Z-e2e-4e78.log) | волна 3, партия 1: green после правки |
| 15.09.2026 15:44 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 87 из 87 | 8 мин 15 с | 96184af +22 | [лог](logs/2026-09-15T10-44-16Z-e2e-c45c.log) | волна 3, партия 1: весь UI-набор на синтетическом API |
| 15.09.2026 15:52 | unit | ✅ 789 из 794, пропущено 5 | 15 с | 96184af +21 | [лог](logs/2026-09-15T10-52-33Z-unit-b0ae.log) | волна 3, партия 1: весь набор |
| 15.09.2026 15:54 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g различает отклонённый\|внутри выезжающей карточки\|сбой сводки фонда) | ❌ упало 3 из 3 | 55 с | 96bbeee +1 | [лог](logs/2026-09-15T10-54-56Z-e2e-1f34.log) | волна 3, партия 2: red до правки |
| 15.09.2026 15:56 | typecheck | ✅ без ошибок | 17 с | 96bbeee +8 | [лог](logs/2026-09-15T10-56-43Z-typecheck-aedd.log) | волна 3, партия 2 |
| 15.09.2026 15:57 | lint | ✅ без ошибок | 8 с | 96bbeee +8 | [лог](logs/2026-09-15T10-57-00Z-lint-257d.log) | волна 3, партия 2 |
| 15.09.2026 15:57 | unit (частично: apps/web/src/lib/api.test.ts) | ✅ 12 из 12 | 1 с | 96bbeee +8 | [лог](logs/2026-09-15T10-57-15Z-unit-62c6.log) | волна 3, партия 2: digest ApiError |
| 15.09.2026 15:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g различает отклонённый\|внутри выезжающей карточки\|сбой сводки фонда\|сбой API показывает ошиб | ❌ упало 1 из 5 | 35 с | 96bbeee +9 | [лог](logs/2026-09-15T10-57-19Z-e2e-f2f8.log) | волна 3, партия 2: green после правки |
| 15.09.2026 15:58 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g различает отклонённый\|внутри выезжающей карточки\|сбой сводки фонда\|сбой API показывает ошиб | ✅ 5 из 5 | 19 с | 96bbeee +9 | [лог](logs/2026-09-15T10-58-03Z-e2e-f655.log) | волна 3, партия 2: green после правки |
| 15.09.2026 15:58 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 90 из 90 | 8 мин 38 с | 96bbeee +9 | [лог](logs/2026-09-15T10-58-23Z-e2e-510e.log) | волна 3, партия 2: весь UI-набор на синтетическом API |
| 15.09.2026 16:07 | unit | ✅ 790 из 795, пропущено 5 | 14 с | 96bbeee +8 | [лог](logs/2026-09-15T11-07-03Z-unit-69a4.log) | волна 3, партия 2: весь набор |
| 15.09.2026 16:09 | unit (частично: apps/api/src/desk/desk.controller.test.ts) | ❌ упало 2 из 2 | 2 с | 84acbd7 +1 | [лог](logs/2026-09-15T11-09-59Z-unit-4f81.log) | волна 3, партия 3: red до правки (просроченные заезды) |
| 15.09.2026 16:10 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g не заехавший вовремя\|дольше 62 ночей\|период дольше года\|сбое справочника тарифов) | ❌ упало 4 из 4 | 1 мин 13 с | 84acbd7 +2 | [лог](logs/2026-09-15T11-10-03Z-e2e-b707.log) | волна 3, партия 3: red до правки |
| 15.09.2026 16:12 | typecheck | ✅ без ошибок | 16 с | 84acbd7 +14 | [лог](logs/2026-09-15T11-12-52Z-typecheck-36fb.log) | волна 3, партия 3 |
| 15.09.2026 16:13 | unit (частично: apps/api/src/desk/desk.controller.test.ts apps/web/src/lib/api.test.ts) | ✅ 14 из 14 | 2 с | 84acbd7 +13 | [лог](logs/2026-09-15T11-13-10Z-unit-64bc.log) | волна 3, партия 3: green после правки (просроченные заезды, текст отказа API) |
| 15.09.2026 16:13 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g не заехавший вовремя\|дольше 62 ночей\|период дольше года\|сбое справочника тарифов) | ❌ упало 2 из 4 | 42 с | 84acbd7 +14 | [лог](logs/2026-09-15T11-13-19Z-e2e-5f28.log) | волна 3, партия 3: green после правки |
| 15.09.2026 16:14 | lint | ✅ без ошибок | 8 с | 84acbd7 +14 | [лог](logs/2026-09-15T11-14-03Z-lint-ab8d.log) | волна 3, партия 3 |
| 15.09.2026 16:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g не заехавший вовремя\|дольше 62 ночей\|период дольше года\|сбое справочника тарифов) | ❌ упало 1 из 4 | 13 с | 84acbd7 +14 | [лог](logs/2026-09-15T11-14-28Z-e2e-002b.log) | волна 3, партия 3: green после правки |
| 15.09.2026 16:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g не заехавший вовремя\|дольше 62 ночей\|период дольше года\|сбое справочника тарифов) | ✅ 4 из 4 | 12 с | 84acbd7 +14 | [лог](logs/2026-09-15T11-14-55Z-e2e-03e3.log) | волна 3, партия 3: green после правки |
| 15.09.2026 16:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 94 из 94 | 8 мин 21 с | 84acbd7 +14 | [лог](logs/2026-09-15T11-15-07Z-e2e-35cf.log) | волна 3, партия 3: весь UI-набор на синтетическом API |
| 15.09.2026 16:23 | unit | ✅ 790 из 795, пропущено 5 | 14 с | 84acbd7 +13 | [лог](logs/2026-09-15T11-23-29Z-unit-dc6d.log) | волна 3, партия 3: весь набор |
| 15.09.2026 16:24 | e2e | ❌ упало 1 из 25 | 1 мин 9 с | 3c62ad1 +1 | [лог](logs/2026-09-15T11-24-49Z-e2e-368d.log) | волна 3, партии 1–3: сквозные на пустом PostgreSQL (сид) |
| 15.09.2026 16:26 | integration | ✅ 22 из 22 | 8 с | 3c62ad1 | [лог](logs/2026-09-15T11-26-00Z-integration-acd9.log) | волна 3, партии 1–3 |
| 15.09.2026 16:26 | e2e | ✅ 25 из 25 | 41 с | 3c62ad1 +2 | [лог](logs/2026-09-15T11-26-22Z-e2e-c59d.log) | волна 3: подтверждение снятия блокировки в спеке — весь набор на сиде |
| 15.09.2026 16:41 | unit (частично: apps/web/src/app/reservations/[number]/finance-actions.test.ts apps/api/src/finance/finance.controller.test.ts apps/api/src/hotel/reservation-di | ❌ упало 3 из 18 | 3 с | 3a06f7f +3 | [лог](logs/2026-09-15T11-41-55Z-unit-72e0.log) | хвост волны 3: red до правки |
| 15.09.2026 16:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g подсказка про услуги\|срок дольше года) | ❌ упало 2 из 2 | 1 мин 54 с | 3a06f7f +4 | [лог](logs/2026-09-15T11-42-00Z-e2e-d4db.log) | хвост волны 3: red до правки |
| 15.09.2026 16:44 | typecheck | ❌ ошибок: 2 | 14 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-44-36Z-typecheck-8a3a.log) | хвост волны 3 |
| 15.09.2026 16:44 | unit (частично: apps/web/src/app/reservations/[number]/finance-actions.test.ts apps/api/src/finance/finance.controller.test.ts apps/api/src/hotel/reservation-di | ❌ упало 1 из 18 | 2 с | 3a06f7f +11 | [лог](logs/2026-09-15T11-44-50Z-unit-8ae6.log) | хвост волны 3: green после правки |
| 15.09.2026 16:45 | typecheck | ✅ без ошибок | 13 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-45-07Z-typecheck-8101.log) | хвост волны 3 |
| 15.09.2026 16:45 | unit (частично: apps/web/src/app/reservations/[number]/finance-actions.test.ts apps/api/src/finance/finance.controller.test.ts apps/api/src/hotel/reservation-di | ✅ 18 из 18 | 2 с | 3a06f7f +11 | [лог](logs/2026-09-15T11-45-20Z-unit-7632.log) | хвост волны 3: green после правки |
| 15.09.2026 16:45 | lint | ✅ без ошибок | 8 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-45-24Z-lint-23e2.log) | хвост волны 3 |
| 15.09.2026 16:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g подсказка про услуги\|срок дольше года\|Обзор дня\|неверный период финансов\|гост) | ❌ упало 1 из 15 | 59 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-45-34Z-e2e-76f7.log) | хвост волны 3: green после правки |
| 15.09.2026 16:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g подсказка про услуги\|срок дольше года) | ✅ 2 из 2 | 7 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-46-48Z-e2e-d003.log) | хвост волны 3: green после правки |
| 15.09.2026 16:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 95 из 95 | 8 мин 15 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-46-55Z-e2e-e4ef.log) | хвост волны 3 + волна 4 шаг 1: весь UI-набор |
| 15.09.2026 16:55 | unit | ✅ 792 из 797, пропущено 5 | 14 с | 3a06f7f +11 | [лог](logs/2026-09-15T11-55-13Z-unit-523f.log) | хвост волны 3 + волна 4 шаг 1: весь набор |
| 15.09.2026 16:55 | integration | ❌ код выхода 1 | 1 с | 3a06f7f +4 | [лог](logs/2026-09-15T11-55-29Z-integration-8741.log) | хвост волны 3: pageSize и предел отчёта |
| 15.09.2026 16:55 | integration | ✅ 22 из 22 | 8 с | 3a06f7f +4 | [лог](logs/2026-09-15T11-55-52Z-integration-beac.log) | хвост волны 3: pageSize и предел отчёта |
| 15.09.2026 16:56 | e2e | ✅ 25 из 25 | 41 с | 3a06f7f +12 | [лог](logs/2026-09-15T11-56-09Z-e2e-a6f2.log) | хвост волны 3 + волна 4 шаг 1: сквозные на сиде |
| 16.09.2026 23:38 | typecheck | ❌ ошибок: 2 | 15 с | 29051dd +50 | [лог](logs/2026-09-16T18-38-15Z-typecheck-189a.log) | после слияния PR #10 (конфликты разрешены, ADR-050/051, Q-147…149) |
| 16.09.2026 23:38 | lint | ❌ ошибок: 1 | 10 с | 29051dd +50 | [лог](logs/2026-09-16T18-38-31Z-lint-7c2c.log) | после слияния PR #10 |
| 16.09.2026 23:38 | unit | ❌ код выхода 1 | 1 мин 2 с | 29051dd +50 | [лог](logs/2026-09-16T18-38-42Z-unit-ee29.log) | после слияния PR #10 |
| 16.09.2026 23:41 | typecheck | ✅ без ошибок | 19 с | 29051dd +50 | [лог](logs/2026-09-16T18-41-12Z-typecheck-e253.log) | после слияния PR #10, вторая попытка |
| 16.09.2026 23:41 | lint | ✅ без ошибок | 11 с | 29051dd +50 | [лог](logs/2026-09-16T18-41-32Z-lint-0dc1.log) | после слияния PR #10, вторая попытка |
| 16.09.2026 23:41 | unit | ✅ 1116 из 1119, пропущено 3 | 1 мин 2 с | 29051dd +50 | [лог](logs/2026-09-16T18-41-44Z-unit-2325.log) | после слияния PR #10, вторая попытка |
| 16.09.2026 23:43 | integration | ✅ 26 из 31, пропущено 5 | 15 с | 0b0bbf4 | [лог](logs/2026-09-16T18-43-39Z-integration-cbda.log) | слитый код PR #10+#11 на локальном PostgreSQL 16, сид из аудита |
| 16.09.2026 23:44 | e2e | ❌ код выхода 1 | 4 с | 0b0bbf4 | [лог](logs/2026-09-16T18-44-02Z-e2e-73be.log) | слитый код PR #10+#11 на локальном PostgreSQL 16, сид из аудита |
| 16.09.2026 23:46 | typecheck | ✅ без ошибок | 21 с | 0b0bbf4 +3 | [лог](logs/2026-09-16T18-46-10Z-typecheck-ac4a.log) | api-error.ts: ошибка API без next/headers для клиентских компонентов |
| 16.09.2026 23:46 | lint | ✅ без ошибок | 11 с | 0b0bbf4 +3 | [лог](logs/2026-09-16T18-46-31Z-lint-3f9b.log) | api-error.ts |
| 16.09.2026 23:46 | unit | ✅ 1116 из 1119, пропущено 3 | 1 мин 2 с | 0b0bbf4 +3 | [лог](logs/2026-09-16T18-46-43Z-unit-be2d.log) | api-error.ts |
| 16.09.2026 23:48 | e2e | ❌ упало 21 из 25, пропущено 3 | 17 с | 5fef475 | [лог](logs/2026-09-16T18-48-02Z-e2e-2b2c.log) | слитый код PR #10+#11 на локальном PostgreSQL 16, сид из аудита |
| 16.09.2026 23:48 | e2e | ❌ упало 1 из 25 | 46 с | 5fef475 | [лог](logs/2026-09-16T18-48-35Z-e2e-45a3.log) | слитый код PR #10+#11 на локальном PostgreSQL 16, сид из аудита; CHROMIUM_PATH — Chromium 1194 контейнера |
| 16.09.2026 23:50 | e2e | ✅ 25 из 25 | 46 с | 5fef475 +2 | [лог](logs/2026-09-16T18-50-25Z-e2e-733a.log) | фикстура ждёт любой потоковый сегмент; desk-day читает счётчики в видимой полосе |
| 16.09.2026 23:51 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 123 | 10 мин 31 с | 5fef475 +2 | [лог](logs/2026-09-16T18-51-32Z-e2e-fd5f.log) | UI-набор на синтетическом API после слияния PR #10+#11; Chromium контейнера |
| 17.09.2026 00:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g экран ошибки различает) | ✅ 1 из 1 | 7 с | 8ac0c63 +1 | [лог](logs/2026-09-16T19-03-21Z-e2e-66b2.log) | тест экрана ошибки переведён с /today на /inventory: Главная с 16.09 отказ называет словами |
| 17.09.2026 00:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 123 из 123 | 10 мин 3 с | 8ac0c63 +1 | [лог](logs/2026-09-16T19-03-48Z-e2e-a5aa.log) | UI-набор целиком после переноса теста экрана ошибки на /inventory |
| 17.09.2026 00:35 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/manager-actions.spec.ts tests/ui/reservation-tariff.spec.ts tests/ui/quality.spec.ts  | ❌ упало 3 из 59 | 2 мин 57 с | efc8113 +22 | [лог](logs/2026-09-16T19-35-50Z-e2e-dab4.log) | срез 7.3: действия управляющего на синтетическом API, первый прогон |
| 17.09.2026 00:40 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/manager-actions.spec.ts) | ✅ 5 из 5 | 20 с | efc8113 +22 | [лог](logs/2026-09-16T19-40-06Z-e2e-2375.log) | срез 7.3: после починки фикстуры (путь отмены, tentative, заголовок test-runner) |
| 17.09.2026 00:40 | typecheck | ✅ без ошибок | 15 с | efc8113 +22 | [лог](logs/2026-09-16T19-40-41Z-typecheck-2240.log) | срез 7.3: действия управляющего |
| 17.09.2026 00:40 | lint | ✅ без ошибок | 11 с | efc8113 +22 | [лог](logs/2026-09-16T19-40-56Z-lint-97fc.log) | срез 7.3 |
| 17.09.2026 00:41 | unit | ✅ 1117 из 1120, пропущено 3 | 1 мин 2 с | efc8113 +11 | [лог](logs/2026-09-16T19-41-07Z-unit-44db.log) | срез 7.3: предпросмотры суммы в контроллере броней |
| 17.09.2026 00:42 | e2e | ❌ упало 4 из 25 | 3 мин 40 с | efc8113 +22 | [лог](logs/2026-09-16T19-42-31Z-e2e-39d0.log) | срез 7.3: окна подтверждения с суммой на живом стенде (локальный PostgreSQL, сид) |
| 17.09.2026 00:47 | e2e | ❌ упало 1 из 25 | 46 с | efc8113 +23 | [лог](logs/2026-09-16T19-47-26Z-e2e-ed01.log) | срез 7.3: после починки локатора окна, testid подсказки и разбора суммы |
| 17.09.2026 00:48 | e2e | ✅ 25 из 25 | 47 с | efc8113 +23 | [лог](logs/2026-09-16T19-48-37Z-e2e-afed.log) | срез 7.3: спек штрафа ждёт предпросмотр перед чтением суммы |
| 17.09.2026 00:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 128 из 128 | 10 мин | efc8113 +23 | [лог](logs/2026-09-16T19-49-24Z-e2e-c972.log) | срез 7.3: UI-набор целиком |
| 17.09.2026 00:59 | typecheck | ✅ без ошибок | 15 с | efc8113 +24 | [лог](logs/2026-09-16T19-59-48Z-typecheck-912e.log) | срез 7.3: финальный код |
| 17.09.2026 01:00 | lint | ✅ без ошибок | 11 с | efc8113 +24 | [лог](logs/2026-09-16T20-00-03Z-lint-4d1b.log) | срез 7.3: финальный код |
| 17.09.2026 01:00 | unit | ✅ 1117 из 1120, пропущено 3 | 1 мин 2 с | efc8113 +12 | [лог](logs/2026-09-16T20-00-14Z-unit-9831.log) | срез 7.3: финальный код |
| 17.09.2026 01:01 | e2e | ✅ 25 из 25 | 45 с | efc8113 +24 | [лог](logs/2026-09-16T20-01-22Z-e2e-2da3.log) | срез 7.3: финальный код, локальный PostgreSQL с сидом |
| 17.09.2026 01:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 128 из 128 | 10 мин | efc8113 +24 | [лог](logs/2026-09-16T20-02-08Z-e2e-b248.log) | срез 7.3: финальный код, UI-набор целиком |
| 17.09.2026 13:07 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/channex-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/manager-actions.spec.ts t | ✅ 49 из 49 | 3 мин 31 с | 3dbede1 +27 | [лог](logs/2026-09-17T08-07-06Z-e2e-887b.log) | срез 7.2: три экрана Channex на синтетическом API (цены в ячейке, очередь и события, приём брони) + смежные спеки |
| 17.09.2026 13:11 | typecheck | ✅ без ошибок | 19 с | 3dbede1 +27 | [лог](logs/2026-09-17T08-11-49Z-typecheck-092b.log) | срез 7.2: три экрана Channex |
| 17.09.2026 13:12 | lint | ✅ без ошибок | 10 с | 3dbede1 +27 | [лог](logs/2026-09-17T08-12-09Z-lint-f4d0.log) | срез 7.2: три экрана Channex |
| 17.09.2026 13:12 | unit | ✅ 1128 из 1131, пропущено 3 | 1 мин 3 с | 3dbede1 +24 | [лог](logs/2026-09-17T08-12-20Z-unit-b076.log) | срез 7.2: три экрана Channex |
| 17.09.2026 13:17 | e2e | ✅ 25 из 25 | 58 с | 9111416 | [лог](logs/2026-09-17T08-17-56Z-e2e-3457.log) | срез 7.2: сквозные на локальном PostgreSQL 16 с сидом (сертификация: «закрыто», цены по §14) |
| 17.09.2026 13:53 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g подсказка закрывается) | ✅ 1 из 1 | 7 с | 733fc44 +5 | [лог](logs/2026-09-17T08-53-12Z-e2e-cd6a.log) | починка: подсказка шахматки не держит кнопки под собой (найдено обходом стойки) |
| 17.09.2026 13:57 | typecheck | ✅ без ошибок | 22 с | 733fc44 +5 | [лог](logs/2026-09-17T08-57-56Z-typecheck-5a34.log) | обход стойки: инструмент и починка подсказки шахматки |
| 17.09.2026 13:58 | lint | ❌ ошибок: 2 | 12 с | 733fc44 +5 | [лог](logs/2026-09-17T08-58-19Z-lint-502a.log) | обход стойки: инструмент и починка подсказки шахматки |
| 17.09.2026 13:58 | lint | ✅ без ошибок | 12 с | 733fc44 +5 | [лог](logs/2026-09-17T08-58-57Z-lint-83b4.log) | обход стойки: инструмент и починка подсказки шахматки |
| 17.09.2026 13:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 133 из 133 | 10 мин 22 с | d4d7e71 | [лог](logs/2026-09-17T08-59-59Z-e2e-4992.log) | после починки подсказки шахматки: полный UI-набор |
| 17.09.2026 14:11 | e2e | ❌ упало 1 из 25 | 57 с | d4d7e71 | [лог](logs/2026-09-17T09-11-24Z-e2e-f1db.log) | после починки подсказки шахматки: сквозные на локальном PostgreSQL 16 |
| 17.09.2026 14:14 | e2e | ✅ 25 из 25 | 58 с | d4d7e71 +1 | [лог](logs/2026-09-17T09-14-17Z-e2e-8a9c.log) | после починки подсказки шахматки: сквозные на локальном PostgreSQL 16 |
| 17.09.2026 14:36 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g экраны для дизайн-системы) | ✅ 2 из 2 | 37 с | fef22a8 +4 | [лог](logs/2026-09-17T09-36-23Z-e2e-afca.log) | починка: поле фильтра не растягивает экран на телефоне (найдено обходом стойки) |
| 17.09.2026 14:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 с | fef22a8 +4 | [лог](logs/2026-09-17T09-42-36Z-e2e-d9aa.log) | обход стойки, второй проход: телефон и экраны входа; починка ширины поля фильтра |
| 17.09.2026 14:47 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 с | fef22a8 +4 | [лог](logs/2026-09-17T09-47-02Z-e2e-2880.log) | обход стойки, второй проход: телефон и экраны входа; починка ширины поля фильтра |
| 17.09.2026 14:51 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 2 с | fef22a8 +4 | [лог](logs/2026-09-17T09-51-55Z-e2e-b853.log) | обход стойки, второй проход: телефон и экраны входа; починка ширины поля фильтра |
| 17.09.2026 14:53 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 133 из 133 | 10 мин 18 с | fef22a8 +4 | [лог](logs/2026-09-17T09-53-17Z-e2e-b500.log) | обход стойки, второй проход: телефон и экраны входа; починка ширины поля фильтра |
| 17.09.2026 15:05 | e2e | ✅ 25 из 25 | 1 мин | fef22a8 +4 | [лог](logs/2026-09-17T10-05-05Z-e2e-c343.log) | починка ширины поля фильтра и подсказки шахматки: сквозные |
| 17.09.2026 15:06 | typecheck | ✅ без ошибок | 20 с | fef22a8 +4 | [лог](logs/2026-09-17T10-06-06Z-typecheck-28bd.log) | обход стойки, второй проход |
| 17.09.2026 15:06 | lint | ✅ без ошибок | 11 с | fef22a8 +4 | [лог](logs/2026-09-17T10-06-26Z-lint-6544.log) | обход стойки, второй проход |
| 17.09.2026 15:06 | unit | ✅ 1128 из 1131, пропущено 3 | 1 мин 2 с | fef22a8 +3 | [лог](logs/2026-09-17T10-06-38Z-unit-fa80.log) | обход стойки, второй проход |
| 17.09.2026 15:14 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 6 из 6 | 10 с | 4b6a872 | [лог](logs/2026-09-17T10-14-56Z-e2e-e36f.log) | перед выкладкой главной: проверка статической сборки |
| 17.09.2026 15:29 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 133 из 133 | 10 мин 17 с | 4b6a872 +1 | [лог](logs/2026-09-17T10-29-53Z-e2e-7772.log) | починка сетки .stack: код счётчика не распирает экран телефона |
| 17.09.2026 15:40 | e2e | ❌ упало 1 из 25 | 58 с | 4b6a872 +1 | [лог](logs/2026-09-17T10-40-44Z-e2e-bb74.log) | починка сетки .stack |
| 17.09.2026 15:41 | typecheck | ✅ без ошибок | 15 с | 4b6a872 +1 | [лог](logs/2026-09-17T10-41-42Z-typecheck-4d19.log) | починка сетки .stack, доклад по выкладке |
| 17.09.2026 15:41 | lint | ✅ без ошибок | 11 с | 4b6a872 +1 | [лог](logs/2026-09-17T10-41-58Z-lint-dac2.log) | починка сетки .stack, доклад по выкладке |
| 17.09.2026 15:42 | unit | ✅ 1128 из 1131, пропущено 3 | 1 мин 2 с | 4b6a872 +1 | [лог](logs/2026-09-17T10-42-10Z-unit-1ae0.log) | починка сетки .stack, доклад по выкладке |
| 17.09.2026 15:46 | e2e | ✅ 25 из 25 | 1 мин 1 с | 4b6a872 +2 | [лог](logs/2026-09-17T10-46-11Z-e2e-0372.log) | починка сетки .stack; сквозные устойчивы к потоковому дублю формы |
| 17.09.2026 16:16 | lint | ✅ без ошибок | 11 с | 1f17759 +1 | [лог](logs/2026-09-17T11-16-09Z-lint-68f5.log) | обход по умолчанию смотрит на живые 3000/3001 |
| 17.09.2026 16:16 | typecheck | ✅ без ошибок | 16 с | 1f17759 +1 | [лог](logs/2026-09-17T11-16-20Z-typecheck-02d4.log) | обход по умолчанию смотрит на живые 3000/3001 |
| 17.09.2026 16:53 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 134 из 134 | 10 мин 21 с | afab8e3 +3 | [лог](logs/2026-09-17T11-53-08Z-e2e-e4d6.log) | страница ревизии называет причину сбоя; обход читает заголовок основной области |
| 17.09.2026 17:04 | e2e | ✅ 25 из 25 | 59 с | afab8e3 +3 | [лог](logs/2026-09-17T12-04-09Z-e2e-17af.log) | страница ревизии называет причину сбоя |
| 17.09.2026 17:05 | typecheck | ✅ без ошибок | 21 с | afab8e3 +3 | [лог](logs/2026-09-17T12-05-09Z-typecheck-db7e.log) | страница ревизии и обход: заголовок основной области |
| 17.09.2026 17:05 | lint | ✅ без ошибок | 11 с | afab8e3 +3 | [лог](logs/2026-09-17T12-05-30Z-lint-4f73.log) | страница ревизии и обход: заголовок основной области |
| 17.09.2026 19:28 | unit | ✅ 1131 из 1134, пропущено 3 | 1 мин 2 с | 4c09645 +5 | [лог](logs/2026-09-17T14-28-44Z-unit-3718.log) | ревизия с двоеточиями: decodeRouteParam |
| 17.09.2026 19:29 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 135 | 10 мин 42 с | 4c09645 +6 | [лог](logs/2026-09-17T14-29-46Z-e2e-b319.log) | ревизия с двоеточиями и витрина с такой ревизией |
| 17.09.2026 19:40 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 135 из 135 | 10 мин 30 с | 4c09645 +6 | [лог](logs/2026-09-17T14-40-57Z-e2e-c6aa.log) | ревизия с двоеточиями: витрина и счётчики событий |
| 17.09.2026 19:53 | e2e | ✅ 25 из 25 | 59 с | 4c09645 +6 | [лог](logs/2026-09-17T14-53-17Z-e2e-d18b.log) | ревизия с двоеточиями; клиент базы генерируется при установке |
| 17.09.2026 19:54 | typecheck | ✅ без ошибок | 21 с | 4c09645 +6 | [лог](logs/2026-09-17T14-54-16Z-typecheck-c79e.log) | ревизия с двоеточиями; postinstall генерирует клиент |
| 17.09.2026 19:54 | lint | ✅ без ошибок | 12 с | 4c09645 +6 | [лог](logs/2026-09-17T14-54-38Z-lint-190f.log) | ревизия с двоеточиями; postinstall генерирует клиент |
| 17.09.2026 20:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 136 из 136 | 10 мин 32 с | 2423ca4 +3 | [лог](logs/2026-09-17T15-23-54Z-e2e-83a2.log) | долгое проживание: карточка объясняет предел доступности |
| 17.09.2026 20:38 | e2e | ✅ 25 из 25 | 1 мин | 2423ca4 +3 | [лог](logs/2026-09-17T15-38-30Z-e2e-a3bb.log) | долгое проживание: карточка объясняет предел доступности |
| 17.09.2026 20:39 | typecheck | ✅ без ошибок | 16 с | 2423ca4 +3 | [лог](logs/2026-09-17T15-39-31Z-typecheck-4488.log) | долгое проживание |
| 17.09.2026 20:39 | lint | ✅ без ошибок | 11 с | 2423ca4 +3 | [лог](logs/2026-09-17T15-39-48Z-lint-a96b.log) | долгое проживание |
| 17.09.2026 20:39 | unit | ✅ 1131 из 1134, пропущено 3 | 1 мин 2 с | 2423ca4 +2 | [лог](logs/2026-09-17T15-39-59Z-unit-dea9.log) | долгое проживание |
| 17.09.2026 22:03 | typecheck | ✅ без ошибок | 15 с | bf5f078 +4 | [лог](logs/2026-09-17T17-03-50Z-typecheck-1d56.log) |  |
| 17.09.2026 22:04 | lint | ✅ без ошибок | 11 с | bf5f078 +4 | [лог](logs/2026-09-17T17-04-10Z-lint-1f99.log) |  |
| 17.09.2026 22:04 | unit | ✅ 1139 из 1142, пропущено 3 | 1 мин 2 с | bf5f078 +4 | [лог](logs/2026-09-17T17-04-25Z-unit-0ba0.log) |  |
| 17.09.2026 22:17 | typecheck | ✅ без ошибок | 16 с | 9c3555f +1 | [лог](logs/2026-09-17T17-17-11Z-typecheck-9e66.log) |  |
| 17.09.2026 22:17 | lint | ✅ без ошибок | 12 с | 9c3555f +1 | [лог](logs/2026-09-17T17-17-27Z-lint-9a41.log) |  |
| 17.09.2026 22:17 | unit | ✅ 1153 из 1156, пропущено 3 | 1 мин 2 с | 9c3555f +1 | [лог](logs/2026-09-17T17-17-43Z-unit-275c.log) |  |
| 17.09.2026 23:13 | typecheck | ✅ без ошибок | 16 с | 5a0f5a2 +5 | [лог](logs/2026-09-17T18-13-33Z-typecheck-8138.log) |  |
| 17.09.2026 23:13 | lint | ✅ без ошибок | 11 с | 5a0f5a2 +5 | [лог](logs/2026-09-17T18-13-49Z-lint-3633.log) |  |
| 17.09.2026 23:14 | unit | ✅ 1165 из 1168, пропущено 3 | 1 мин 2 с | 5a0f5a2 +5 | [лог](logs/2026-09-17T18-14-05Z-unit-3b69.log) |  |
| 17.09.2026 23:15 | e2e | ❌ код выхода 1 | 6 с | 5a0f5a2 +3 | [лог](logs/2026-09-17T18-15-14Z-e2e-0c03.log) | (ошибка вне тестов) |
| 17.09.2026 23:15 | e2e | ✅ 25 из 25 | 44 с | 5a0f5a2 +3 | [лог](logs/2026-09-17T18-15-48Z-e2e-23f4.log) |  |
| 18.09.2026 10:05 | typecheck | ✅ без ошибок | 23 с | 9fabb5e +2 | [лог](logs/2026-09-18T05-05-52Z-typecheck-33df.log) |  |
| 18.09.2026 10:06 | lint | ✅ без ошибок | 13 с | 9fabb5e +2 | [лог](logs/2026-09-18T05-06-15Z-lint-768e.log) |  |
| 18.09.2026 10:06 | unit | ✅ 1165 из 1168, пропущено 3 | 1 мин 3 с | 9fabb5e +2 | [лог](logs/2026-09-18T05-06-29Z-unit-a57c.log) |  |
| 18.09.2026 10:07 | e2e | ✅ 25 из 25 | 55 с | 9fabb5e +2 | [лог](logs/2026-09-18T05-07-32Z-e2e-ff9e.log) |  |
| 18.09.2026 10:45 | unit | ✅ 1165 из 1168, пропущено 3 | 1 мин 2 с | ddf9b41 | [лог](logs/2026-09-18T05-45-08Z-unit-d7c7.log) |  |
| 18.09.2026 10:56 | typecheck | ✅ без ошибок | 17 с | 16ebe79 +1 | [лог](logs/2026-09-18T05-56-35Z-typecheck-96f5.log) |  |
| 18.09.2026 10:56 | lint | ✅ без ошибок | 12 с | 16ebe79 +1 | [лог](logs/2026-09-18T05-56-53Z-lint-b2a4.log) |  |
| 18.09.2026 10:57 | unit | ✅ 1168 из 1171, пропущено 3 | 1 мин 2 с | 16ebe79 +1 | [лог](logs/2026-09-18T05-57-05Z-unit-f4e2.log) |  |
| 18.09.2026 11:08 | typecheck | ✅ без ошибок | 18 с | 1cb44da +4 | [лог](logs/2026-09-18T06-08-05Z-typecheck-1433.log) |  |
| 18.09.2026 11:08 | lint | ✅ без ошибок | 12 с | 1cb44da +4 | [лог](logs/2026-09-18T06-08-23Z-lint-a1dd.log) |  |
| 18.09.2026 11:08 | unit | ✅ 1174 из 1177, пропущено 3 | 1 мин 2 с | 1cb44da +4 | [лог](logs/2026-09-18T06-08-36Z-unit-703b.log) |  |
| 18.09.2026 14:53 | typecheck | ✅ без ошибок | 23 с | df6f4ce +2 | [лог](logs/2026-09-18T09-53-18Z-typecheck-1635.log) |  |
| 18.09.2026 14:53 | lint | ✅ без ошибок | 12 с | df6f4ce +2 | [лог](logs/2026-09-18T09-53-41Z-lint-e0ae.log) |  |
| 18.09.2026 14:53 | unit | ✅ 1174 из 1177, пропущено 3 | 1 мин 2 с | df6f4ce +2 | [лог](logs/2026-09-18T09-53-53Z-unit-3d6e.log) |  |
| 18.09.2026 15:19 | typecheck | ✅ без ошибок | 15 с | 4d16b50 +16 | [лог](logs/2026-09-18T10-19-27Z-typecheck-4975.log) |  |
| 18.09.2026 15:19 | lint | ✅ без ошибок | 10 с | 4d16b50 +16 | [лог](logs/2026-09-18T10-19-42Z-lint-5ff6.log) |  |
| 18.09.2026 15:19 | unit | ✅ 1186 из 1189, пропущено 3 | 1 мин 1 с | 4d16b50 +16 | [лог](logs/2026-09-18T10-19-53Z-unit-416c.log) |  |
| 18.09.2026 15:20 | e2e | ✅ 25 из 25 | 52 с | 4d16b50 +13 | [лог](logs/2026-09-18T10-20-55Z-e2e-87f2.log) |  |
| 17.09.2026 00:08 | unit (частично: tests/unit/repo-sync.test.ts) | ❌ упало 9 из 9 | 2 с | 275cdc2 +1 | [лог](logs/2026-09-16T19-08-04Z-unit-d6ce.log) | repo-sync.sh: красный до кода (скрипта ещё нет) |
| 17.09.2026 00:12 | unit (частично: tests/unit/repo-sync.test.ts) | ✅ 9 из 9 | 3 с | 275cdc2 +4 | [лог](logs/2026-09-16T19-12-40Z-unit-791c.log) | repo-sync.sh: зелёный после кода (9 сценариев: проверка, --pull, --relink, --from, чужой remote, вторая копия) |
| 17.09.2026 00:12 | lint | ✅ без ошибок | 11 с | 275cdc2 +4 | [лог](logs/2026-09-16T19-12-43Z-lint-cdbc.log) | repo-sync: тест и npm-команда |
| 17.09.2026 00:12 | typecheck | ✅ без ошибок | 18 с | 275cdc2 +4 | [лог](logs/2026-09-16T19-12-55Z-typecheck-1915.log) | repo-sync |
| 17.09.2026 00:14 | unit (частично: --exclude tests/unit/launchd-install.test.ts) | ❌ упало 3 из 983 | 1 мин 36 с | 275cdc2 +4 | [лог](logs/2026-09-16T19-14-29Z-unit-9551.log) | весь набор без launchd-install: три его теста зовут plutil и PlistBuddy, на Linux их нет (та же причина красного main в GitHub) |
| 17.09.2026 00:16 | unit (частично: tests/unit/repo-sync.test.ts) | ✅ 9 из 9 | 3 с | 275cdc2 +4 | [лог](logs/2026-09-16T19-16-41Z-unit-6d75.log) | repo-sync.sh: после prettier, тот же зелёный |
| 17.09.2026 00:24 | unit (частично: tests/unit/repo-sync.test.ts) | ❌ упало 2 из 11 | 4 с | b8d0213 +1 | [лог](logs/2026-09-16T19-24-56Z-unit-8cb1.log) | аргументы после # и быстрый туннель при постоянном адресе: красный до правки |
| 17.09.2026 00:25 | unit (частично: tests/unit/repo-sync.test.ts) | ✅ 11 из 11 | 3 с | b8d0213 +2 | [лог](logs/2026-09-16T19-25-49Z-unit-186d.log) | аргументы после # и быстрый туннель при постоянном адресе: зелёный |
| 17.09.2026 00:25 | lint | ✅ без ошибок | 11 с | b8d0213 +2 | [лог](logs/2026-09-16T19-25-52Z-lint-681d.log) | repo-sync: # и быстрый туннель |
| 17.09.2026 00:26 | typecheck | ✅ без ошибок | 14 с | b8d0213 +2 | [лог](logs/2026-09-16T19-26-04Z-typecheck-2b25.log) | repo-sync |
| 17.09.2026 00:33 | unit (частично: tests/unit/channex-tunnel-guard.test.ts tests/unit/repo-sync.test.ts) | ❌ упало 3 из 19 | 1 мин 42 с | 36a3d4a +2 | [лог](logs/2026-09-16T19-33-45Z-unit-9198.log) | гонка защиты туннеля с запуском API и переустановка tunnel через --relink: красный до правки |
| 17.09.2026 00:36 | unit (частично: tests/unit/channex-tunnel-guard.test.ts tests/unit/repo-sync.test.ts) | ✅ 19 из 19 | 1 мин 12 с | 36a3d4a +4 | [лог](logs/2026-09-16T19-36-30Z-unit-1aaf.log) | гонка защиты туннеля и переустановка tunnel: зелёный после правки |
| 17.09.2026 00:37 | lint | ✅ без ошибок | 12 с | 36a3d4a +4 | [лог](logs/2026-09-16T19-37-42Z-lint-23f5.log) | туннель и repo-sync |
| 17.09.2026 00:37 | typecheck | ✅ без ошибок | 14 с | 36a3d4a +4 | [лог](logs/2026-09-16T19-37-54Z-typecheck-bb7a.log) | туннель и repo-sync |
| 17.09.2026 00:57 | unit (частично: tests/unit/repo-sync.test.ts) | ❌ упало 1 из 13 | 7 с | 887babf +1 | [лог](logs/2026-09-16T19-57-12Z-unit-ed8f.log) | esbuild не той платформы: красный до правки |
| 17.09.2026 00:57 | unit (частично: tests/unit/repo-sync.test.ts) | ✅ 13 из 13 | 4 с | 887babf +2 | [лог](logs/2026-09-16T19-57-32Z-unit-1b0a.log) | esbuild не той платформы: зелёный |
| 17.09.2026 00:57 | lint | ✅ без ошибок | 13 с | 887babf +2 | [лог](logs/2026-09-16T19-57-36Z-lint-19c4.log) | repo-sync: нативные модули |
| 17.09.2026 00:57 | typecheck | ✅ без ошибок | 17 с | 887babf +2 | [лог](logs/2026-09-16T19-57-50Z-typecheck-af98.log) | repo-sync: нативные модули |
| 17.09.2026 01:05 | unit (частично: tests/unit/repo-sync.test.ts) | ❌ упало 2 из 15 | 9 с | ed890ec +1 | [лог](logs/2026-09-16T20-05-44Z-unit-b4c0.log) | --fix чинит сам: npm ci, webhook — красный до правки |
| 17.09.2026 01:07 | unit (частично: tests/unit/repo-sync.test.ts) | ✅ 15 из 15 | 6 с | ed890ec +2 | [лог](logs/2026-09-16T20-07-11Z-unit-d277.log) | --fix чинит сам: npm ci, webhook, перезапуск — зелёный |
| 17.09.2026 01:07 | lint | ✅ без ошибок | 14 с | ed890ec +2 | [лог](logs/2026-09-16T20-07-17Z-lint-f19b.log) | repo-sync --fix |
| 17.09.2026 01:07 | typecheck | ✅ без ошибок | 17 с | ed890ec +2 | [лог](logs/2026-09-16T20-07-32Z-typecheck-a80a.log) | repo-sync --fix |
| 16.09.2026 18:37 | unit | ❌ упало 1 из 974 | 1 мин 4 с | 5b6a9c7 +2 | [лог](logs/2026-09-16T13-37-07Z-unit-482a.log) | tokens.css генерируется из design/tokens.json имена переменных прежние: ни одна var(--…) стойки не осталась без определения |
| 16.09.2026 18:40 | unit | ✅ 974 из 974 | 1 мин 4 с | 275cdc2 | [лог](logs/2026-09-16T13-40-59Z-unit-389d.log) |  |
| 14.09.2026 16:32 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --workers=1) | ❌ упало 1 из 25 | 50 с | f40cb76 +4 | [лог](logs/2026-09-14T11-32-23Z-e2e-bdd7.log) | wave 3: guest count capped by category capacity in new booking and rates forms — workspace UI regression |
| 14.09.2026 16:33 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --workers=1) | ✅ 25 из 25 | 1 мин 28 с | 73a5743 +5 | [лог](logs/2026-09-14T11-33-58Z-e2e-61b0.log) | wave 3: workspace UI after guest caps; check-in click on the visible button (hidden streaming copy) |
| 14.09.2026 16:37 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/reservation-tariff.spec.ts --workers=1) | ❌ упало 1 из 3 | 25 с | a833a47 +2 | [лог](logs/2026-09-14T11-37-05Z-e2e-fd44.log) | wave 3 red on committed card page: a failed rate plan lookup replaces the whole booking card with the error screen |
| 14.09.2026 16:37 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/reservation-tariff.spec.ts --workers=1) | ✅ 3 из 3 | 8 с | a833a47 +3 | [лог](logs/2026-09-14T11-37-30Z-e2e-fdd6.log) | wave 3 green: booking card survives a failed rate plan / inventory lookup with a warning |
| 14.09.2026 16:38 | unit (частично: apps/api/src/desk) | ❌ упало 1 из 3 | 1 с | 9149176 +2 | [лог](logs/2026-09-14T11-38-58Z-unit-660b.log) | wave 3 red: confirmed stays that should have arrived before today appear in no /today list |
| 14.09.2026 16:39 | unit (частично: apps/api/src/desk) | ✅ 3 из 3 | 1 с | 9149176 +4 | [лог](logs/2026-09-14T11-39-22Z-unit-dcaf.log) | wave 3 green: /desk/today returns overdue arrivals |
| 14.09.2026 16:44 | unit (частично: apps/api/src/inventory/inventory.repository.test.ts) | ❌ упало 1 из 1 | 1 с | 35ac3f2 +2 | [лог](logs/2026-09-14T11-44-23Z-unit-ede6.log) | wave 4 red: inventory tree re-read from the database on every request |
| 14.09.2026 16:45 | unit (частично: apps/api/src/inventory scripts/imports/src/exely) | ✅ 73 из 73 | 1 с | 35ac3f2 +5 | [лог](logs/2026-09-14T11-45-19Z-unit-f7b1.log) | wave 4 green: inventory tree cached in the API (60 s), active blocks counted per request |
| 17.09.2026 01:14 | typecheck | ✅ без ошибок | 19 с | 76add5e | [лог](logs/2026-09-16T20-14-48Z-typecheck-d358.log) | после слияния main и трёх cherry-pick из backup/pms-lux |
| 17.09.2026 01:15 | lint | ✅ без ошибок | 11 с | 76add5e | [лог](logs/2026-09-16T20-15-07Z-lint-7308.log) | после слияния main и трёх cherry-pick |
| 17.09.2026 01:17 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/reservation-tariff.spec.ts tests/ui/workspace.spec.ts) | ✅ 28 из 28 | 1 мин 44 с | 76add5e | [лог](logs/2026-09-16T20-17-11Z-e2e-e547.log) | cherry-pick из backup/pms-lux: спеки формы брони и главной, синтетический API |
| 17.09.2026 01:18 | unit (частично: apps/api/src/inventory scripts/imports apps/web) | ✅ 143 из 143 | 3 с | 76add5e | [лог](logs/2026-09-16T20-18-57Z-unit-deac.log) | cherry-pick из backup/pms-lux: фонд в памяти, форма брони, карточка |
| 17.09.2026 01:24 | integration | ❌ код выхода 1 | 3 мин 3 с | 739f7e9 | [лог](logs/2026-09-16T20-24-54Z-integration-72db.log) | (файл не выполнился) |
| 17.09.2026 13:11 | typecheck | ✅ без ошибок | 17 с | 95fc0cb +1 | [лог](logs/2026-09-17T08-11-00Z-typecheck-af7a.log) | audit-author.test.ts: PrismaService в корневом тестовом модуле |
| 17.09.2026 13:11 | lint | ✅ без ошибок | 11 с | 95fc0cb +1 | [лог](logs/2026-09-17T08-11-18Z-lint-ae45.log) | audit-author.test.ts |
| 17.09.2026 13:09 | integration (частично: tests/integration/audit-author.test.ts) | ❌ код выхода 1 | 7 с | 8b28b33 | [лог](logs/2026-09-17T08-09-10Z-integration-d8c7.log) | (файл не выполнился) |
| 17.09.2026 13:14 | integration (частично: tests/integration/audit-author.test.ts) | ❌ код выхода 1 | 8 с | 8b28b33 | [лог](logs/2026-09-17T08-14-26Z-integration-bb2b.log) | (файл не выполнился) |
| 17.09.2026 13:16 | integration (частично: tests/integration/audit-author.test.ts) | ✅ 3 из 3 | 9 с | 461b716 | [лог](logs/2026-09-17T08-16-52Z-integration-d586.log) |  |
| 17.09.2026 13:31 | unit (частично: tests/unit/repo-sync.test.ts) | ❌ упало 3 из 18 | 6 с | a681438 +1 | [лог](logs/2026-09-17T08-31-11Z-unit-74b1.log) | next-env.d.ts от сборки: красный до правки |
| 17.09.2026 13:32 | unit (частично: tests/unit/repo-sync.test.ts) | ✅ 18 из 18 | 5 с | a681438 +2 | [лог](logs/2026-09-17T08-32-45Z-unit-6bfc.log) | next-env.d.ts от сборки: зелёный |
| 17.09.2026 13:32 | lint | ✅ без ошибок | 10 с | a681438 +2 | [лог](logs/2026-09-17T08-32-55Z-lint-3485.log) | repo-sync: файлы от сборки |
| 17.09.2026 13:33 | typecheck | ✅ без ошибок | 13 с | a681438 +2 | [лог](logs/2026-09-17T08-33-05Z-typecheck-685a.log) | repo-sync: файлы от сборки |
| 17.09.2026 13:44 | unit (частично: apps/api/src/desk) | ❌ упало 3 из 3 | 2 с | 28531f3 +1 | [лог](logs/2026-09-17T08-44-22Z-unit-7e6b.log) | просроченные заезды: красный до кода |
| 17.09.2026 13:45 | unit (частично: apps/api/src/desk) | ✅ 3 из 3 | 2 с | 28531f3 +5 | [лог](logs/2026-09-17T08-45-23Z-unit-588a.log) | просроченные заезды: зелёный |
| 17.09.2026 13:46 | typecheck | ✅ без ошибок | 16 с | 28531f3 +7 | [лог](logs/2026-09-17T08-46-41Z-typecheck-3f9c.log) | просроченные заезды |
| 17.09.2026 13:47 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts) | ✅ 25 из 25 | 1 мин 27 с | 28531f3 +7 | [лог](logs/2026-09-17T08-47-03Z-e2e-8bd1.log) | просроченные заезды в «Требуют внимания» |
| 17.09.2026 13:48 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 95 | 8 мин 18 с | 28531f3 +7 | [лог](logs/2026-09-17T08-48-38Z-e2e-e791.log) | весь UI-набор после просроченных заездов |
| 17.09.2026 13:56 | lint | ✅ без ошибок | 9 с | 28531f3 +7 | [лог](logs/2026-09-17T08-56-59Z-lint-cab8.log) | просроченные заезды |
| 17.09.2026 13:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/premium.spec.ts tests/ui/quality.spec.ts) | ✅ 20 из 20 | 1 мин 10 с | 28531f3 +9 | [лог](logs/2026-09-17T08-57-30Z-e2e-d647.log) | счётчики фикстуры после новой брони |
| 17.09.2026 13:58 | unit | ❌ упало 3 из 1014 | 1 мин 32 с | 28531f3 +6 | [лог](logs/2026-09-17T08-58-46Z-unit-a7e1.log) | просроченные заезды: весь набор |
| 17.09.2026 14:49 | unit (частично: apps/api/src/channels/ari-delta-lost.test.ts apps/api/src/guard) | ❌ упало 2 из 33 | 2 с | 9b697fe +2 | [лог](logs/2026-09-17T09-49-14Z-unit-ff43.log) | потерянная дельта ARI: красный до кода |
| 17.09.2026 14:50 | unit (частично: apps/api/src/channels/ari-delta-lost.test.ts apps/api/src/guard packages/domain/src/incidents) | ✅ 73 из 73 | 2 с | 9b697fe +8 | [лог](logs/2026-09-17T09-50-26Z-unit-8402.log) | потерянная дельта ARI: зелёный |
| 17.09.2026 14:50 | typecheck | ❌ ошибок: 7 | 16 с | 9b697fe +8 | [лог](logs/2026-09-17T09-50-34Z-typecheck-6f3f.log) | потерянная дельта ARI |
| 17.09.2026 14:50 | lint | ✅ без ошибок | 10 с | 9b697fe +8 | [лог](logs/2026-09-17T09-50-50Z-lint-0fd2.log) | потерянная дельта ARI |
| 17.09.2026 14:51 | unit | ❌ упало 3 из 1019 | 1 мин 32 с | 9b697fe +8 | [лог](logs/2026-09-17T09-51-00Z-unit-671f.log) | потерянная дельта ARI: весь набор |
| 17.09.2026 14:52 | typecheck | ❌ ошибок: 3 | 13 с | 9b697fe +8 | [лог](logs/2026-09-17T09-52-58Z-typecheck-484d.log) | потерянная дельта: типы подделок |
| 17.09.2026 14:53 | typecheck | ✅ без ошибок | 13 с | 9b697fe +8 | [лог](logs/2026-09-17T09-53-25Z-typecheck-9f4f.log) | потерянная дельта: типы |
| 17.09.2026 14:53 | unit (частично: apps/api/src/channels/ari-delta-lost.test.ts apps/api/src/guard) | ✅ 33 из 33 | 2 с | 9b697fe +8 | [лог](logs/2026-09-17T09-53-38Z-unit-f5b3.log) | потерянная дельта: зелёный после типов |
| 17.09.2026 14:53 | lint | ✅ без ошибок | 9 с | 9b697fe +8 | [лог](logs/2026-09-17T09-53-51Z-lint-581d.log) | потерянная дельта ARI |
| 17.09.2026 14:54 | unit | ❌ упало 3 из 1019 | 1 мин 32 с | 9b697fe +8 | [лог](logs/2026-09-17T09-54-01Z-unit-cf70.log) | потерянная дельта ARI: весь набор |
| 17.09.2026 14:59 | unit (частично: apps/api/src/finance/finance-audit-transaction.test.ts) | ❌ упало 3 из 4 | 1 с | adffc9c +1 | [лог](logs/2026-09-17T09-59-38Z-unit-516f.log) | журнал финансов в транзакции: красный до кода |
| 17.09.2026 15:01 | typecheck | ❌ ошибок: 2 | 13 с | adffc9c +3 | [лог](logs/2026-09-17T10-01-23Z-typecheck-5508.log) | журнал финансов в транзакции |
| 17.09.2026 15:01 | typecheck | ✅ без ошибок | 13 с | adffc9c +3 | [лог](logs/2026-09-17T10-01-51Z-typecheck-4565.log) | журнал финансов в транзакции |
| 17.09.2026 15:02 | unit (частично: apps/api/src/finance) | ❌ упало 5 из 14 | 2 с | adffc9c +3 | [лог](logs/2026-09-17T10-02-04Z-unit-c139.log) | журнал финансов в транзакции: зелёный |
| 17.09.2026 15:02 | unit (частично: apps/api/src/finance) | ✅ 14 из 14 | 2 с | adffc9c +4 | [лог](logs/2026-09-17T10-02-34Z-unit-8dae.log) | журнал финансов в транзакции: подделка репозитория обновлена |
| 17.09.2026 15:02 | typecheck | ✅ без ошибок | 13 с | adffc9c +4 | [лог](logs/2026-09-17T10-02-41Z-typecheck-2a12.log) | журнал финансов |
| 17.09.2026 15:02 | lint | ✅ без ошибок | 9 с | adffc9c +4 | [лог](logs/2026-09-17T10-02-54Z-lint-af46.log) | журнал финансов |
| 17.09.2026 15:03 | unit | ❌ упало 3 из 1023 | 1 мин 32 с | adffc9c +4 | [лог](logs/2026-09-17T10-03-03Z-unit-0d1c.log) | журнал финансов в транзакции: весь набор |
| 17.09.2026 15:06 | e2e (частично: tests/e2e/finance.spec.ts) | ✅ 2 из 2 | 1 мин 19 с | 9147e94 | [лог](logs/2026-09-17T10-06-30Z-e2e-c8a1.log) |  |
| 17.09.2026 15:35 | unit | ❌ упало 3 из 1024 | 1 мин 32 с | 8d5b4f1 +11 | [лог](logs/2026-09-17T10-35-04Z-unit-0497.log) | подтверждения вместо window.confirm: сторож правила и план перетаскивания |
| 17.09.2026 15:36 | typecheck | ✅ без ошибок | 17 с | 8d5b4f1 +23 | [лог](logs/2026-09-17T10-36-44Z-typecheck-1a04.log) | подтверждения вместо window.confirm |
| 17.09.2026 15:37 | lint | ✅ без ошибок | 9 с | 8d5b4f1 +23 | [лог](logs/2026-09-17T10-37-01Z-lint-b3c6.log) | подтверждения вместо window.confirm |
| 17.09.2026 15:37 | e2e (частично: --config tests/ui/playwright.config.ts --reporter=list) | ❌ код выхода 1 | 5 мин 29 с | 8d5b4f1 +23 | [лог](logs/2026-09-17T10-37-15Z-e2e-b8a9.log) | UI-набор целиком: окна подтверждения на экранах |
| 17.09.2026 15:43 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 97 из 97 | 7 мин 47 с | 8d5b4f1 +23 | [лог](logs/2026-09-17T10-43-05Z-e2e-15ac.log) | UI-набор целиком на окнах подтверждения (в два воркера фикстура одна на всех — прогон 15:37 упал не по коду) |
| 17.09.2026 16:04 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 98 из 98 | 8 мин 14 с | a4c4376 +5 | [лог](logs/2026-09-17T11-04-33Z-e2e-c2d8.log) | гости на сегодня: весь список, не первые 25 |
| 17.09.2026 16:12 | unit | ❌ упало 3 из 1026 | 1 мин 32 с | a4c4376 +4 | [лог](logs/2026-09-17T11-12-52Z-unit-1753.log) | гости на сегодня: размер страницы у справочника броней |
| 17.09.2026 16:14 | typecheck | ✅ без ошибок | 18 с | a4c4376 +5 | [лог](logs/2026-09-17T11-14-24Z-typecheck-9cca.log) |  |
| 17.09.2026 16:14 | lint | ✅ без ошибок | 10 с | a4c4376 +5 | [лог](logs/2026-09-17T11-14-42Z-lint-c620.log) |  |
| 17.09.2026 16:19 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 101 из 101 | 8 мин 6 с | 8fcdffa +4 | [лог](logs/2026-09-17T11-19-28Z-e2e-2a1b.log) | подписи ведут туда, куда написано: услуги, адреса, две кнопки |
| 17.09.2026 16:27 | typecheck | ✅ без ошибок | 13 с | 8fcdffa +4 | [лог](logs/2026-09-17T11-27-38Z-typecheck-d11d.log) |  |
| 17.09.2026 16:27 | lint | ✅ без ошибок | 10 с | 8fcdffa +4 | [лог](logs/2026-09-17T11-27-52Z-lint-17ad.log) |  |
| 17.09.2026 16:31 | unit | ❌ упало 3 из 1027 | 1 мин 32 с | fba8bee +10 | [лог](logs/2026-09-17T11-31-55Z-unit-c1f2.log) | «ушло в очередь каналов» — по ответу API |
| 17.09.2026 16:33 | typecheck | ✅ без ошибок | 17 с | fba8bee +11 | [лог](logs/2026-09-17T11-33-27Z-typecheck-8568.log) |  |
| 17.09.2026 16:33 | lint | ✅ без ошибок | 9 с | fba8bee +11 | [лог](logs/2026-09-17T11-33-44Z-lint-6e76.log) |  |
| 17.09.2026 16:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 101 из 101 | 8 мин 8 с | fba8bee +11 | [лог](logs/2026-09-17T11-34-00Z-e2e-3e2e.log) | честное «ушло в очередь каналов» |
| 17.09.2026 16:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 102 из 102 | 8 мин 2 с | ab8af83 +2 | [лог](logs/2026-09-17T11-45-54Z-e2e-32cf.log) | предел периода доступности объясняется формой |
| 17.09.2026 16:53 | typecheck | ✅ без ошибок | 13 с | ab8af83 +2 | [лог](logs/2026-09-17T11-53-56Z-typecheck-aea9.log) |  |
| 17.09.2026 16:54 | lint | ✅ без ошибок | 10 с | ab8af83 +2 | [лог](logs/2026-09-17T11-54-10Z-lint-6cd7.log) |  |
| 17.09.2026 17:01 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 104 из 104 | 8 мин 16 с | 09673c8 +5 | [лог](logs/2026-09-17T12-01-35Z-e2e-f1d0.log) | сбой шахматки на «Номерах» и обрезанная история неисправностей названы своими словами |
| 17.09.2026 17:09 | typecheck | ✅ без ошибок | 14 с | 09673c8 +5 | [лог](logs/2026-09-17T12-09-52Z-typecheck-76b6.log) |  |
| 17.09.2026 17:10 | lint | ✅ без ошибок | 9 с | 09673c8 +5 | [лог](logs/2026-09-17T12-10-06Z-lint-f5fa.log) |  |
| 17.09.2026 17:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 107 из 107 | 8 мин 7 с | f7941a0 +4 | [лог](logs/2026-09-17T12-15-31Z-e2e-41ff.log) | демо брони, время по Алматы, стойкость каналов |
| 17.09.2026 17:23 | typecheck | ✅ без ошибок | 13 с | f7941a0 +4 | [лог](logs/2026-09-17T12-23-43Z-typecheck-b18a.log) |  |
| 17.09.2026 17:23 | lint | ✅ без ошибок | 9 с | f7941a0 +4 | [лог](logs/2026-09-17T12-23-56Z-lint-dcc6.log) |  |
| 17.09.2026 17:24 | unit | ❌ упало 3 из 1027 | 1 мин 32 с | f7941a0 +3 | [лог](logs/2026-09-17T12-24-06Z-unit-9d80.log) | почасовой помощник Алматы |
| 17.09.2026 17:27 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 108 из 108 | 8 мин 7 с | fbe7a2e +5 | [лог](logs/2026-09-17T12-27-58Z-e2e-55eb.log) | предел периода аналитики, время журнала из базы поясов |
| 17.09.2026 17:36 | unit | ❌ упало 3 из 1028 | 1 мин 32 с | fbe7a2e +4 | [лог](logs/2026-09-17T12-36-06Z-unit-5ed2.log) | предел периода отчёта аналитики |
| 17.09.2026 17:37 | typecheck | ✅ без ошибок | 13 с | fbe7a2e +5 | [лог](logs/2026-09-17T12-37-38Z-typecheck-c4c4.log) |  |
| 17.09.2026 17:37 | lint | ✅ без ошибок | 9 с | fbe7a2e +5 | [лог](logs/2026-09-17T12-37-52Z-lint-22b0.log) |  |
| 17.09.2026 19:27 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 109 из 109 | 9 мин 27 с | 238177d +5 | [лог](logs/2026-09-17T14-27-08Z-e2e-9480.log) | таймаут Channex, подтверждение оплаты |
| 17.09.2026 19:36 | unit | ❌ упало 3 из 1030 | 1 мин 32 с | 238177d +4 | [лог](logs/2026-09-17T14-36-45Z-unit-77d7.log) | таймаут запроса в Channex |
| 17.09.2026 19:38 | typecheck | ✅ без ошибок | 14 с | 238177d +5 | [лог](logs/2026-09-17T14-38-18Z-typecheck-2a2b.log) |  |
| 17.09.2026 19:38 | lint | ✅ без ошибок | 12 с | 238177d +5 | [лог](logs/2026-09-17T14-38-32Z-lint-2f6e.log) |  |
| 17.09.2026 19:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 110 | 9 мин 32 с | 31ee85c +8 | [лог](logs/2026-09-17T14-46-13Z-e2e-f61b.log) | пределы периодов и кэш настроек объекта |
| 17.09.2026 19:56 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 110 из 110 | 9 мин 31 с | 31ee85c +8 | [лог](logs/2026-09-17T14-56-24Z-e2e-7e91.log) | пределы периодов, кэш настроек объекта |
| 17.09.2026 20:06 | unit | ❌ упало 3 из 1031 | 1 мин 32 с | 31ee85c +7 | [лог](logs/2026-09-17T15-06-00Z-unit-9801.log) | пределы периодов, кэш настроек объекта |
| 17.09.2026 20:07 | typecheck | ✅ без ошибок | 15 с | 31ee85c +8 | [лог](logs/2026-09-17T15-07-33Z-typecheck-6d86.log) |  |
| 17.09.2026 20:07 | lint | ✅ без ошибок | 11 с | 31ee85c +8 | [лог](logs/2026-09-17T15-07-48Z-lint-c066.log) |  |
| 17.09.2026 20:13 | unit | ❌ упало 3 из 1032 | 1 мин 32 с | ce9d860 +2 | [лог](logs/2026-09-17T15-13-51Z-unit-ec51.log) | журнал: сводка считается в базе, снимки не едут в список |
| 17.09.2026 20:15 | typecheck | ✅ без ошибок | 15 с | ce9d860 +3 | [лог](logs/2026-09-17T15-15-24Z-typecheck-c273.log) |  |
| 17.09.2026 20:15 | lint | ✅ без ошибок | 11 с | ce9d860 +3 | [лог](logs/2026-09-17T15-15-39Z-lint-904e.log) |  |
| 17.09.2026 20:21 | integration | ✅ 32 из 32 | 9 с | 1d1fba4 +1 | [лог](logs/2026-09-17T15-21-05Z-integration-3187.log) | локальная база в контейнере (scripts/ops/local-db.sh) |
| 17.09.2026 20:21 | unit | ❌ упало 3 из 1035 | 1 мин 32 с | 1d1fba4 +4 | [лог](logs/2026-09-17T15-21-59Z-unit-be8a.log) | локальная база: засев и защита от чужого адреса |
| 17.09.2026 20:23 | typecheck | ✅ без ошибок | 19 с | 1d1fba4 +4 | [лог](logs/2026-09-17T15-23-35Z-typecheck-8a47.log) |  |
| 17.09.2026 20:23 | lint | ✅ без ошибок | 11 с | 1d1fba4 +4 | [лог](logs/2026-09-17T15-23-55Z-lint-a0ec.log) |  |
| 17.09.2026 20:49 | unit | ❌ упало 3 из 1035 | 1 мин 32 с | 130a088 +1 | [лог](logs/2026-09-17T15-49-45Z-unit-7c64.log) | локальный стенд: форма объекта 88 единиц и календарь цен |
| 17.09.2026 20:51 | typecheck | ✅ без ошибок | 14 с | 130a088 +2 | [лог](logs/2026-09-17T15-51-17Z-typecheck-0ad2.log) |  |
| 17.09.2026 20:51 | lint | ✅ без ошибок | 11 с | 130a088 +2 | [лог](logs/2026-09-17T15-51-32Z-lint-10a6.log) |  |
| 17.09.2026 21:26 | typecheck | ✅ без ошибок | 15 с | 7703e49 +16 | [лог](logs/2026-09-17T16-26-22Z-typecheck-dbb4.log) |  |
| 17.09.2026 21:26 | lint | ✅ без ошибок | 11 с | 7703e49 +16 | [лог](logs/2026-09-17T16-26-37Z-lint-3dc8.log) |  |
| 17.09.2026 22:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g шахматка) | ✅ 4 из 4 | 14 с | 2cc1363 +10 | [лог](logs/2026-09-17T17-03-15Z-e2e-f6f0.log) |  |
| 17.09.2026 22:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 4 мин 8 с | 2cc1363 +10 | [лог](logs/2026-09-17T17-03-38Z-e2e-9131.log) |  |
| 17.09.2026 22:07 | integration (частично: -t канал) | ❌ упало 1 из 33, пропущено 32 | 6 с | 2cc1363 +5 | [лог](logs/2026-09-17T17-07-59Z-integration-0eec.log) | шахматка: канал, долг и уборка из базы (integration, rolled back) клетка несёт канал и остаток по счёту, строка ячейки — статус уборки |
| 17.09.2026 22:08 | integration | ✅ 33 из 33 | 10 с | 2cc1363 +5 | [лог](logs/2026-09-17T17-08-14Z-integration-34e2.log) |  |
| 17.09.2026 22:08 | typecheck | ✅ без ошибок | 16 с | 2cc1363 +12 | [лог](logs/2026-09-17T17-08-29Z-typecheck-1693.log) |  |
| 17.09.2026 22:08 | lint | ✅ без ошибок | 11 с | 2cc1363 +12 | [лог](logs/2026-09-17T17-08-46Z-lint-37af.log) |  |
| 17.09.2026 22:09 | unit | ❌ упало 3 из 1038 | 1 мин 32 с | 2cc1363 +10 | [лог](logs/2026-09-17T17-09-04Z-unit-0be0.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 17.09.2026 22:10 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 113 из 113 | 9 мин 41 с | 2cc1363 +11 | [лог](logs/2026-09-17T17-10-46Z-e2e-df6c.log) |  |
| 17.09.2026 22:27 | integration (частично: -t журнал каналов) | ✅ 2 из 35, пропущено 33 | 7 с | a6434dd +4 | [лог](logs/2026-09-17T17-27-24Z-integration-1b1d.log) |  |
| 17.09.2026 22:28 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g очередь показана строками\|входящая бронь ведёт\|правка в ячейке календаря) | ❌ упало 3 из 3 | 1 мин 25 с | a6434dd +5 | [лог](logs/2026-09-17T17-28-37Z-e2e-4056.log) | каналы: очередь показана строками — что уехало, за какие даты и чем кончилось |
| 17.09.2026 22:31 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g очередь показана строками\|входящая бронь ведёт) | ✅ 2 из 2 | 8 с | a6434dd +7 | [лог](logs/2026-09-17T17-31-16Z-e2e-205a.log) |  |
| 17.09.2026 22:33 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g правка в ячейке календаря) | ✅ 1 из 1 | 7 с | a6434dd +10 | [лог](logs/2026-09-17T17-33-10Z-e2e-e5e2.log) |  |
| 17.09.2026 22:33 | typecheck | ❌ ошибок: 1 | 15 с | a6434dd +11 | [лог](logs/2026-09-17T17-33-24Z-typecheck-c741.log) | TS2322 |
| 17.09.2026 22:33 | lint | ✅ без ошибок | 10 с | a6434dd +11 | [лог](logs/2026-09-17T17-33-39Z-lint-5a95.log) |  |
| 17.09.2026 22:34 | typecheck | ✅ без ошибок | 15 с | a6434dd +11 | [лог](logs/2026-09-17T17-34-08Z-typecheck-34ed.log) |  |
| 17.09.2026 22:34 | unit | ❌ упало 3 из 1039 | 1 мин 32 с | a6434dd +9 | [лог](logs/2026-09-17T17-34-24Z-unit-752b.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 17.09.2026 22:36 | integration | ✅ 35 из 35 | 11 с | a6434dd +5 | [лог](logs/2026-09-17T17-36-03Z-integration-04f8.log) |  |
| 17.09.2026 22:36 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 45 с | a6434dd +10 | [лог](logs/2026-09-17T17-36-22Z-e2e-4a5d.log) |  |
| 17.09.2026 22:37 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g шахматка\|правка в ячейке) | ✅ 5 из 5 | 15 с | a6434dd +11 | [лог](logs/2026-09-17T17-37-40Z-e2e-168e.log) |  |
| 17.09.2026 22:38 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 116 из 116 | 9 мин 45 с | a6434dd +11 | [лог](logs/2026-09-17T17-38-03Z-e2e-9c2d.log) |  |
| 17.09.2026 22:48 | lint | ✅ без ошибок | 11 с | 8d29932 | [лог](logs/2026-09-17T17-48-49Z-lint-910e.log) |  |
| 17.09.2026 22:49 | typecheck | ✅ без ошибок | 19 с | 8d29932 | [лог](logs/2026-09-17T17-49-00Z-typecheck-84b8.log) |  |
| 17.09.2026 23:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g незаезд: окно называет\|\+1 ночь. спрашивает\|отмена брони: окно называет) | ❌ упало 3 из 3 | 22 с | 8725d53 +6 | [лог](logs/2026-09-17T18-11-27Z-e2e-e7ae.log) | незаезд: окно называет штраф суммой, а не «может начислиться» |
| 17.09.2026 23:12 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g незаезд: окно называет\|\+1 ночь. спрашивает\|отмена брони: окно называет) | ❌ упало 3 из 3 | 57 с | 8725d53 +6 | [лог](logs/2026-09-17T18-12-01Z-e2e-a2e0.log) | незаезд: окно называет штраф суммой, а не «может начислиться» |
| 17.09.2026 23:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g незаезд: окно называет\|\+1 ночь. спрашивает\|отмена брони: окно называет) | ❌ упало 1 из 3 | 28 с | 8725d53 +10 | [лог](logs/2026-09-17T18-15-18Z-e2e-4cab.log) | незаезд: окно называет штраф суммой, а не «может начислиться» |
| 17.09.2026 23:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 -g незаезд: окно называет) | ✅ 1 из 1 | 8 с | 8725d53 +10 | [лог](logs/2026-09-17T18-15-55Z-e2e-4821.log) |  |
| 18.09.2026 09:59 | typecheck | ✅ без ошибок | 23 с | 8725d53 +11 | [лог](logs/2026-09-18T04-59-55Z-typecheck-c85d.log) |  |
| 18.09.2026 10:00 | lint | ✅ без ошибок | 15 с | 8725d53 +11 | [лог](logs/2026-09-18T05-00-19Z-lint-bc0b.log) |  |
| 18.09.2026 10:00 | unit | ❌ упало 3 из 1048 | 1 мин 39 с | 8725d53 +10 | [лог](logs/2026-09-18T05-00-42Z-unit-f140.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 18.09.2026 10:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 3 из 119 | 14 мин 7 с | 8725d53 +11 | [лог](logs/2026-09-18T05-02-30Z-e2e-39f8.log) | в неделе работают бронь, категории и создание на воскресенье |
| 18.09.2026 10:17 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/chessboard-week.spec.ts tests/ui/quality.spec.ts tests/ui/reservation-tariff.spec.ts) | ✅ 24 из 24 | 1 мин 36 с | 8725d53 +14 | [лог](logs/2026-09-18T05-17-06Z-e2e-e09d.log) |  |
| 18.09.2026 10:18 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 119 из 119 | 12 мин 20 с | 8725d53 +14 | [лог](logs/2026-09-18T05-18-50Z-e2e-0037.log) |  |
| 18.09.2026 10:31 | lint | ✅ без ошибок | 14 с | 8725d53 +15 | [лог](logs/2026-09-18T05-31-24Z-lint-ec79.log) |  |
| 18.09.2026 10:31 | typecheck | ✅ без ошибок | 24 с | 8725d53 +15 | [лог](logs/2026-09-18T05-31-38Z-typecheck-5f51.log) |  |
| 18.09.2026 10:51 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 1 мин 21 с | 55086c2 +40 | [лог](logs/2026-09-18T05-51-22Z-e2e-9227.log) |  |
| 18.09.2026 10:53 | unit | ❌ упало 3 из 1053 | 1 мин 33 с | 55086c2 +31 | [лог](logs/2026-09-18T05-53-50Z-unit-1742.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 18.09.2026 10:55 | typecheck | ✅ без ошибок | 23 с | 55086c2 +41 | [лог](logs/2026-09-18T05-55-26Z-typecheck-18d3.log) |  |
| 18.09.2026 10:55 | lint | ✅ без ошибок | 18 с | 55086c2 +41 | [лог](logs/2026-09-18T05-55-50Z-lint-e6d3.log) |  |
| 18.09.2026 10:53 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 119 | 12 мин 24 с | 55086c2 +41 | [лог](logs/2026-09-18T05-53-05Z-e2e-f4d8.log) | axe и эталонные снимки секций: light |
| 18.09.2026 11:06 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/design-system.spec.ts --update-snapshots) | ✅ 8 из 8 | 45 с | 55086c2 +41 | [лог](logs/2026-09-18T06-06-11Z-e2e-4779.log) |  |
| 18.09.2026 11:07 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 119 | 12 мин 15 с | 55086c2 +41 | [лог](logs/2026-09-18T06-07-16Z-e2e-cb32.log) | axe и эталонные снимки секций: light |
| 18.09.2026 14:52 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/design-system.spec.ts --update-snapshots) | ✅ 8 из 8 | 1 мин 50 с | 55086c2 +41 | [лог](logs/2026-09-18T09-52-07Z-e2e-4bc6.log) |  |
| 18.09.2026 14:53 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/design-system.spec.ts) | ✅ 8 из 8 | 32 с | 55086c2 +41 | [лог](logs/2026-09-18T09-53-57Z-e2e-23d9.log) |  |
| 18.09.2026 14:54 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 119 из 119 | 9 мин 25 с | 55086c2 +41 | [лог](logs/2026-09-18T09-54-40Z-e2e-1a2e.log) |  |
| 18.09.2026 15:09 | unit | ❌ упало 3 из 1057 | 1 мин 33 с | d12e610 +8 | [лог](logs/2026-09-18T10-09-01Z-unit-2a08.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 18.09.2026 15:10 | typecheck | ✅ без ошибок | 25 с | d12e610 +8 | [лог](logs/2026-09-18T10-10-41Z-typecheck-86d8.log) |  |
| 18.09.2026 15:11 | lint | ✅ без ошибок | 13 с | d12e610 +8 | [лог](logs/2026-09-18T10-11-07Z-lint-b392.log) |  |
| 18.09.2026 15:08 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 119 из 119 | 9 мин 43 с | d12e610 +8 | [лог](logs/2026-09-18T10-08-59Z-e2e-5819.log) |  |
| 18.09.2026 15:23 | e2e | ❌ упало 10 из 23 | 8 мин 27 с | 12a67c5 +10 | [лог](logs/2026-09-18T10-23-49Z-e2e-9afe.log) | заселить → карточка и шахматка показывают «заселён» → выселить; незаезд освобождает ячейку |
| 18.09.2026 15:35 | e2e | ❌ упало 4 из 23 | 56 с | 12a67c5 +13 | [лог](logs/2026-09-18T10-35-54Z-e2e-588d.log) | заселить → карточка и шахматка показывают «заселён» → выселить; незаезд освобождает ячейку |
| 18.09.2026 15:38 | e2e | ❌ упало 2 из 23 | 58 с | 12a67c5 +15 | [лог](logs/2026-09-18T10-38-00Z-e2e-07a3.log) | создать бронь с ячейкой → видна в шахматке → отменить → ячейка свободна |
| 18.09.2026 15:41 | e2e | ❌ упало 1 из 23 | 56 с | 12a67c5 +15 | [лог](logs/2026-09-18T10-41-04Z-e2e-c6bc.log) | главная открывается с корня; заезд на дату виден в счётчике и в «Требуют внимания» |
| 18.09.2026 15:43 | e2e | ❌ упало 2 из 23 | 54 с | 12a67c5 +18 | [лог](logs/2026-09-18T10-43-13Z-e2e-bf21.log) | групповая бронь на 2 койки → две клетки шахматки; правка заметок, источника и гостей; ручное закрытие счёта |
| 18.09.2026 15:45 | e2e | ❌ упало 3 из 23 | 2 мин 27 с | 12a67c5 +20 | [лог](logs/2026-09-18T10-45-24Z-e2e-2030.log) | регистрационная карта печатается на RU и KZ; журнал показывает действия |
| 18.09.2026 15:48 | e2e | ❌ упало 1 из 23 | 56 с | 12a67c5 +20 | [лог](logs/2026-09-18T10-48-22Z-e2e-2ffa.log) | перетаскивание клетки брони на свободную койку той же категории переселяет с даты клетки |
| 18.09.2026 15:49 | e2e | ✅ 23 из 23 | 55 с | 12a67c5 +20 | [лог](logs/2026-09-18T10-49-56Z-e2e-f077.log) |  |
| 18.09.2026 15:51 | unit | ❌ упало 3 из 1060 | 1 мин 32 с | 12a67c5 +2 | [лог](logs/2026-09-18T10-51-18Z-unit-6d14.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 18.09.2026 15:53 | typecheck | ✅ без ошибок | 20 с | 12a67c5 +22 | [лог](logs/2026-09-18T10-53-02Z-typecheck-27ab.log) |  |
| 18.09.2026 15:53 | lint | ✅ без ошибок | 10 с | 12a67c5 +22 | [лог](logs/2026-09-18T10-53-22Z-lint-a700.log) |  |
| 18.09.2026 15:58 | unit (частично: apps/web/src/design-rules.test.ts apps/web/src/lib/block-types.test.ts tests/unit/fixture-incident-kinds.test.ts) | ❌ упало 4 из 14 | 1 с | 4e29fd3 +3 | [лог](logs/2026-09-18T10-58-24Z-unit-dc6a.log) | фикстура UI: виды неисправностей — только из домена каждый kind у Incident в fixture-api.ts есть в POLICY |
| 18.09.2026 15:58 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/chessboard-blocks.spec.ts) | ❌ упало 1 из 1 | 8 с | 4e29fd3 +3 | [лог](logs/2026-09-18T10-58-19Z-e2e-5230.log) | клетка блокировки заштрихована и называет тип словом |
| 18.09.2026 15:59 | unit (частично: apps/web/src/design-rules.test.ts apps/web/src/lib/block-types.test.ts tests/unit/fixture-incident-kinds.test.ts) | ✅ 16 из 16 | 1 с | 4e29fd3 +10 | [лог](logs/2026-09-18T10-59-45Z-unit-fe12.log) |  |
| 18.09.2026 15:59 | typecheck | ❌ ошибок: 1 | 24 с | 4e29fd3 +11 | [лог](logs/2026-09-18T10-59-47Z-typecheck-e3d5.log) | TS2304 |
| 18.09.2026 16:00 | lint | ✅ без ошибок | 13 с | 4e29fd3 +11 | [лог](logs/2026-09-18T11-00-12Z-lint-1f44.log) |  |
| 18.09.2026 15:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 1 мин 18 с | 4e29fd3 +10 | [лог](logs/2026-09-18T10-59-37Z-e2e-2ec2.log) |  |
| 18.09.2026 16:01 | typecheck | ✅ без ошибок | 15 с | 4e29fd3 +11 | [лог](logs/2026-09-18T11-01-06Z-typecheck-9c00.log) |  |
| 18.09.2026 16:01 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 120 | 9 мин 19 с | 4e29fd3 +10 | [лог](logs/2026-09-18T11-01-36Z-e2e-78d9.log) | клетка блокировки заштрихована и называет тип словом |
| 19.09.2026 16:31 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/chessboard-blocks.spec.ts) | ✅ 1 из 1 | 1 мин 34 с | 4e29fd3 +11 | [лог](logs/2026-09-19T11-31-52Z-e2e-57a2.log) |  |
| 19.09.2026 16:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 120 из 120 | 12 мин 41 с | 4e29fd3 +11 | [лог](logs/2026-09-19T11-34-27Z-e2e-6f68.log) |  |
| 19.09.2026 16:47 | unit | ❌ упало 3 из 1066 | 1 мин 35 с | 4e29fd3 +11 | [лог](logs/2026-09-19T11-47-19Z-unit-eead.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 19.09.2026 16:48 | lint | ✅ без ошибок | 17 с | 4e29fd3 +12 | [лог](logs/2026-09-19T11-48-55Z-lint-ccef.log) |  |
| 19.09.2026 16:53 | integration | ❌ код выхода 1 | 1 с | 1df6994 | [лог](logs/2026-09-19T11-53-55Z-integration-3a17.log) |  |
| 19.09.2026 16:54 | integration | ✅ 35 из 35 | 14 с | 1df6994 | [лог](logs/2026-09-19T11-54-35Z-integration-276e.log) |  |
| 19.09.2026 16:56 | e2e | ✅ 23 из 23 | 1 мин 12 с | df3aa80 | [лог](logs/2026-09-19T11-56-19Z-e2e-a162.log) |  |
| 19.09.2026 17:10 | unit (частично: packages/domain/src/accounts/invite.test.ts packages/integrations/src/mail/invite-letter.test.ts apps/api/src/accounts/invites.controller.test.t | ❌ упало 6 из 6 | 3 с | 0933804 +3 | [лог](logs/2026-09-19T12-10-58Z-unit-475c.log) | приглашение: только для вошедшего без сессии — 401 и на создание, и на список |
| 19.09.2026 17:11 | integration (частично: tests/integration/invites.test.ts) | ❌ упало 3 из 3 | 2 с | 0933804 +4 | [лог](logs/2026-09-19T12-11-01Z-integration-90c2.log) | invites repository (integration, DATABASE_URL required) создание → поиск по отпечатку → принятие → список без принятых и просроченных |
| 19.09.2026 17:14 | unit (частично: packages/domain/src/accounts/invite.test.ts packages/integrations/src/mail/invite-letter.test.ts apps/api/src/accounts/invites.controller.test.t | ❌ упало 5 из 14 | 3 с | 0933804 +16 | [лог](logs/2026-09-19T12-14-54Z-unit-0bcf.log) | приглашение: создание и список вошедший зовёт по почте: 201, письмо со ссылкой на 7 суток, в базе только отпечаток |
| 19.09.2026 17:14 | integration (частично: tests/integration/invites.test.ts) | ✅ 3 из 3 | 2 с | 0933804 +17 | [лог](logs/2026-09-19T12-14-57Z-integration-ec03.log) |  |
| 19.09.2026 17:15 | unit (частично: packages/domain/src/accounts/invite.test.ts packages/integrations/src/mail/invite-letter.test.ts apps/api/src/accounts/invites.controller.test.t | ✅ 14 из 14 | 3 с | 0933804 +16 | [лог](logs/2026-09-19T12-15-30Z-unit-8312.log) |  |
| 19.09.2026 22:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/invites.spec.ts) | ❌ упало 3 из 4 | 2 мин 19 с | 0933804 +17 | [лог](logs/2026-09-19T17-46-06Z-e2e-433b.log) | вошедший видит ожидающие приглашения и зовёт по почте; ошибки формы — текстом |
| 19.09.2026 22:48 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/invites.spec.ts) | ✅ 4 из 4 | 15 с | 0933804 +25 | [лог](logs/2026-09-19T17-48-25Z-e2e-d4bc.log) |  |
| 19.09.2026 22:49 | unit | ❌ упало 3 из 1080, пропущено 38 | 1 мин 34 с | 0933804 +21 | [лог](logs/2026-09-19T17-49-13Z-unit-6f71.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 19.09.2026 22:50 | integration | ❌ код выхода 1 | 1 с | 0933804 +15 | [лог](logs/2026-09-19T17-50-48Z-integration-e891.log) |  |
| 19.09.2026 22:51 | unit | ❌ упало 3 из 1080 | 1 мин 32 с | 0933804 +21 | [лог](logs/2026-09-19T17-51-31Z-unit-8271.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 19.09.2026 22:53 | integration | ✅ 38 из 38 | 12 с | 0933804 +15 | [лог](logs/2026-09-19T17-53-14Z-integration-e84b.log) |  |
| 19.09.2026 22:54 | typecheck | ✅ без ошибок | 15 с | 0933804 +23 | [лог](logs/2026-09-19T17-54-15Z-typecheck-daf6.log) |  |
| 19.09.2026 22:54 | lint | ✅ без ошибок | 10 с | 0933804 +23 | [лог](logs/2026-09-19T17-54-31Z-lint-2fc4.log) |  |
| 19.09.2026 22:54 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 124 из 124 | 9 мин 9 с | 0933804 +22 | [лог](logs/2026-09-19T17-54-52Z-e2e-0371.log) |  |
| 19.09.2026 18:07 | unit (частично: scripts/design/build-tokens.test.ts) | ❌ упало 1 из 12 | 1 с | 3ad7b47 +1 | [лог](logs/2026-09-19T13-07-50Z-unit-a979.log) | Редизайн A2 RED: контраст границ полей |
| 19.09.2026 18:08 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-refresh) | ❌ упало 3 из 3 | 40 с | 3ad7b47 +2 | [лог](logs/2026-09-19T13-08-00Z-e2e-d24e.log) | Редизайн A RED: видимость действий и мобильные цели |
| 19.09.2026 18:14 | unit (частично: scripts/design/build-tokens.test.ts) | ✅ 12 из 12 | 1 с | 3ad7b47 +9 | [лог](logs/2026-09-19T13-14-11Z-unit-eb1e.log) | Редизайн A2 GREEN: контраст границ полей |
| 19.09.2026 18:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-refresh workspace premium) | ❌ упало 3 из 58 | 1 мин 36 с | 3ad7b47 +10 | [лог](logs/2026-09-19T13-14-19Z-e2e-d7c5.log) | Редизайн A GREEN: первый экран, периоды и регрессия рабочего места |
| 19.09.2026 18:16 | unit (частично: scripts/design/build-tokens.test.ts apps/web/src/design-rules.test.ts) | ✅ 25 из 25 | 1 с | 3ad7b47 +11 | [лог](logs/2026-09-19T13-16-25Z-unit-5909.log) | Редизайн A: токены и стилевые ограничения |
| 19.09.2026 18:17 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-refresh workspace premium design-system --grep-invert эталонные) | ❌ упало 2 из 68 | 2 мин 1 с | 3ad7b47 +13 | [лог](logs/2026-09-19T13-17-16Z-e2e-993a.log) | Редизайн A: UI-регрессия, обе темы, axe и снимки компонентов |
| 19.09.2026 18:19 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-refresh) | ✅ 7 из 7 | 20 с | 3ad7b47 +14 | [лог](logs/2026-09-19T13-19-31Z-e2e-52cb.log) | Редизайн A GREEN: мобильная галерея и непрозрачная нижняя навигация |
| 19.09.2026 18:20 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --update-snapshots=missing) | ❌ упало 6 из 127 | 5 мин 14 с | 3ad7b47 +14 | [лог](logs/2026-09-19T13-20-07Z-e2e-3bcc.log) | Редизайн A: полный изолированный UI-набор; первые macOS-эталоны, Linux не изменяется |
| 19.09.2026 18:25 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 --grep месячная сетка\|экраны для дизайн-системы\|axe и эталонные\|сайты: проверка\|редизайн:) | ❌ упало 1 из 11 | 1 мин 7 с | 3ad7b47 +16 | [лог](logs/2026-09-19T13-25-53Z-e2e-4b95.log) | Редизайн A: повтор всех шести падений полного прогона и снимки; без обновления эталонов |
| 19.09.2026 18:27 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 design-reference) | ✅ 2 из 2 | 20 с | 3ad7b47 +16 | [лог](logs/2026-09-19T13-27-21Z-e2e-f143.log) | Редизайн A: финальный повтор обеих тем снимков, селекторы в активном main |
| 19.09.2026 18:27 | unit (частично: scripts/design/build-tokens.test.ts apps/web/src/design-rules.test.ts) | ✅ 25 из 25 | 1 с | 3ad7b47 +12 | [лог](logs/2026-09-19T13-27-55Z-unit-e686.log) | Редизайн A: финальные токены и правила |
| 19.09.2026 18:27 | typecheck | ✅ без ошибок | 8 с | 3ad7b47 +16 | [лог](logs/2026-09-19T13-27-56Z-typecheck-504a.log) | Редизайн A: типы корня, API и web |
| 19.09.2026 18:28 | lint (частично: --ignore-pattern .agent-tmp/**) | ✅ без ошибок | 5 с | 3ad7b47 +16 | [лог](logs/2026-09-19T13-28-04Z-lint-3ef4.log) | Редизайн A: lint; исключён сохранённый посторонний архив .agent-tmp |
| 19.09.2026 22:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts --grep C1:) | ❌ упало 2 из 2 | 10 с | 48149c7 +1 | [лог](logs/2026-09-19T17-45-19Z-e2e-1afe.log) | C1 RED: grid start and mobile touch targets before implementation |
| 19.09.2026 22:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts chessboard-month.spec.ts) | ❌ упало 1 из 19 | 1 мин 15 с | 48149c7 +4 | [лог](logs/2026-09-19T17-46-55Z-e2e-dc60.log) | C1: chessboard layout, dates, filters and responsive regression |
| 19.09.2026 22:48 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts --grep C1:) | ✅ 2 из 2 | 11 с | 48149c7 +4 | [лог](logs/2026-09-19T17-48-59Z-e2e-b5e6.log) | C1: mobile filter disclosure and touch targets |
| 19.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 129 | 7 мин 14 с | 48149c7 +4 | [лог](logs/2026-09-19T17-49-24Z-e2e-8250.log) | C1 full isolated UI regression after chessboard controls refresh |
| 19.09.2026 22:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts --grep подсказка не выходит) | ❌ упало 1 из 1 | 11 с | 48149c7 +5 | [лог](logs/2026-09-19T17-57-06Z-e2e-f1bc.log) | C1 RED: help bounds and last mobile row reachability |
| 19.09.2026 22:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts --grep подсказка не выходит) | ❌ упало 1 из 1 | 24 с | 48149c7 +5 | [лог](logs/2026-09-19T17-57-31Z-e2e-7462.log) | C1: help bounds fixed; verify mobile last-row regression |
| 19.09.2026 22:58 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts chessboard-month.spec.ts chessboard-blocks.spec.ts workspace.spec.ts - | ✅ 22 из 22 | 1 мин 20 с | 48149c7 +5 | [лог](logs/2026-09-19T17-58-29Z-e2e-422f.log) | C1 final targeted: controls, sticky grid, mobile reachability and scoped selector |
| 19.09.2026 23:00 | unit (частично: apps/web/src/app/chessboard apps/web/src/design-rules.test.ts scripts/design/build-tokens.test.ts) | ✅ 49 из 49 | 1 с | 48149c7 +3 | [лог](logs/2026-09-19T18-00-04Z-unit-ea09.log) | C1: chessboard presentation helpers, design invariants and token checks |
| 19.09.2026 23:00 | typecheck | ✅ без ошибок | 6 с | 48149c7 +5 | [лог](logs/2026-09-19T18-00-15Z-typecheck-9a1f.log) | C1: root API and web typecheck |
| 19.09.2026 23:00 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts --grep C1:) | ✅ 3 из 3 | 11 с | 48149c7 +5 | [лог](logs/2026-09-19T18-00-52Z-e2e-af44.log) | C1 final layout: preview allowance, help at all breakpoints and mobile last row |
| 19.09.2026 23:02 | lint (частично: --ignore-pattern .agent-tmp/**) | ✅ без ошибок | 6 с | 48149c7 +5 | [лог](logs/2026-09-19T18-02-31Z-lint-1aea.log) | C1 final lint; historical local archive excluded |
| 19.09.2026 23:06 | unit (частично: apps/web/src/design-rules.test.ts apps/api/src/accounts) | ✅ 70 из 70 | 3 с | 830329c | [лог](logs/2026-09-19T18-06-15Z-unit-0593.log) |  |
| 19.09.2026 23:06 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/invites.spec.ts tests/ui/login-access.spec.ts tests/ui/design-refresh.spec.ts) | ✅ 16 из 16 | 46 с | 830329c | [лог](logs/2026-09-19T18-06-18Z-e2e-1b9a.log) |  |
| 19.09.2026 23:10 | unit (частично: packages/domain/src/accounts/session-device.test.ts apps/api/src/accounts/sessions.controller.test.ts) | ❌ упало 7 из 7 | 2 с | eb6752b +2 | [лог](logs/2026-09-19T18-10-13Z-unit-d4c5.log) | список сессий без сессии — 401 |
| 19.09.2026 23:10 | integration (частично: tests/integration/sessions.test.ts) | ❌ упало 2 из 2 | 2 с | eb6752b +3 | [лог](logs/2026-09-19T18-10-16Z-integration-9b30.log) | sessions repository (integration, DATABASE_URL required) в списке только живые сессии этого человека, новые сверху, с агентом |
| 19.09.2026 23:13 | unit (частично: packages/domain/src/accounts/session-device.test.ts apps/api/src/accounts/sessions.controller.test.ts) | ✅ 7 из 7 | 2 с | eb6752b +13 | [лог](logs/2026-09-19T18-13-58Z-unit-9722.log) |  |
| 19.09.2026 23:14 | integration (частично: tests/integration/sessions.test.ts) | ❌ упало 1 из 2 | 2 с | eb6752b +10 | [лог](logs/2026-09-19T18-14-00Z-integration-b19e.log) | sessions repository (integration, DATABASE_URL required) «выйти везде» отзывает все строки человека, чужие живы; повтор — ноль строк |
| 19.09.2026 23:14 | unit (частично: packages/domain/src/accounts/session-device.test.ts apps/api/src/accounts/sessions.controller.test.ts apps/api/src/accounts/invites.controller.t | ✅ 51 из 51 | 2 с | eb6752b +13 | [лог](logs/2026-09-19T18-14-48Z-unit-6a5c.log) |  |
| 19.09.2026 23:14 | integration (частично: tests/integration/sessions.test.ts) | ✅ 2 из 2 | 2 с | eb6752b +10 | [лог](logs/2026-09-19T18-14-51Z-integration-9b12.log) |  |
| 19.09.2026 23:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/sessions.spec.ts) | ❌ упало 2 из 3 | 1 мин 9 с | eb6752b +9 | [лог](logs/2026-09-19T18-15-12Z-e2e-b451.log) | вошедший видит, где он вошёл, — устройство словами и пометку своего сеанса |
| 19.09.2026 23:16 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/sessions.spec.ts) | ✅ 3 из 3 | 9 с | eb6752b +14 | [лог](logs/2026-09-19T18-16-22Z-e2e-a994.log) |  |
| 19.09.2026 23:17 | typecheck | ✅ без ошибок | 19 с | eb6752b +15 | [лог](logs/2026-09-19T18-17-08Z-typecheck-422f.log) |  |
| 19.09.2026 23:17 | lint | ✅ без ошибок | 9 с | eb6752b +15 | [лог](logs/2026-09-19T18-17-28Z-lint-7f03.log) |  |
| 19.09.2026 23:17 | unit | ❌ упало 3 из 1088 | 1 мин 32 с | eb6752b +13 | [лог](logs/2026-09-19T18-17-38Z-unit-da2a.log) | launchd install.sh проверка доступа дожидается node, когда bash первым пишет «Operation not permitted» |
| 19.09.2026 23:19 | integration | ✅ 40 из 40 | 12 с | eb6752b +10 | [лог](logs/2026-09-19T18-19-10Z-integration-09fd.log) |  |
| 19.09.2026 23:19 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 2 из 134 | 9 мин 39 с | eb6752b +14 | [лог](logs/2026-09-19T18-19-23Z-e2e-1825.log) | axe и эталонные снимки секций: light |
| 20.09.2026 11:52 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/design-system.spec.ts) | ✅ 8 из 8 | 32 с | eb6752b +14 | [лог](logs/2026-09-20T06-52-39Z-e2e-dfbe.log) |  |
| 19.09.2026 16:56 | typecheck | ❌ ошибок: 13 | 25 с | 5bd5056 +50 | [лог](logs/2026-09-19T11-56-42Z-typecheck-e8c8.log) | TS2300 |
| 19.09.2026 16:57 | typecheck | ✅ без ошибок | 20 с | 5bd5056 +50 | [лог](logs/2026-09-19T11-57-30Z-typecheck-d84f.log) |  |
| 19.09.2026 16:57 | lint | ❌ ошибок: 2 | 13 с | 5bd5056 +50 | [лог](logs/2026-09-19T11-57-50Z-lint-f09f.log) | @typescript-eslint/no-unused-vars |
| 19.09.2026 16:58 | lint | ✅ без ошибок | 12 с | 5bd5056 +50 | [лог](logs/2026-09-19T11-58-19Z-lint-1c21.log) |  |
| 19.09.2026 16:58 | unit | ❌ упало 2 из 1256, пропущено 3 | 1 мин 13 с | 5bd5056 +50 | [лог](logs/2026-09-19T11-58-46Z-unit-8647.log) | деньги и журнал — одной транзакцией платёж: обе записи внутри одного $transaction, id платежа попадает в строку журнала |
| 19.09.2026 17:00 | unit | ✅ 1253 из 1256, пропущено 3 | 1 мин 12 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-00-21Z-unit-9be2.log) |  |
| 19.09.2026 17:02 | e2e | ❌ упало 2 из 25 | 1 мин 18 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-02-42Z-e2e-50c6.log) | шахматка показывает 88 ячеек, и занятость на экране совпадает с данными |
| 19.09.2026 17:05 | unit (частично: tests/unit/test-data-source.test.ts) | ❌ упало 2 из 5 | 1 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-05-56Z-unit-47ab.log) | seedIsStale сид не с сегодняшнего дня (по Алматы) — устарел |
| 19.09.2026 17:06 | unit (частично: tests/unit/test-data-source.test.ts) | ✅ 5 из 5 | 1 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-06-16Z-unit-c15a.log) |  |
| 19.09.2026 17:06 | e2e | ✅ 25 из 25 | 49 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-06-28Z-e2e-78eb.log) |  |
| 19.09.2026 17:07 | integration | ❌ упало 1 из 37, пропущено 5 | 11 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-07-49Z-integration-8667.log) | журнал действий: список (integration, DATABASE_URL required) сводка берётся из снимка: номер брони из after, код ячейки из before |
| 19.09.2026 17:08 | integration | ✅ 32 из 37, пропущено 5 | 11 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-08-21Z-integration-a1a0.log) |  |
| 19.09.2026 17:13 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ код выхода 1 | 1 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-13-31Z-e2e-ae39.log) | (ошибка вне тестов) |
| 19.09.2026 17:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 10 из 156 | 12 мин 48 с | 5bd5056 +50 | [лог](logs/2026-09-19T12-14-22Z-e2e-0738.log) | в неделе работают бронь, категории и создание на воскресенье |
| 19.09.2026 22:48 | typecheck | ✅ без ошибок | 37 с | 736e992 +6 | [лог](logs/2026-09-19T17-48-40Z-typecheck-b02d.log) |  |
| 19.09.2026 22:49 | lint | ✅ без ошибок | 17 с | 736e992 +6 | [лог](logs/2026-09-19T17-49-18Z-lint-ee28.log) |  |
| 19.09.2026 22:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/workspace.spec.ts tests/ui/chessboard-week.spec.ts) | ✅ 56 из 56 | 4 мин 23 с | 736e992 +6 | [лог](logs/2026-09-19T17-49-36Z-e2e-cdab.log) |  |
| 19.09.2026 22:54 | e2e (частично: --config tests/ui/playwright.auth.config.ts --workers=1) | ✅ 4 из 4 | 15 с | 7c8b1cf | [лог](logs/2026-09-19T17-54-11Z-e2e-5dd4.log) |  |
| 19.09.2026 22:54 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 152 из 152 | 13 мин 36 с | 7c8b1cf | [лог](logs/2026-09-19T17-54-27Z-e2e-947c.log) |  |
| 19.09.2026 23:08 | unit | ✅ 1255 из 1258, пропущено 3 | 1 мин 14 с | 66dfb0d | [лог](logs/2026-09-19T18-08-21Z-unit-e185.log) |  |
| 19.09.2026 23:09 | integration | ✅ 32 из 37, пропущено 5 | 14 с | 66dfb0d | [лог](logs/2026-09-19T18-09-35Z-integration-61ac.log) |  |
| 19.09.2026 23:09 | e2e | ✅ 25 из 25 | 55 с | 66dfb0d | [лог](logs/2026-09-19T18-09-49Z-e2e-10b0.log) |  |
| 19.09.2026 23:34 | unit (частично: apps/api/src/auth/accounts-public-routes.test.ts) | ❌ упало 5 из 7 | 1 с | 8098096 +50 | [лог](logs/2026-09-19T18-34-43Z-unit-5f8a.log) | RED: merged code-login routes under password session guard |
| 19.09.2026 23:34 | unit (частично: apps/api/src/auth/accounts-public-routes.test.ts) | ✅ 7 из 7 | 1 с | 8098096 +50 | [лог](logs/2026-09-19T18-34-59Z-unit-01af.log) | GREEN: entry routes public; invitation management still guarded |
| 19.09.2026 23:35 | unit | ❌ упало 2 из 1313, пропущено 3 | 1 мин 15 с | 8098096 +50 | [лог](logs/2026-09-19T18-35-59Z-unit-ccb0.log) | Merged main plus Claude: isolated unit verification |
| 19.09.2026 23:38 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 8098096 +50 | [лог](logs/2026-09-19T18-38-25Z-unit-5de3.log) | Merge regression: design tokens and one money formatter module |
| 19.09.2026 23:38 | e2e (частично: --config tests/ui/playwright.auth.config.ts) | ❌ упало 2 из 4 | 16 с | 8098096 +50 | [лог](logs/2026-09-19T18-38-45Z-e2e-7b89.log) | Merged main Claude: synthetic protected routes and password session |
| 19.09.2026 23:39 | e2e (частично: --config tests/ui/playwright.auth.config.ts --workers=1) | ✅ 4 из 4 | 11 с | 8098096 +50 | [лог](logs/2026-09-19T18-39-23Z-e2e-d4d6.log) | Auth redirect checks target the active accessible main, not hidden Next trees |
| 19.09.2026 23:39 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access password-reset invites chessboard-week) | ❌ упало 2 из 33 | 2 мин 3 с | 8098096 +50 | [лог](logs/2026-09-19T18-39-42Z-e2e-62c4.log) | Merge baseline: password code invite reset and preserved chessboard UI |
| 19.09.2026 23:42 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 invites) | ✅ 4 из 4 | 15 с | 8098096 +50 | [лог](logs/2026-09-19T18-42-03Z-e2e-15b7.log) | Invites retained with password default and explicit code entry |
| 19.09.2026 23:42 | integration | ✅ 43 из 43 | 11 с | 8098096 +50 | [лог](logs/2026-09-19T18-42-38Z-integration-b657.log) | Merged schema on isolated Docker PostgreSQL16 localhost55439, synthetic data only |
| 19.09.2026 23:42 | unit | ✅ 1310 из 1313, пропущено 3 | 1 мин 12 с | 8098096 +50 | [лог](logs/2026-09-19T18-42-43Z-unit-c1d4.log) | Merged main Claude final unit baseline after red-green corrections |
| 19.09.2026 23:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access -g форма входа просит\|форма первой\|неверный пароль\|сбой API) | ❌ упало 4 из 4 | 58 с | ca1f67a +1 | [лог](logs/2026-09-19T18-45-12Z-e2e-ec79.log) | RED login refresh: clear heading, mobile form first, retain email after failure |
| 19.09.2026 23:47 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access) | ✅ 15 из 15 | 25 с | ca1f67a +3 | [лог](logs/2026-09-19T18-47-17Z-e2e-ace7.log) | GREEN login refresh: copy mobile accessibility keyboard error recovery and both sign-in methods |
| 19.09.2026 23:48 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access -g клавиатура) | ❌ упало 1 из 1 | 6 с | ca1f67a +3 | [лог](logs/2026-09-19T18-48-00Z-e2e-fc0a.log) | RED visual review: password toggle must stay inside input |
| 19.09.2026 23:48 | unit (частично: scripts/design/build-tokens.test.ts) | ✅ 12 из 12 | 1 с | ca1f67a +2 | [лог](logs/2026-09-19T18-48-07Z-unit-b18a.log) | Token audit for scoped login styles |
| 19.09.2026 23:49 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access invites password-reset) | ✅ 28 из 28 | 36 с | ca1f67a +3 | [лог](logs/2026-09-19T18-49-28Z-e2e-cf4b.log) | Final login UI: auth invitations reset accessibility and corrected password toggle |
| 19.09.2026 23:50 | unit (частично: apps/web/src/design-rules.test.ts scripts/design/build-tokens.test.ts apps/api/src/auth) | ✅ 90 из 90 | 2 с | ca1f67a +2 | [лог](logs/2026-09-19T18-50-31Z-unit-5621.log) | Final login and auth targeted unit regression |
| 19.09.2026 23:50 | e2e | ❌ упало 1 из 26 | 58 с | ca1f67a +3 | [лог](logs/2026-09-19T18-50-59Z-e2e-1dcc.log) | Real API authenticated E2E against isolated local PostgreSQL55439; outbound integrations disabled |
| 19.09.2026 23:52 | e2e | ✅ 26 из 26 | 58 с | ca1f67a +4 | [лог](logs/2026-09-19T18-52-34Z-e2e-c1e7.log) | Final isolated authenticated E2E: remove double minor-unit conversion in merged test, keep exact penalty equality |
| 19.09.2026 23:54 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 channex-screens manager-actions dashboard-resilience design-refresh) | ❌ упало 6 из 21 | 1 мин 16 с | ca1f67a +4 | [лог](logs/2026-09-19T18-54-01Z-e2e-d905.log) | Merged UI cross-check: channel queues, action previews, dashboard streaming and C1 attention |
| 19.09.2026 23:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 channex-screens manager-actions) | ❌ упало 3 из 12 | 1 мин 3 с | ca1f67a +6 | [лог](logs/2026-09-19T18-57-13Z-e2e-8b20.log) | Merge follow-up: visible Next Activity locators and preserved main confirmations; retain zero-price regression |
| 19.09.2026 23:58 | unit (частично: tests/unit/deploy-server.test.ts) | ❌ упало 1 из 26 | 1 с | ca1f67a +3 | [лог](logs/2026-09-19T18-58-35Z-unit-fe09.log) | RED: build context must actually load secret exclusions from root dockerignore |
| 19.09.2026 23:58 | unit (частично: tests/unit/deploy-server.test.ts) | ✅ 26 из 26 | 1 с | ca1f67a +4 | [лог](logs/2026-09-19T18-58-59Z-unit-572f.log) | GREEN: root dockerignore excludes secrets, local runtimes and server overlay |
| 19.09.2026 23:59 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 channex-screens manager-actions dashboard-resilience design-refresh) | ✅ 21 из 21 | 42 с | ca1f67a +7 | [лог](logs/2026-09-19T18-59-10Z-e2e-1502.log) | GREEN: merged channels and manager actions, restored zero-price validation, visible Next Activity selectors |
| 20.09.2026 00:00 | unit | ✅ 1311 из 1314, пропущено 3 | 1 мин 12 с | ca1f67a +4 | [лог](logs/2026-09-19T19-00-21Z-unit-6d66.log) | Final merged source: login refresh, API auth compatibility, price validation and effective Docker exclusions |
| 20.09.2026 00:28 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 accessibility chessboard-month chessboard-week design-system manager-actions) | ❌ упало 2 из 42, пропущено 26 | 6 мин 8 с | d064256 | [лог](logs/2026-09-19T19-28-43Z-e2e-17c6.log) | доступность всех разделов: light, 390px |
| 20.09.2026 00:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 workspace -g подсказка закрывается\|несопоставленные ревизии\|очередь показана строками\|входящая | ❌ упало 6 из 6 | 2 мин 21 с | d064256 | [лог](logs/2026-09-19T19-34-52Z-e2e-3f5c.log) | шахматка: подсказка закрывается щелчком вне и не держит кнопки под собой |
| 20.09.2026 00:37 | e2e (частично: --config tests/ui/playwright.config.ts design-system manager-actions --workers=1) | ❌ упало 2 из 14 | 1 мин 1 с | d064256 | [лог](logs/2026-09-19T19-37-46Z-e2e-04e8.log) | axe и эталонные снимки секций: light |
| 20.09.2026 00:40 | e2e (частично: --config tests/ui/playwright.config.ts design-system --update-snapshots --workers=1) | ✅ 8 из 8 | 54 с | d064256 +2 | [лог](logs/2026-09-19T19-40-13Z-e2e-1c99.log) |  |
| 20.09.2026 00:41 | e2e (частично: --config tests/ui/playwright.config.ts accessibility --workers=1) | ✅ 8 из 8 | 4 мин 34 с | d064256 +2 | [лог](logs/2026-09-19T19-41-08Z-e2e-0503.log) |  |
| 20.09.2026 00:46 | e2e (частично: --config tests/ui/playwright.config.ts chessboard-week chessboard-month --workers=1) | ✅ 20 из 20 | 3 мин 21 с | dac16fe | [лог](logs/2026-09-19T19-46-12Z-e2e-6b75.log) |  |
| 20.09.2026 00:49 | e2e (частично: --config tests/ui/playwright.config.ts workspace manager-actions design-system --workers=1) | ❌ упало 3 из 67 | 3 мин 40 с | dac16fe | [лог](logs/2026-09-19T19-49-50Z-e2e-8a25.log) | axe и эталонные снимки секций: light |
| 20.09.2026 00:56 | typecheck | ✅ без ошибок | 29 с | dac16fe +1 | [лог](logs/2026-09-19T19-56-25Z-typecheck-5325.log) |  |
| 20.09.2026 00:56 | e2e (частично: --config tests/ui/playwright.config.ts workspace design-system -g подсказка закрывается\|эталонные снимки --workers=1) | ❌ упало 2 из 3 | 27 с | dac16fe +1 | [лог](logs/2026-09-19T19-56-51Z-e2e-a7e7.log) | axe и эталонные снимки секций: light |
| 20.09.2026 00:58 | e2e (частично: --config tests/ui/playwright.config.ts design-system -g эталонные снимки --workers=1) | ❌ упало 2 из 2 | 22 с | dac16fe | [лог](logs/2026-09-19T19-58-29Z-e2e-48cf.log) | axe и эталонные снимки секций: light |
| 20.09.2026 00:58 | e2e (частично: --config tests/ui/playwright.config.ts design-system -g эталонные снимки --workers=1) | ❌ упало 2 из 2 | 25 с | dac16fe +1 | [лог](logs/2026-09-19T19-58-52Z-e2e-abaf.log) | axe и эталонные снимки секций: light |
| 20.09.2026 00:59 | e2e (частично: --config tests/ui/playwright.config.ts design-system -g эталонные снимки --workers=1) | ❌ упало 2 из 2 | 24 с | dac16fe +2 | [лог](logs/2026-09-19T19-59-44Z-e2e-8afa.log) | axe и эталонные снимки секций: light |
| 20.09.2026 01:11 | e2e (частично: --config tests/ui/playwright.config.ts premium -g выборка названа --workers=1) | ❌ код выхода 1 | 1 с | e6321f9 +1 | [лог](logs/2026-09-19T20-11-21Z-e2e-b9ae.log) | (ошибка вне тестов) |
| 20.09.2026 01:11 | e2e (частично: --config tests/ui/playwright.config.ts premium -g выборка названа --workers=1) | ❌ упало 1 из 1 | 22 с | e6321f9 +1 | [лог](logs/2026-09-19T20-11-59Z-e2e-ebd2.log) | список броней: выборка названа, пустой результат предлагает поправку, телефон без прокрутки вбок |
| 20.09.2026 01:13 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | e6321f9 +2 | [лог](logs/2026-09-19T20-13-20Z-unit-91c7.log) |  |
| 20.09.2026 01:13 | e2e (частично: --config tests/ui/playwright.config.ts premium quality --workers=1) | ❌ упало 1 из 21 | 1 мин 58 с | e6321f9 +3 | [лог](logs/2026-09-19T20-13-18Z-e2e-6a2e.log) | список броней: выборка названа, пустой результат предлагает поправку, телефон без прокрутки вбок |
| 20.09.2026 01:15 | e2e (частично: --config tests/ui/playwright.config.ts premium -g выборка названа --workers=1) | ❌ упало 1 из 1 | 10 с | e6321f9 +3 | [лог](logs/2026-09-19T20-15-39Z-e2e-3f66.log) | список броней: выборка названа, пустой результат предлагает поправку, телефон без прокрутки вбок |
| 20.09.2026 01:17 | e2e (частично: --config tests/ui/playwright.config.ts premium -g выборка названа --workers=1) | ✅ 1 из 1 | 9 с | e6321f9 +3 | [лог](logs/2026-09-19T20-17-27Z-e2e-6a02.log) |  |
| 20.09.2026 01:17 | e2e (частично: --config tests/ui/playwright.config.ts premium quality requests --workers=1) | ✅ 26 из 26 | 2 мин 3 с | e6321f9 +3 | [лог](logs/2026-09-19T20-17-59Z-e2e-aa94.log) |  |
| 20.09.2026 01:20 | e2e (частично: --config tests/ui/playwright.config.ts accessibility --workers=1) | ✅ 8 из 8 | 4 мин 50 с | e6321f9 +3 | [лог](logs/2026-09-19T20-20-19Z-e2e-7a2d.log) |  |
| 20.09.2026 01:25 | e2e (частично: --config tests/ui/playwright.config.ts design-reference workspace --workers=1) | ✅ 55 из 55 | 3 мин 10 с | ad9241d | [лог](logs/2026-09-19T20-25-24Z-e2e-740f.log) |  |
| 20.09.2026 01:33 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ❌ упало 1 из 1 | 23 с | 7479ab9 +2 | [лог](logs/2026-09-19T20-33-41Z-e2e-19d6.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:35 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 2 с | 7479ab9 +3 | [лог](logs/2026-09-19T20-35-42Z-unit-70fd.log) |  |
| 20.09.2026 01:35 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ❌ упало 1 из 1 | 25 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-35-35Z-e2e-a7ef.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:36 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ❌ упало 1 из 1 | 24 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-36-39Z-e2e-29b0.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:37 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ❌ упало 1 из 1 | 9 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-37-35Z-e2e-18cd.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:39 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ❌ упало 1 из 1 | 22 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-39-56Z-e2e-c40c.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:40 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ❌ упало 1 из 1 | 9 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-40-37Z-e2e-1650.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:41 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g резюме выбора обновляется --workers=1) | ✅ 1 из 1 | 9 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-41-55Z-e2e-b69c.log) |  |
| 20.09.2026 01:42 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 7479ab9 +3 | [лог](logs/2026-09-19T20-42-27Z-unit-0c1a.log) |  |
| 20.09.2026 01:42 | e2e (частично: --config tests/ui/playwright.config.ts workspace requests quality --workers=1) | ❌ упало 1 из 74 | 3 мин 17 с | 7479ab9 +5 | [лог](logs/2026-09-19T20-42-21Z-e2e-e0e8.log) | новая бронь: резюме выбора обновляется по ходу, кнопка создания видна при прокрутке и на телефоне |
| 20.09.2026 01:48 | e2e (частично: --config tests/ui/playwright.config.ts design-system --update-snapshots --workers=1) | ✅ 8 из 8 | 51 с | 6cdcc43 +2 | [лог](logs/2026-09-19T20-48-17Z-e2e-e93a.log) |  |
| 20.09.2026 01:50 | e2e (частично: --config tests/ui/playwright.config.ts workspace quality design-system manager-actions --workers=1) | ✅ 82 из 82 | 3 мин 51 с | 6cdcc43 +4 | [лог](logs/2026-09-19T20-50-38Z-e2e-b53f.log) |  |
| 20.09.2026 01:54 | e2e (частично: --config tests/ui/playwright.config.ts accessibility --workers=1) | ✅ 8 из 8 | 4 мин 43 с | 6cdcc43 +4 | [лог](logs/2026-09-19T20-54-30Z-e2e-b05c.log) |  |
| 20.09.2026 01:59 | e2e (частично: --config tests/ui/playwright.config.ts design-reference chessboard-week chessboard-month --workers=1) | ✅ 22 из 22 | 4 мин 7 с | 6cdcc43 +4 | [лог](logs/2026-09-19T20-59-13Z-e2e-5413.log) |  |
| 20.09.2026 11:43 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 3 с | 9943b60 +4 | [лог](logs/2026-09-20T06-43-34Z-unit-fcf3.log) |  |
| 20.09.2026 11:43 | e2e (частично: --config tests/ui/playwright.config.ts premium quality workspace manager-actions requests accessibility design-reference --workers=1) | ❌ упало 1 из 97 | 7 мин 45 с | 9943b60 +5 | [лог](logs/2026-09-20T06-43-49Z-e2e-aa55.log) | подключения показывают частичный сбой, неподключённые функции не имитируют сохранение |
| 20.09.2026 11:52 | e2e (частично: --config tests/ui/playwright.config.ts workspace --workers=1) | ✅ 54 из 54 | 1 мин 49 с | 9943b60 +6 | [лог](logs/2026-09-20T06-52-20Z-e2e-f60c.log) |  |
| 20.09.2026 12:02 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 99f0e08 +4 | [лог](logs/2026-09-20T07-02-52Z-unit-8b5e.log) |  |
| 20.09.2026 12:03 | e2e (частично: --config tests/ui/playwright.config.ts manager-actions premium quality reservation-tariff payment-draft --workers=1) | ❌ упало 1 из 34 | 1 мин 59 с | 99f0e08 +5 | [лог](logs/2026-09-20T07-03-28Z-e2e-d548.log) | карточка B3: полоса фактов над вкладками, следующее действие, отмена названа, Escape возвращает фокус |
| 20.09.2026 12:05 | e2e (частично: --config tests/ui/playwright.config.ts manager-actions workspace accessibility design-reference --workers=1) | ❌ упало 1 из 72 | 5 мин 50 с | 99f0e08 +5 | [лог](logs/2026-09-20T07-05-47Z-e2e-3b54.log) | карточка B3: полоса фактов над вкладками, следующее действие, отмена названа, Escape возвращает фокус |
| 20.09.2026 12:13 | e2e (частично: --config tests/ui/playwright.config.ts manager-actions premium --workers=1) | ✅ 15 из 15 | 1 мин 15 с | 99f0e08 +6 | [лог](logs/2026-09-20T07-13-48Z-e2e-ea79.log) |  |
| 20.09.2026 12:15 | e2e (частично: --config tests/ui/playwright.config.ts workspace chessboard-week chessboard-month accessibility quality design-reference reservation-tariff payme | ✅ 103 из 103 | 7 мин 49 с | 99f0e08 +6 | [лог](logs/2026-09-20T07-15-38Z-e2e-2049.log) |  |
| 20.09.2026 12:27 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | bc2b4aa +7 | [лог](logs/2026-09-20T07-27-22Z-unit-7760.log) |  |
| 20.09.2026 12:27 | e2e (частично: --config tests/ui/playwright.config.ts design-system --workers=1) | ❌ упало 2 из 9 | 31 с | bc2b4aa +8 | [лог](logs/2026-09-20T07-27-47Z-e2e-0056.log) | axe и эталонные снимки секций: light |
| 20.09.2026 12:28 | e2e (частично: --config tests/ui/playwright.config.ts design-system premium quality --workers=1) | ❌ упало 2 из 30 | 1 мин 43 с | bc2b4aa +8 | [лог](logs/2026-09-20T07-28-18Z-e2e-98ca.log) | axe и эталонные снимки секций: light |
| 20.09.2026 12:31 | e2e (частично: --config tests/ui/playwright.config.ts design-system --update-snapshots --workers=1) | ✅ 9 из 9 | 41 с | bc2b4aa +8 | [лог](logs/2026-09-20T07-31-28Z-e2e-1e0e.log) |  |
| 20.09.2026 12:34 | e2e (частично: --config tests/ui/playwright.config.ts design-system --update-snapshots --workers=1) | ✅ 9 из 9 | 32 с | bc2b4aa +10 | [лог](logs/2026-09-20T07-34-14Z-e2e-bbc2.log) |  |
| 20.09.2026 12:35 | e2e (частично: --config tests/ui/playwright.config.ts design-system premium quality accessibility workspace --workers=1) | ✅ 92 из 92 | 6 мин 32 с | bc2b4aa +10 | [лог](logs/2026-09-20T07-35-20Z-e2e-f46a.log) |  |
| 20.09.2026 12:42 | e2e (частично: tests/e2e/web-analytics.spec.ts --workers=1) | ✅ 4 из 4 | 14 с | bc2b4aa +11 | [лог](logs/2026-09-20T07-42-17Z-e2e-41c7.log) |  |
| 20.09.2026 12:48 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 4f6d0f8 +5 | [лог](logs/2026-09-20T07-48-08Z-unit-82fe.log) |  |
| 20.09.2026 12:48 | e2e (частично: --config tests/ui/playwright.config.ts reservations-states premium requests --workers=1) | ✅ 16 из 16 | 1 мин 13 с | 4f6d0f8 +6 | [лог](logs/2026-09-20T07-48-09Z-e2e-e31f.log) |  |
| 20.09.2026 12:49 | e2e (частично: --config tests/ui/playwright.config.ts reservations-states --workers=1) | ❌ упало 3 из 3 | 54 с | 4f6d0f8 +2 | [лог](logs/2026-09-20T07-49-50Z-e2e-e503.log) | отказ API: заголовок и фильтры на месте, повтор возвращает список с теми же условиями |
| 20.09.2026 12:50 | e2e (частично: --config tests/ui/playwright.config.ts reservations-states premium requests accessibility --workers=1) | ✅ 24 из 24 | 4 мин 12 с | 4f6d0f8 +6 | [лог](logs/2026-09-20T07-50-59Z-e2e-b5ac.log) |  |
| 20.09.2026 12:56 | e2e | ✅ 25 из 25 | 1 мин 3 с | c2bdc3c | [лог](logs/2026-09-20T07-56-00Z-e2e-e342.log) |  |
| 20.09.2026 13:00 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | c2bdc3c +3 | [лог](logs/2026-09-20T08-00-32Z-unit-0765.log) |  |
| 20.09.2026 12:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 185 из 185 | 11 мин 29 с | c2bdc3c | [лог](logs/2026-09-20T07-57-03Z-e2e-cd43.log) |  |
| 20.09.2026 13:08 | e2e (частично: --config tests/ui/playwright.config.ts manager-actions chessboard-week chessboard-month chessboard-blocks premium design-reference --workers=1) | ❌ упало 1 из 39 | 4 мин 14 с | c2bdc3c +4 | [лог](logs/2026-09-20T08-08-48Z-e2e-96fb.log) | шахматка C2: меню на плашке — продлить с суммой, отменить со штрафом, с клавиатуры и без drag |
| 20.09.2026 13:15 | e2e (частично: --config tests/ui/playwright.config.ts manager-actions --workers=1) | ✅ 9 из 9 | 27 с | c2bdc3c +4 | [лог](logs/2026-09-20T08-15-27Z-e2e-0a05.log) |  |
| 20.09.2026 13:17 | e2e (частично: --config tests/ui/playwright.config.ts real-data --workers=1) | ✅ 5 из 5 | 9 с | 976efc7 +1 | [лог](logs/2026-09-20T08-17-39Z-e2e-fcbe.log) |  |
| 20.09.2026 13:18 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 186 из 186 | 11 мин 32 с | f72e5c1 | [лог](logs/2026-09-20T08-18-25Z-e2e-db43.log) |  |
| 20.09.2026 13:31 | e2e (частично: tests/e2e/desk-edit.spec.ts tests/e2e/manual-reservation.spec.ts tests/e2e/chessboard.spec.ts tests/e2e/check-in-out.spec.ts tests/e2e/print-and- | ✅ 7 из 7 | 24 с | f72e5c1 +2 | [лог](logs/2026-09-20T08-31-08Z-e2e-73ea.log) |  |
| 20.09.2026 13:39 | unit (частично: apps/web/src/app/guests/[id]/stay-now.test.ts apps/web/src/design-rules.test.ts) | ✅ 16 из 16 | 1 с | 178885f +8 | [лог](logs/2026-09-20T08-39-52Z-unit-dd17.log) |  |
| 20.09.2026 13:40 | e2e (частично: --config tests/ui/playwright.config.ts workspace quality accessibility requests premium --workers=1) | ✅ 90 из 90 | 6 мин 12 с | 178885f +9 | [лог](logs/2026-09-20T08-40-24Z-e2e-c485.log) |  |
| 20.09.2026 13:46 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g гости D1 --workers=1) | ❌ упало 1 из 1 | 21 с | 178885f +3 | [лог](logs/2026-09-20T08-46-53Z-e2e-0f8e.log) | гости D1: выборка и пустота словами, статус пребывания, длинное имя и история на телефоне |
| 20.09.2026 13:48 | e2e (частично: --config tests/ui/playwright.config.ts design-reference --workers=1) | ✅ 2 из 2 | 35 с | 3753889 | [лог](logs/2026-09-20T08-48-13Z-e2e-4f90.log) |  |
| 20.09.2026 13:50 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 65aea25 +5 | [лог](logs/2026-09-20T08-50-56Z-unit-8777.log) |  |
| 20.09.2026 13:51 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g деньги D2 --workers=1) | ❌ упало 1 из 1 | 21 с | 65aea25 +6 | [лог](logs/2026-09-20T08-51-13Z-e2e-aef2.log) | деньги D2: период словами, три блока с пояснениями, отказ не выглядит нулями |
| 20.09.2026 13:51 | e2e (частично: --config tests/ui/playwright.config.ts workspace quality accessibility requests premium --workers=1) | ❌ упало 3 из 92 | 6 мин 8 с | 65aea25 +7 | [лог](logs/2026-09-20T08-51-35Z-e2e-0337.log) | новые страницы и обе темы: адаптивность и отсутствие ошибок браузера |
| 20.09.2026 13:58 | e2e (частично: --config tests/ui/playwright.config.ts workspace quality accessibility requests premium reservations-states --workers=1) | ✅ 95 из 95 | 6 мин 16 с | 65aea25 +9 | [лог](logs/2026-09-20T08-58-58Z-e2e-3824.log) |  |
| 20.09.2026 14:08 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 0814440 +3 | [лог](logs/2026-09-20T09-08-04Z-unit-d10f.log) |  |
| 20.09.2026 14:08 | e2e (частично: --config tests/ui/playwright.config.ts payment-draft -g D3 --workers=1) | ❌ упало 1 из 1 | 22 с | 0814440 +2 | [лог](logs/2026-09-20T09-08-51Z-e2e-90a9.log) | оплата D3: строка сути называет сумму, способ, счёт и бронь; не число не уходит |
| 20.09.2026 14:09 | e2e (частично: --config tests/ui/playwright.config.ts payment-draft quality workspace manager-actions premium accessibility --workers=1) | ❌ упало 1 из 97 | 6 мин 44 с | 0814440 +4 | [лог](logs/2026-09-20T09-09-13Z-e2e-0c97.log) | оплата D3: строка сути называет сумму, способ, счёт и бронь; не число не уходит |
| 20.09.2026 14:16 | e2e (частично: --config tests/ui/playwright.config.ts payment-draft --workers=1) | ✅ 3 из 3 | 10 с | 0814440 +4 | [лог](logs/2026-09-20T09-16-27Z-e2e-3f96.log) |  |
| 20.09.2026 14:19 | unit (частично: apps/web/src/design-rules.test.ts) | ✅ 13 из 13 | 1 с | 171022e +4 | [лог](logs/2026-09-20T09-19-13Z-unit-576c.log) |  |
| 20.09.2026 14:19 | e2e (частично: --config tests/ui/playwright.config.ts workspace -g номера D4 --workers=1) | ❌ упало 1 из 1 | 21 с | 171022e +1 | [лог](logs/2026-09-20T09-19-29Z-e2e-af61.log) | номера D4: пустота фильтров словами со сбросом, телефон без прокрутки вбок, скелетон |
| 20.09.2026 14:19 | e2e (частично: --config tests/ui/playwright.config.ts workspace premium quality accessibility requests --workers=1) | ✅ 93 из 93 | 6 мин 21 с | 171022e +5 | [лог](logs/2026-09-20T09-19-50Z-e2e-7c1f.log) |  |
| 20.09.2026 14:26 | e2e (частично: --config tests/ui/playwright.config.ts design-reference --workers=1) | ✅ 2 из 2 | 34 с | 171022e +5 | [лог](logs/2026-09-20T09-26-45Z-e2e-9753.log) |  |
| 20.09.2026 14:28 | e2e (частично: tests/e2e/stay-extras.spec.ts tests/e2e/finance.spec.ts tests/e2e/full-day.spec.ts tests/e2e/desk-edit.spec.ts tests/e2e/cancellation-penalty.spe | ✅ 6 из 6 | 24 с | 1bb311b +1 | [лог](logs/2026-09-20T09-28-32Z-e2e-9ea8.log) |  |
| 20.09.2026 14:36 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts -g сбой календаря --workers=1) | ❌ упало 1 из 1 | 21 с | 7180b4c +2 | [лог](logs/2026-09-20T09-36-28Z-e2e-2425.log) | цены: сбой календаря оставляет форму и массовое изменение, пустой справочник назван, загрузка словом |
| 20.09.2026 14:36 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts tests/ui/quality.spec.ts tests/ui/requests.spec.ts --workers=1) | ✅ 28 из 28 | 51 с | 7180b4c +4 | [лог](logs/2026-09-20T09-36-59Z-e2e-9ca2.log) |  |
| 20.09.2026 14:38 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/requests.spec.ts tests/ui/accessibility.spec.ts tests/ui/workspace.spec.ts -g rates\|тарифы\|цены\|д | ✅ 15 из 15 | 3 мин 11 с | 7180b4c +5 | [лог](logs/2026-09-20T09-38-13Z-e2e-41de.log) |  |
| 20.09.2026 14:41 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-reference.spec.ts --workers=1) | ✅ 2 из 2 | 35 с | 7180b4c +5 | [лог](logs/2026-09-20T09-41-36Z-e2e-4314.log) |  |
| 20.09.2026 14:48 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts -g сбой сводки очереди --workers=1) | ❌ упало 1 из 1 | 21 с | 8a30e1f +2 | [лог](logs/2026-09-20T09-48-12Z-e2e-2279.log) | каналы: сбой сводки очереди и сопоставлений не уносит экран, пустые таблицы названы, загрузка словом |
| 20.09.2026 14:48 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts tests/ui/real-data.sp | ⏹ прерван | 45 с | 8a30e1f +7 | [лог](logs/2026-09-20T09-48-45Z-e2e-c46c.log) |  |
| 20.09.2026 14:50 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/real-data.spec.ts -g канал\|Channex\|по | ❌ упало 2 из 18 | 1 мин 10 с | 8a30e1f +7 | [лог](logs/2026-09-20T09-50-21Z-e2e-ab18.log) | каналы: сбой сводки очереди и сопоставлений не уносит экран, пустые таблицы названы, загрузка словом |
| 20.09.2026 14:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts -g сбой сводки\|перепо | ✅ 4 из 4 | 35 с | 8a30e1f +8 | [лог](logs/2026-09-20T09-52-09Z-e2e-c454.log) |  |
| 20.09.2026 14:52 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts tests/ui/accessibility.spec.ts tests/ui/design-reference.spec.ts --workers=1) | ✅ 17 из 17 | 4 мин 22 с | 8a30e1f +8 | [лог](logs/2026-09-20T09-52-55Z-e2e-2b94.log) |  |
| 20.09.2026 15:00 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts -g менеджер каналов и подключения --workers=1) | ❌ упало 1 из 1 | 21 с | 0dde1a4 +2 | [лог](logs/2026-09-20T10-00-49Z-e2e-737d.log) | менеджер каналов и подключения: период словами, сбой без потери формы, пустой отчёт с причиной, телефон |
| 20.09.2026 15:01 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/channex-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/real-data.spec.ts tests/ui/premium.sp | ✅ 19 из 19 | 3 мин 39 с | 0dde1a4 +7 | [лог](logs/2026-09-20T10-01-21Z-e2e-ccba.log) |  |
| 20.09.2026 16:35 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts --workers=1) | ❌ упало 2 из 2 | 1 мин 54 с | 19fb9b4 +3 | [лог](logs/2026-09-20T11-35-32Z-e2e-291c.log) | журнал: выборка словами, разделы чипами, сбой без потери формы, пустой результат с причиной |
| 20.09.2026 16:37 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/password-reset.spec.ts tests/ui/qualit | ✅ 11 из 11 | 47 с | 19fb9b4 +8 | [лог](logs/2026-09-20T11-37-38Z-e2e-5bdf.log) |  |
| 20.09.2026 16:38 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts tests/ui/accessibility.spec.ts tests/ui/design-reference.spec.ts --workers=1) | ✅ 17 из 17 | 4 мин 29 с | 19fb9b4 +8 | [лог](logs/2026-09-20T11-38-34Z-e2e-2784.log) |  |
| 20.09.2026 16:46 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts -g аналитика и статистика --workers=1) | ❌ упало 1 из 1 | 21 с | 29d66a7 +4 | [лог](logs/2026-09-20T11-46-57Z-e2e-6e45.log) | аналитика и статистика: пустое состояние, сбой с повтором, период словами, загрузка словом |
| 20.09.2026 16:47 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spec.ts tests/ui/premium.spec. | ✅ 8 из 8 | 46 с | 29d66a7 +7 | [лог](logs/2026-09-20T11-47-31Z-e2e-2fa3.log) |  |
| 20.09.2026 16:48 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/premium.spec.ts tests/ui/accessibility.spec.ts tests/ui/requests.spec.ts tests/ui/password-reset. | ✅ 32 из 32 | 4 мин 31 с | 29d66a7 +7 | [лог](logs/2026-09-20T11-48-26Z-e2e-dcb6.log) |  |
| 20.09.2026 16:55 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts -g настройки гостиницы --workers=1) | ❌ упало 1 из 1 | 21 с | ae71503 +3 | [лог](logs/2026-09-20T11-55-37Z-e2e-35d2.log) | настройки гостиницы: сбой с повтором, источник словами, пустые справочники с причиной, загрузка словом |
| 20.09.2026 16:56 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts tests/ui/workspace.spec.ts tests/ui/premium.spec.ts tests/ui/accessibility | ✅ 19 из 19 | 3 мин 35 с | ae71503 +5 | [лог](logs/2026-09-20T11-56-10Z-e2e-6ef2.log) |  |
| 20.09.2026 17:02 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts -g вход и профиль --workers=1) | ❌ упало 1 из 1 | 22 с | 13365db +1 | [лог](logs/2026-09-20T12-02-17Z-e2e-032e.log) | вход и профиль: «Вы вошли» без точек, приглашение при сбое с повтором, «Доступ» словами |
| 20.09.2026 17:02 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts tests/ui/login-access.spec.ts tests/ui/invites.spec.ts tests/ui/password-r | ✅ 36 из 36 | 3 мин 53 с | 13365db +5 | [лог](logs/2026-09-20T12-02-56Z-e2e-e4bc.log) |  |
| 20.09.2026 17:09 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 6 из 6 | 10 с | 32d715d | [лог](logs/2026-09-20T12-09-37Z-e2e-3d62.log) |  |
| 20.09.2026 17:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 200 из 200 | 13 мин 12 с | 874a079 | [лог](logs/2026-09-20T12-11-57Z-e2e-245d.log) |  |
| 20.09.2026 17:26 | e2e | ✅ 25 из 25 | 1 мин 5 с | c438f89 | [лог](logs/2026-09-20T12-26-46Z-e2e-6422.log) |  |
| 20.09.2026 17:34 | e2e (частично: --config tests/site/playwright.config.ts -g шаги под регистрацию) | ❌ упало 1 из 1 | 10 с | 8e2ddad | [лог](logs/2026-09-20T12-34-16Z-e2e-20e5.log) | главная: шаги под регистрацию, блог скрыт без статей, подсказка макета внутри карточки, без « · » |
| 20.09.2026 17:35 | e2e (частично: --config tests/site/playwright.config.ts) | ❌ упало 1 из 7 | 11 с | 8e2ddad +5 | [лог](logs/2026-09-20T12-35-23Z-e2e-85c5.log) | главная: шаги под регистрацию, блог скрыт без статей, подсказка макета внутри карточки, без « · » |
| 20.09.2026 17:36 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 7 из 7 | 11 с | 8e2ddad +5 | [лог](logs/2026-09-20T12-36-08Z-e2e-6cf0.log) |  |
| 20.09.2026 16:49 | unit (частично: tests/unit/local-db-start.test.ts) | ❌ код выхода 1 | 2 с | 06729e9 +1 | [лог](logs/2026-09-20T11-49-17Z-unit-0206.log) | RED: local-db repeats seed after test schema is populated |
| 20.09.2026 16:49 | unit (частично: tests/unit/local-db-start.test.ts) | ❌ упало 1 из 1 | 4 с | 06729e9 +1 | [лог](logs/2026-09-20T11-49-34Z-unit-4a9c.log) | RED: second seed overlaps an already populated test schema |
| 20.09.2026 16:50 | unit (частично: tests/unit/local-db-start.test.ts) | ✅ 1 из 1 | 3 с | 06729e9 +2 | [лог](logs/2026-09-20T11-50-01Z-unit-fcff.log) | GREEN: test:schema is the sole seed owner for pms_test |
| 20.09.2026 16:50 | lint | ✅ без ошибок | 11 с | 06729e9 +2 | [лог](logs/2026-09-20T11-50-47Z-lint-ff55.log) |  |
| 20.09.2026 16:52 | typecheck | ✅ без ошибок | 39 с | 06729e9 +2 | [лог](logs/2026-09-20T11-52-02Z-typecheck-939d.log) |  |
| 20.09.2026 16:52 | e2e | ❌ упало 16 из 26, пропущено 3 | 1 мин 23 с | 06729e9 +1 | [лог](logs/2026-09-20T11-52-02Z-e2e-5b4b.log) | Acceptance of synchronized main: real API, local PostgreSQL, auth required |
| 20.09.2026 16:54 | unit (частично: tests/unit/e2e-auth-config.test.ts) | ❌ упало 1 из 3 | 2 с | 06729e9 +3 | [лог](logs/2026-09-20T11-54-04Z-unit-f9d4.log) | RED: isolated auth API fails on session cookies when private SESSION_SECRET is empty |
| 20.09.2026 16:54 | unit (частично: tests/unit/e2e-auth-config.test.ts tests/unit/local-db-start.test.ts) | ✅ 4 из 4 | 3 с | 06729e9 +3 | [лог](logs/2026-09-20T11-54-27Z-unit-2ae8.log) | GREEN: local auth stand is independent of private session configuration |
| 20.09.2026 16:54 | e2e | ❌ упало 1 из 26, пропущено 2 | 2 мин 11 с | 06729e9 +2 | [лог](logs/2026-09-20T11-54-32Z-e2e-71c2.log) | Recheck after isolating the auth session key |
| 20.09.2026 16:56 | unit | ❌ упало 10 из 1316, пропущено 3 | 1 мин 23 с | 06729e9 +3 | [лог](logs/2026-09-20T11-56-21Z-unit-16e7.log) | Regression check after repairing local database and isolated auth setup |
| 20.09.2026 16:57 | e2e (частично: tests/e2e/web-analytics.spec.ts --workers=1) | ✅ 5 из 5 | 19 с | 06729e9 +2 | [лог](logs/2026-09-20T11-57-41Z-e2e-bf94.log) | Isolate the analytics persistence timing failure |
| 20.09.2026 16:59 | unit | ❌ упало 2 из 1316, пропущено 3 | 1 мин 45 с | 06729e9 +3 | [лог](logs/2026-09-20T11-59-15Z-unit-caa4.log) | Bound local CPU concurrency after timeout failures in the unconstrained run |
| 20.09.2026 17:04 | unit | ✅ 1313 из 1316, пропущено 3 | 2 мин 7 с | 06729e9 +4 | [лог](logs/2026-09-20T12-04-55Z-unit-c632.log) |  |
| 20.09.2026 17:08 | e2e | ❌ упало 1 из 26 | 1 мин 50 с | 06729e9 +4 | [лог](logs/2026-09-20T12-08-15Z-e2e-a37b.log) | Current release acceptance; isolated local database; auth enabled; analytics batch wait fixed |
| 20.09.2026 17:10 | e2e (частично: tests/e2e/check-in-out.spec.ts --workers=1) | ✅ 3 из 3 | 23 с | 06729e9 +4 | [лог](logs/2026-09-20T12-10-27Z-e2e-949c.log) | Check ECONNRESET from loopback GET; assertions and retries unchanged |
| 20.09.2026 17:11 | lint | ✅ без ошибок | 23 с | 06729e9 +6 | [лог](logs/2026-09-20T12-11-06Z-lint-f391.log) |  |
| 20.09.2026 17:11 | e2e | ✅ 26 из 26 | 1 мин 47 с | 06729e9 +4 | [лог](logs/2026-09-20T12-11-05Z-e2e-f2e4.log) | Final full acceptance on project Node 24 (.nvmrc), auth enabled, local database |
| 20.09.2026 17:12 | typecheck | ✅ без ошибок | 42 с | 06729e9 +6 | [лог](logs/2026-09-20T12-12-15Z-typecheck-7499.log) |  |
| 20.09.2026 17:13 | integration | ✅ 43 из 43 | 12 с | 06729e9 +2 | [лог](logs/2026-09-20T12-13-00Z-integration-2a13.log) | Current release acceptance on isolated PostgreSQL; no live data |
| 20.09.2026 17:13 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access invites password-reset) | ✅ 28 из 28 | 2 мин 22 с | 06729e9 +4 | [лог](logs/2026-09-20T12-13-34Z-e2e-edea.log) | Login registration invitations and password reset UI acceptance; synthetic API |
| 20.09.2026 17:19 | unit (частично: tests/unit/nest-http-adapter.test.ts tests/unit/ari-server.test.ts tests/unit/ari-switch-server.test.ts tests/unit/local-db-start.test.ts tests/ | ❌ упало 2 из 17 | 14 с | cc9654a | [лог](logs/2026-09-20T12-19-44Z-unit-f848.log) | After npm ci on upstream 4363d96: Nest resolution ARI and isolated stand regressions |
| 20.09.2026 17:19 | e2e (частично: --config tests/ui/playwright.auth.config.ts --workers=1) | ✅ 4 из 4 | 39 с | cc9654a | [лог](logs/2026-09-20T12-19-44Z-e2e-c3c6.log) | Final auth lock UI check after npm ci on upstream 4363d96 |
| 20.09.2026 17:20 | unit (частично: tests/unit/nest-http-adapter.test.ts tests/unit/ari-server.test.ts tests/unit/ari-switch-server.test.ts tests/unit/local-db-start.test.ts tests/ | ✅ 17 из 17 | 6 с | cc9654a +2 | [лог](logs/2026-09-20T12-20-39Z-unit-5d57.log) | Fix regression probe to resolve public Nest entry point; preserve child timeout and all assertions |
| 20.09.2026 17:21 | unit | ✅ 1315 из 1318, пропущено 3 | 1 мин 56 с | cc9654a +2 | [лог](logs/2026-09-20T12-21-17Z-unit-b00e.log) | Final complete unit acceptance after upstream 4363d96 and clean npm ci on Node 24 |
| 20.09.2026 17:27 | unit (частично: tests/unit/nest-http-adapter.test.ts) | ✅ 2 из 2 | 2 с | b74e2c2 +1 | [лог](logs/2026-09-20T12-27-16Z-unit-131e.log) | Resolve parallel equivalent Nest probe fix in favor of main da6f79f |
| 20.09.2026 12:00 | typecheck | ❌ ошибок: 24 | 24 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-00-09Z-typecheck-a55a.log) | TS2339 |
| 20.09.2026 12:01 | unit (частично: apps/api/src/accounts/sessions.controller.test.ts) | ❌ упало 1 из 6 | 4 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-01-18Z-unit-0ab2.log) | оба входа рядом (Q-146) сессия по паролю (отпечаток SHA-256, ADR-049) видит список, помечена своей и гасит всё, включая сессию по коду |
| 20.09.2026 12:01 | unit (частично: apps/api/src/accounts apps/api/src/auth packages/domain/src/accounts) | ✅ 223 из 223 | 4 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-01-22Z-unit-c1d3.log) |  |
| 20.09.2026 12:01 | typecheck | ✅ без ошибок | 15 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-01-27Z-typecheck-60be.log) |  |
| 20.09.2026 12:01 | lint | ✅ без ошибок | 14 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-01-43Z-lint-2869.log) |  |
| 20.09.2026 12:02 | integration | ✅ 45 из 45 | 13 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-02-15Z-integration-c3dc.log) |  |
| 20.09.2026 12:02 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/sessions.spec.ts tests/ui/invites.spec.ts tests/ui/login-access.spec.ts) | ✅ 23 из 23 | 1 мин 18 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-02-28Z-e2e-5eaf.log) |  |
| 20.09.2026 12:04 | unit | ✅ 1321 из 1324, пропущено 3 | 1 мин 12 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-04-01Z-unit-33da.log) |  |
| 20.09.2026 12:05 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 13 из 185 | 15 мин 2 с | 9fe9ff5 +50 | [лог](logs/2026-09-20T07-05-44Z-e2e-453a.log) | доступность всех разделов: light, 390px |
| 20.09.2026 17:15 | typecheck | ✅ без ошибок | 30 с | 7bdd0e7 +4 | [лог](logs/2026-09-20T12-15-23Z-typecheck-8122.log) |  |
| 20.09.2026 17:15 | lint | ✅ без ошибок | 14 с | 7bdd0e7 +4 | [лог](logs/2026-09-20T12-15-53Z-lint-8cb3.log) |  |
| 20.09.2026 17:16 | unit | ❌ упало 1 из 1324, пропущено 6 | 1 мин 16 с | 7bdd0e7 +3 | [лог](logs/2026-09-20T12-16-11Z-unit-7f5b.log) | repo-sync.sh: связь папки с репозиторием проверка: называет remote, отставание от origin/main, службы в другой папке; код выхода 1 |
| 20.09.2026 17:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 181 | 12 мин 8 с | 7bdd0e7 +4 | [лог](logs/2026-09-20T12-15-22Z-e2e-2eb3.log) | карточка: «Продлить на ночь» знает сумму заранее; занятая ячейка отключает кнопку с причиной |
| 20.09.2026 17:29 | typecheck | ❌ ошибок: 1 | 16 с | 7bdd0e7 +5 | [лог](logs/2026-09-20T12-29-30Z-typecheck-8540.log) | TS2375 |
| 20.09.2026 17:29 | typecheck | ✅ без ошибок | 16 с | 7bdd0e7 +5 | [лог](logs/2026-09-20T12-29-56Z-typecheck-3153.log) |  |
| 20.09.2026 17:30 | lint | ✅ без ошибок | 10 с | 7bdd0e7 +5 | [лог](logs/2026-09-20T12-30-12Z-lint-9cbc.log) |  |
| 20.09.2026 17:30 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 1 из 181 | 11 мин 47 с | 7bdd0e7 +5 | [лог](logs/2026-09-20T12-30-30Z-e2e-6c3c.log) | карточка: «Продлить на ночь» знает сумму заранее; занятая ячейка отключает кнопку с причиной |
| 20.09.2026 17:44 | unit | ✅ 1321 из 1324, пропущено 3 | 1 мин 12 с | 7bdd0e7 +4 | [лог](logs/2026-09-20T12-44-47Z-unit-496c.log) |  |
| 20.09.2026 17:46 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 181 из 181 | 11 мин 36 с | 7bdd0e7 +5 | [лог](logs/2026-09-20T12-46-06Z-e2e-6e52.log) |  |
| 20.09.2026 17:58 | integration | ✅ 45 из 45 | 14 с | 7bdd0e7 +1 | [лог](logs/2026-09-20T12-58-19Z-integration-a5a4.log) |  |
| 20.09.2026 00:04 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 10 из 181 | 9 мин 37 с | 06729e9 | [лог](logs/2026-09-19T19-04-02Z-e2e-ed8c.log) | Full synthetic UI regression on merged main before server activation |
| 20.09.2026 00:14 | unit (частично: tests/unit/deploy-server.test.ts) | ❌ упало 1 из 27 | 1 с | 06729e9 +1 | [лог](logs/2026-09-19T19-14-11Z-unit-b697.log) | RED: reject vulnerable runtime multer in lockfile |
| 20.09.2026 00:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 fixture-state) | ❌ упало 2 из 2 | 5 с | 06729e9 +1 | [лог](logs/2026-09-19T19-14-21Z-e2e-cab7.log) | RED: fixture reset isolation and merged preview consistency |
| 20.09.2026 00:16 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 fixture-state manager-actions quality workspace --grep (стенд:\|Продлить на ночь\|изменение убор | ❌ упало 2 из 12 | 37 с | 06729e9 +10 | [лог](logs/2026-09-19T19-16-32Z-e2e-1067.log) | GREEN: full-suite regressions: fixture isolation, non-blocking board help and preserved merged dialogs |
| 20.09.2026 12:50 | lint | ✅ без ошибок | 5 с | 06729e9 +11 | [лог](logs/2026-09-20T07-50-06Z-lint-0df0.log) |  |
| 20.09.2026 12:50 | unit | ❌ упало 2 из 1315, пропущено 207 | 1 мин 12 с | 06729e9 +7 | [лог](logs/2026-09-20T07-50-11Z-unit-b32a.log) | выключатель ARI на сервере файл записан, а процесс выключателя не видит — это ОШИБКА, а не успех |
| 20.09.2026 16:56 | unit | ❌ упало 2 из 1315, пропущено 207 | 1 мин 16 с | 06729e9 +7 | [лог](logs/2026-09-20T11-56-17Z-unit-535c.log) | выключатель ARI на сервере файл записан, а процесс выключателя не видит — это ОШИБКА, а не успех |
| 20.09.2026 17:07 | unit | ❌ упало 2 из 1317, пропущено 3 | 1 мин 15 с | 4363d96 +6 | [лог](logs/2026-09-20T12-07-10Z-unit-4066.log) | install.sh domain: две проверки до установки с заполненным конфигом и молчащим адресом обе проверки пропускают |
| 20.09.2026 17:27 | unit | ✅ 1314 из 1317, пропущено 3 | 1 мин 16 с | da6f79f +6 | [лог](logs/2026-09-20T12-27-18Z-unit-0dd8.log) |  |
| 20.09.2026 17:47 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/system-screens.spec.ts tests/ui/channex-screens.spec.ts tests/ui/premium.spec.ts --workers=1) | ✅ 21 из 21 | 3 мин 13 с | ba8c8a5 +2 | [лог](logs/2026-09-20T12-47-32Z-e2e-fa8f.log) |  |
| 20.09.2026 18:05 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 workspace.spec.ts manager-actions.spec.ts chessboard-week.spec.ts chessboard-month.spec.ts --g | ✅ 9 из 9 | 1 мин 2 с | 059cb8a +5 | [лог](logs/2026-09-20T13-05-44Z-e2e-9c64.log) |  |
| 20.09.2026 18:07 | e2e (частично: --config tests/ui/playwright.config.ts fixture-isolation.spec.ts) | ❌ упало 2 из 2 | 6 с | 059cb8a +6 | [лог](logs/2026-09-20T13-07-53Z-e2e-8716.log) | сброс после дизайн-сценария восстанавливает названия категорий и ячеек |
| 20.09.2026 18:08 | e2e (частично: --config tests/ui/playwright.config.ts fixture-isolation.spec.ts manager-actions.spec.ts chessboard-month.spec.ts) | ❌ упало 1 из 18 | 2 мин 2 с | 059cb8a +8 | [лог](logs/2026-09-20T13-08-54Z-e2e-e173.log) | шахматка: плашки «сверх мест» и «требует разбора», «Разрешить» у строки без ячейки |
| 20.09.2026 18:11 | lint | ✅ без ошибок | 12 с | 059cb8a +8 | [лог](logs/2026-09-20T13-11-40Z-lint-5427.log) |  |
| 20.09.2026 18:12 | typecheck | ✅ без ошибок | 15 с | 059cb8a +8 | [лог](logs/2026-09-20T13-12-12Z-typecheck-fcaa.log) |  |
| 20.09.2026 18:13 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 fixture-isolation.spec.ts manager-actions.spec.ts chessboard-month.spec.ts) | ✅ 18 из 18 | 2 мин 37 с | 9796ec6 | [лог](logs/2026-09-20T13-13-41Z-e2e-7623.log) |  |
| 20.09.2026 18:00 | typecheck | ✅ без ошибок | 21 с | 5b83942 | [лог](logs/2026-09-20T13-00-41Z-typecheck-73cc.log) |  |
| 20.09.2026 18:01 | lint | ✅ без ошибок | 11 с | 5b83942 | [лог](logs/2026-09-20T13-01-02Z-lint-6564.log) |  |
| 20.09.2026 18:01 | unit | ✅ 1324 из 1327, пропущено 3 | 1 мин 23 с | 5b83942 | [лог](logs/2026-09-20T13-01-13Z-unit-cc14.log) |  |
| 20.09.2026 18:02 | integration | ✅ 45 из 45 | 13 с | 5b83942 | [лог](logs/2026-09-20T13-02-49Z-integration-b773.log) |  |
| 20.09.2026 18:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 181 из 181 | 11 мин 42 с | 5b83942 | [лог](logs/2026-09-20T13-03-08Z-e2e-3a64.log) |  |
| 20.09.2026 18:24 | unit | ✅ 1329 из 1332, пропущено 3 | 1 мин 24 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-24-41Z-unit-a17a.log) |  |
| 20.09.2026 18:26 | e2e | ✅ 25 из 25 | 1 мин 6 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-26-22Z-e2e-1cd7.log) |  |
| 20.09.2026 18:27 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --update-snapshots --workers=1) | ✅ 9 из 9 | 52 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-27-49Z-e2e-f5b6.log) |  |
| 20.09.2026 18:29 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 32 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-29-00Z-e2e-a718.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:30 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 32 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-30-32Z-e2e-f8c0.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:31 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 32 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-31-05Z-e2e-7175.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:31 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 33 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-31-37Z-e2e-8d77.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:32 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 34 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-32-11Z-e2e-3c58.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:32 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 37 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-32-45Z-e2e-a242.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:33 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts --workers=1) | ❌ упало 2 из 9 | 37 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-33-23Z-e2e-e3df.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ⏹ прерван | 2 мин 8 с | 123e6a6 +50 | [лог](logs/2026-09-20T13-34-12Z-e2e-f851.log) |  |
| 20.09.2026 18:40 | unit | ✅ 1332 из 1335, пропущено 3 | 1 мин 13 с | 0f0a1e4 +2 | [лог](logs/2026-09-20T13-40-04Z-unit-ac48.log) |  |
| 20.09.2026 18:39 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 4 из 205 | 15 мин 39 с | 0f0a1e4 +1 | [лог](logs/2026-09-20T13-39-16Z-e2e-3dd2.log) | axe и эталонные снимки секций: light |
| 20.09.2026 18:54 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 7 из 7 | 13 с | 88904c2 | [лог](logs/2026-09-20T13-54-56Z-e2e-dd35.log) |  |
| 20.09.2026 18:21 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 sessions.spec.ts fixture-isolation.spec.ts workspace.spec.ts --grep сеанс\|сброс после дизайн\|с | ✅ 12 из 12 | 1 мин 21 с | 8b130ff | [лог](logs/2026-09-20T13-21-37Z-e2e-3e30.log) |  |
| 20.09.2026 18:24 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 chessboard-week.spec.ts --grep помещается на экране) | ✅ 2 из 2 | 40 с | 8b130ff +1 | [лог](logs/2026-09-20T13-24-22Z-e2e-3b50.log) |  |
| 20.09.2026 18:26 | typecheck | ✅ без ошибок | 22 с | 4931030 | [лог](logs/2026-09-20T13-26-02Z-typecheck-7260.log) |  |
| 20.09.2026 18:39 | integration | ❌ код выхода 1 | 2 с | 4931030 | [лог](logs/2026-09-20T13-39-45Z-integration-a2c5.log) |  |
| 20.09.2026 18:40 | integration | ❌ код выхода 1 | 6 с | 4931030 | [лог](logs/2026-09-20T13-40-42Z-integration-44df.log) |  |
| 20.09.2026 18:42 | integration | ✅ 45 из 45 | 14 с | 4931030 | [лог](logs/2026-09-20T13-42-36Z-integration-55eb.log) |  |
| 20.09.2026 18:17 | unit (частично: packages/domain/src/accounts/session-renew.test.ts apps/api/src/auth/auth.service.test.ts) | ❌ упало 5 из 26 | 4 с | b0961ca +2 | [лог](logs/2026-09-20T13-17-25Z-unit-75d1.log) | AuthService.whoami сессия, открытая входом по коду (отпечаток HMAC) работа продлевает срок: через сутки сессия снова живёт 30 суток (§13.5) |
| 20.09.2026 18:17 | unit (частично: packages/domain/src/accounts/session-renew.test.ts apps/api/src/auth) | ✅ 74 из 74 | 4 с | b0961ca +4 | [лог](logs/2026-09-20T13-17-59Z-unit-9896.log) |  |
| 20.09.2026 18:18 | typecheck | ✅ без ошибок | 19 с | b0961ca +7 | [лог](logs/2026-09-20T13-18-59Z-typecheck-95ad.log) |  |
| 20.09.2026 18:21 | lint | ✅ без ошибок | 10 с | b0961ca +8 | [лог](logs/2026-09-20T13-21-05Z-lint-09b5.log) |  |
| 20.09.2026 18:21 | unit | ✅ 1333 из 1336, пропущено 3 | 1 мин 12 с | b0961ca +7 | [лог](logs/2026-09-20T13-21-15Z-unit-f51c.log) |  |
| 20.09.2026 18:22 | integration | ❌ упало 1 из 45 | 13 с | b0961ca +4 | [лог](logs/2026-09-20T13-22-32Z-integration-7abc.log) | importReservations (integration, DATABASE_URL required) Q-127 / Q-128 (ADR-050, ADR-051): проживание, исчезнувшее из карточки Exely, отменяется; удержанная в Ex |
| 20.09.2026 18:23 | integration | ✅ 45 из 45 | 13 с | b0961ca +4 | [лог](logs/2026-09-20T13-23-10Z-integration-36a8.log) |  |
| 20.09.2026 18:24 | integration | ✅ 45 из 45 | 13 с | b0961ca +5 | [лог](logs/2026-09-20T13-24-28Z-integration-391e.log) |  |
| 20.09.2026 18:24 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 182 из 182 | 11 мин 50 с | b0961ca +9 | [лог](logs/2026-09-20T13-24-49Z-e2e-3d20.log) |  |
| 20.09.2026 19:02 | unit | ✅ 1339 из 1342, пропущено 3 | 1 мин 12 с | 02d7f77 +1 | [лог](logs/2026-09-20T14-02-52Z-unit-012b.log) |  |
| 20.09.2026 19:02 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-system.spec.ts tests/ui/invites.spec.ts tests/ui/sessions.spec.ts tests/ui/login-access.sp | ✅ 38 из 38 | 1 мин 57 с | 02d7f77 +2 | [лог](logs/2026-09-20T14-02-45Z-e2e-a4c6.log) |  |
| 20.09.2026 19:04 | e2e | ✅ 25 из 25 | 1 мин 4 с | 02d7f77 +2 | [лог](logs/2026-09-20T14-04-42Z-e2e-cbd1.log) |  |
| 20.09.2026 19:10 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/sessions.spec.ts tests/ui/invites.spec.ts --workers=1) | ✅ 8 из 8 | 19 с | 5641877 +2 | [лог](logs/2026-09-20T14-10-44Z-e2e-6974.log) |  |
| 20.09.2026 19:29 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/design-refresh.spec.ts --workers=1) | ✅ 7 из 7 | 1 мин 8 с | c3b0345 +1 | [лог](logs/2026-09-20T14-29-10Z-e2e-b5b8.log) |  |
| 20.09.2026 19:31 | unit | ✅ 1339 из 1342, пропущено 3 | 1 мин 13 с | b6895cc | [лог](logs/2026-09-20T14-31-42Z-unit-7e26.log) |  |
| 20.09.2026 19:32 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/invites.spec.ts tests/ui/sessions.spec.ts tests/ui/login-access.spec.ts tests/ui/system-screens.s | ✅ 35 из 35 | 2 мин 15 с | b6895cc | [лог](logs/2026-09-20T14-32-55Z-e2e-93d7.log) |  |
| 20.09.2026 18:57 | typecheck | ❌ ошибок: 1 | 50 с | dba25c9 +25 | [лог](logs/2026-09-20T13-57-06Z-typecheck-df07.log) | TS2783 |
| 20.09.2026 18:58 | typecheck | ✅ без ошибок | 1 мин 23 с | dba25c9 +25 | [лог](logs/2026-09-20T13-58-26Z-typecheck-cd06.log) |  |
| 20.09.2026 19:00 | integration | ✅ 45 из 45 | 53 с | 8da62d5 | [лог](logs/2026-09-20T14-00-57Z-integration-df36.log) |  |
| 20.09.2026 19:00 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 login-access.spec.ts invites.spec.ts sessions.spec.ts) | ❌ упало 4 из 24 | 5 мин 56 с | 8da62d5 | [лог](logs/2026-09-20T14-00-57Z-e2e-6be1.log) | вошедший видит ожидающие приглашения и зовёт по почте; ошибки формы — текстом |
| 20.09.2026 19:07 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 invites.spec.ts sessions.spec.ts) | ✅ 9 из 9 | 1 мин 29 с | 8da62d5 +2 | [лог](logs/2026-09-20T14-07-32Z-e2e-c80f.log) |  |
| 20.09.2026 19:30 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 sessions.spec.ts --grep вошедший видит, где) | ❌ упало 1 из 1 | 1 мин 47 с | 0573c1f +10 | [лог](logs/2026-09-20T14-30-50Z-e2e-b105.log) | вошедший видит, где он вошёл, — устройство словами и пометку своего сеанса |
| 20.09.2026 19:33 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 invites.spec.ts sessions.spec.ts) | ✅ 9 из 9 | 46 с | 0573c1f +11 | [лог](logs/2026-09-20T14-33-32Z-e2e-1097.log) |  |
| 20.09.2026 19:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 invites.spec.ts --grep мёртвая ссылка) | ❌ упало 1 из 1 | 36 с | 0573c1f +11 | [лог](logs/2026-09-20T14-34-42Z-e2e-a33b.log) | мёртвая ссылка — один текст и путь на форму входа |
| 20.09.2026 19:36 | typecheck | ✅ без ошибок | 1 мин 17 с | 0573c1f +13 | [лог](logs/2026-09-20T14-36-23Z-typecheck-b149.log) |  |
| 20.09.2026 19:36 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 invites.spec.ts sessions.spec.ts) | ✅ 9 из 9 | 1 мин 18 с | 0573c1f +13 | [лог](logs/2026-09-20T14-36-23Z-e2e-46d6.log) |  |
| 20.09.2026 18:37 | typecheck | ❌ ошибок: 1 | 19 с | a38b83c | [лог](logs/2026-09-20T13-37-57Z-typecheck-e5e6.log) | TS2783 |
| 20.09.2026 18:38 | lint | ✅ без ошибок | 10 с | a38b83c | [лог](logs/2026-09-20T13-38-17Z-lint-e75a.log) |  |
| 20.09.2026 18:38 | unit | ✅ 1336 из 1339, пропущено 3 | 1 мин 12 с | a38b83c | [лог](logs/2026-09-20T13-38-28Z-unit-63ad.log) |  |
| 20.09.2026 18:39 | typecheck | ✅ без ошибок | 16 с | a38b83c +1 | [лог](logs/2026-09-20T13-39-59Z-typecheck-3c23.log) |  |
| 20.09.2026 18:40 | unit (частично: apps/api/src/auth) | ✅ 77 из 77 | 4 с | a38b83c +1 | [лог](logs/2026-09-20T13-40-15Z-unit-8ef2.log) |  |
| 20.09.2026 18:40 | integration | ✅ 45 из 45 | 13 с | a38b83c +1 | [лог](logs/2026-09-20T13-40-29Z-integration-0f9c.log) |  |
| 20.09.2026 18:40 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 4 из 182 | 14 мин 16 с | a38b83c +1 | [лог](logs/2026-09-20T13-40-50Z-e2e-7991.log) | вошедший видит ожидающие приглашения и зовёт по почте; ошибки формы — текстом |
| 20.09.2026 18:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 181 из 181 | 11 мин 44 с | a38b83c +3 | [лог](logs/2026-09-20T13-57-27Z-e2e-971f.log) |  |
| 20.09.2026 19:10 | typecheck | ✅ без ошибок | 16 с | 84bb579 | [лог](logs/2026-09-20T14-10-18Z-typecheck-4055.log) |  |
| 20.09.2026 19:10 | lint | ✅ без ошибок | 10 с | 84bb579 | [лог](logs/2026-09-20T14-10-35Z-lint-eda0.log) |  |
| 20.09.2026 19:10 | unit | ✅ 1336 из 1339, пропущено 3 | 1 мин 12 с | 84bb579 | [лог](logs/2026-09-20T14-10-46Z-unit-92eb.log) |  |
| 20.09.2026 19:12 | integration | ✅ 45 из 45 | 13 с | 84bb579 | [лог](logs/2026-09-20T14-12-10Z-integration-65ad.log) |  |
| 20.09.2026 19:12 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 181 из 181 | 11 мин 50 с | 84bb579 | [лог](logs/2026-09-20T14-12-24Z-e2e-5868.log) |  |
| 20.09.2026 19:32 | typecheck | ✅ без ошибок | 20 с | 2ecd6fe | [лог](logs/2026-09-20T14-32-09Z-typecheck-0fd0.log) |  |
| 20.09.2026 19:32 | lint | ✅ без ошибок | 10 с | 2ecd6fe | [лог](logs/2026-09-20T14-32-29Z-lint-f67b.log) |  |
| 20.09.2026 19:32 | unit | ✅ 1336 из 1339, пропущено 3 | 1 мин 12 с | 2ecd6fe | [лог](logs/2026-09-20T14-32-40Z-unit-a146.log) |  |
| 20.09.2026 19:43 | typecheck | ✅ без ошибок | 29 с | 2ecd6fe +3 | [лог](logs/2026-09-20T14-43-52Z-typecheck-fbad.log) |  |
| 20.09.2026 19:44 | lint | ✅ без ошибок | 15 с | 2ecd6fe +3 | [лог](logs/2026-09-20T14-44-22Z-lint-43d2.log) |  |
| 20.09.2026 19:34 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 181 из 181 | 11 мин 53 с | 2ecd6fe | [лог](logs/2026-09-20T14-34-05Z-e2e-ab6a.log) |  |
| 20.09.2026 19:52 | unit | ✅ 1340 из 1343, пропущено 3 | 1 мин 12 с | 2ecd6fe +3 | [лог](logs/2026-09-20T14-52-43Z-unit-907f.log) |  |
| 20.09.2026 19:53 | typecheck | ✅ без ошибок | 21 с | 2ecd6fe +3 | [лог](logs/2026-09-20T14-53-55Z-typecheck-57dc.log) |  |
| 20.09.2026 19:54 | lint | ✅ без ошибок | 10 с | 2ecd6fe +3 | [лог](logs/2026-09-20T14-54-17Z-lint-cbd0.log) |  |
