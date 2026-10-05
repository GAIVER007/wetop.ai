# MV7: Food Service workspace

## Объём и границы

Food PILOT получил web workspace поверх существующего MV6 API: План зала, Бронирования, Гости, Залы и столы, периоды обслуживания и общий reservation drawer. Backend, Prisma schema, migrations, financial logic и разрешения MV7 не меняет. POS, меню блюд, касса, ARI, production submissions и MV8 не добавлены.

План утверждён владельцем сообщением «давай». Работа выполнена в `/Users/urijzapojnov/wetop-mv7-20261005`, ветка `codex/mv7-food-ui-20261005`. Исходное чужое дерево WETOP не изменялось кодом. Общая Supabase не использовалась. PostgreSQL 16 на `127.0.0.1:55763`, только синтетические данные.

Начальная база: `629367018a6ffacf1a4698d56340812a67d9bb86`. Перед окончательными проверками включён main `e2f67c96ae3e8e606df92305bad9626282ba7030`. Архитектура записана в ADR-MV7 в DECISIONS.md. Migration 59 пришла из main, это отдельная upstream правка MV6, diff MV7 к main не содержит migrations.

## Route и permission matrix

| Route | Назначение | Чтение / изменения |
|---|---|---|
| `/floor-plan` | Карточки столов по залам, дата, локальное время, занятость, без стола | desk / desk, READ_ONLY только чтение |
| `/table-reservations` | Полный серверный день, поиск, статус, период, зал, стол | desk / desk, READ_ONLY только чтение |
| `/customers` | Food adapter, существующие клиенты Business | desk, только чтение; новый клиент через бронь |
| `/dining-areas` | Залы, столы, отдельный tab периодов | desk / property, STAFF без catalog mutations |
| `/staff` | Существующий общий доступ, canonical redirect `/team` | существующая permission engine |
| `/journal` | Существующий общий audit | существующая permission engine |
| `/help`, `/profile` | Food guidance и общий профиль | существующая permission engine |

Real browser matrix проверяет 17 прямых адресов чужих workspace без чужих API requests. Guards покрывают также прямой вход в finance, rooms/categories и старый onboarding. Root, logo, завершение onboarding и switch используют canonical landing: HOSPITALITY `/today`, BEAUTY `/calendar`, FOOD_SERVICE `/floor-plan`. Vertical берётся из server-resolved `/auth/me`; query `vertical` не используется. Guards срабатывают до чужих vertical API. Draft закрывается до switch, scope key привязан к Business/Location; server action повторно проверяет текущий scope.

## API matrix

Typed `foodApi` использует общий authenticated scoped transport. Все 16 endpoints покрыты facade unit test и реальные мутации browser flow.

| Коллекция | Чтение | Изменения |
|---|---|---|
| areas | GET complete pagination | POST, PATCH (edit/archive/restore) |
| tables | GET complete pagination | POST, PATCH; areaId при edit не отправляется |
| service-periods | GET complete pagination | POST, PATCH (weekday/time/overnight/duration/active) |
| customers | GET complete pagination | создаётся MV6 при POST reservation |
| reservations | GET date + complete pagination | POST create, PATCH edit, POST status, PUT table, DELETE table с JSON body |

Creation UUID сохраняется на весь draft, включая ошибки; pending блокирует повторный submit. Edit/status/assign/unassign передают expectedStatus и expectedUpdatedAt. Stale 409 обновляет данные с сообщением «Бронирование уже изменилось. Данные обновлены.», без автоматического повторения mutation. Другие ошибки остаются inline с введёнными значениями.

Полные списки загружаются до nextCursor=null, повторный/пустой cursor и некорректный reservation response дают LoadError. Floor Plan объединяет выбранный и предыдущий локальные дни с дедупликацией ID, учитывает BOOKED/CONFIRMED/SEATED на `[startsAt, endsAt)`. Фильтр периода не скрывает факт занятости другим периодом. При недоступном API нет ложных свободных столов.

## Real API evidence

Harness: browser → Next server actions → реальные Nest Food/Beauty controllers, RoleGuard, AuthorInterceptor, FoodService → собственная PostgreSQL. Подставлены только identity/onboarding/branch discovery и test-control. В Food acceptance покрыты:

- UI setup area/table/period, new Customer + DESK BOOKED без стола, reload/readback, assignment, CONFIRMED, SEATED, COMPLETED.
- WALK_IN создаётся SEATED, после reload стол занят, после завершения свободен.
- overlap 409, archived table/period 404, draft сохранён, UUID не сменился.
- неверное окно периода и разовый 503 create, тот же draft key на повтор, одна persisted бронь.
- edit party/note, reassign/unassign, capacity denial, SEATED without table denial, catalog capacity conflict.
- archive/restore table, area, period, включая быстрое повторное открытие после save.
- stale external mutation, STAFF, READ_ONLY, wrong Business/Location, другой Food Business и два Locations, switch Beauty/Hospitality.
- более 100 броней, занятость на следующей странице, previous-day overnight и reload; unavailable API → LoadError.
- axe, keyboard Escape/focus return/focus containment, без горизонтального overflow.

Удаление fixtures ограничено собственным UUID marker Organization. Fixture Hospitality в Food switching проверяет выбор и переход в shared onboarding, поскольку этот синтетический отель пуст; полноценные Today/Chessboard и switching проверяются отдельным существующим Hospitality UI harness. Полные integration проверки используют pms_test и отдельную локальную БД.

## Visual evidence

[Все 20 screenshots](screenshots): 5 экранов × 1440/390 × light/dark. Каждый снят в real API run после завершения CSS transitions; axe выполняется на том же экране.

| Экран | Light 1440 | Dark 1440 | Light 390 | Dark 390 |
|---|---|---|---|---|
| floor-plan | [PNG](screenshots/floor-plan-light-1440.png) | [PNG](screenshots/floor-plan-dark-1440.png) | [PNG](screenshots/floor-plan-light-390.png) | [PNG](screenshots/floor-plan-dark-390.png) |
| table-reservations | [PNG](screenshots/table-reservations-light-1440.png) | [PNG](screenshots/table-reservations-dark-1440.png) | [PNG](screenshots/table-reservations-light-390.png) | [PNG](screenshots/table-reservations-dark-390.png) |
| dining-areas | [PNG](screenshots/dining-areas-light-1440.png) | [PNG](screenshots/dining-areas-dark-1440.png) | [PNG](screenshots/dining-areas-light-390.png) | [PNG](screenshots/dining-areas-dark-390.png) |
| customers | [PNG](screenshots/customers-light-1440.png) | [PNG](screenshots/customers-dark-1440.png) | [PNG](screenshots/customers-light-390.png) | [PNG](screenshots/customers-dark-390.png) |
| reservation-drawer | [PNG](screenshots/reservation-drawer-light-1440.png) | [PNG](screenshots/reservation-drawer-dark-1440.png) | [PNG](screenshots/reservation-drawer-light-390.png) | [PNG](screenshots/reservation-drawer-dark-390.png) |

## Проверки

Проверка цепочки: 65 migrations, schema drift отсутствует, все down возвращают исходную схему ([log](migrations.txt)). Diff к main не содержит backend/schema/migration изменений.

Окончательные результаты будут внесены после завершения прогонов. На macOS тесты shell запускаются с LC_ALL=C: системный Bash 3 некорректно читает соседнюю с variable кириллицу в UTF-8 locale. PostgreSQL независимо создана с encoding=UTF8 и locale=en_US.UTF-8. Ранний стенд SQL_ASCII приводил к ошибкам кириллического поиска и encoding, чистый UTF8 стенд прошёл 741 integration test.

Ранние RED и исправления сохранены в tests/runs с fingerprint. Новые tests не отключались, assertions не удалялись.

## Завершение

Отдельный PR «MV7: Food Service workspace». Merge, release и production запрещены этим поручением. После готового PR работа останавливается, MV8 не начинается.

## Code review

Самопроверка по code-review-and-quality: correctness (полная пагинация, midnight, server tokens, guarded scope), readability (общий drawer и typed facade), architecture (существующие transport/UI kit/permissions), security (server action scope, реальные RoleGuard negatives), performance (bounded pagination, параллельные независимые reads). Новая opt-in настройка Overlay используется только Food. Новые зависимости не добавлены. Real external API, деньги и schema отсутствуют в diff.

RED артефакты сохранены: отсутствие Food modules в unit; некорректные response details; незакрытый direct finance route; native Shift+Tab выходил из dialog; быстрый reopen catalog показывал предыдущий active. Дополнительно исправлены harness locale/encoding и ожидание persisted assignment перед capacity check. Assertions сохранены или усилены.
