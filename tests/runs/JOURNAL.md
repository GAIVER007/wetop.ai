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
