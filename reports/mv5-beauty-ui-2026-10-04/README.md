# MV5: WETOP Beauty UI

Дата: 04.10.2026. Ветка `codex/mv5-beauty-ui-20261004`.

## Предшествующий MV4

PR #241 синхронизирован со свежим main и влит после проверок. Merge SHA: `6974cb3b95cb5e0cfb5bc412488c2e6e87b79e4f`, 04.10.2026 15:12:47 UTC. Upstream затронул исправление migration 52 и Hospitality QA, Beauty/Auth scope не изменились. На merge revision прошли migration chain/drift/rollback, 3339 unit, 348 integration, typecheck и lint. Подробные логи в отчёте MV4.

## Реализовано

- Beauty landing `/calendar`: после завершения onboarding, при открытии корня, старого `/today` и переключении филиала.
- Меню по server-resolved `Business.vertical`: Календарь, Записи, Клиенты, Сотрудники, Услуги; общие Сотрудники и доступ, Журнал, Помощь, Профиль. Query vertical не выбирает меню.
- Оболочка Beauty получает имя и timezone только выбранного verified Business/Location. Нет выбора первого попавшегося Beauty-филиала, запросов hotel settings, опроса Channex freshness, гостиничного tour или AI widget.
- Календарь: дата, сегодня, предыдущий/следующий день, мастера колонками, рабочие часы, отсутствие с причиной, свободные интервалы и записи. На 390 px выбранный мастер и его timeline.
- Общая форма Appointment: существующий или новый клиент, услуга, мастер, дата/время, серверная цена, заметка. При overlap сообщение API показывается внутри формы; введённое сохраняется.
- Карточка: сведения и разрешённые сервером `next` действия, перенос, подтверждение, завершение, неявка, отмена с подтверждением. Никакого `IN_PROGRESS`.
- `/appointments`: отдельный список выбранного дня, фильтры статуса/мастера/услуги и поиск по имени/телефону. Архивные мастера сохраняют имя в истории и фильтрах.
- `/services`: каталог, архивность, включение услуги в Location и переопределение цены/длительности существующими actions.
- `/employees`: Employee, отдельно от Membership. Филиалы, услуги, работа сегодня; панель с основными данными, услугами, филиалами, weekly hours и TimeOff. После сохранения графика/отсутствия данные панели обновляются.
- `/customers`: существующий read endpoint с CustomerBusiness visibility. Создание клиента только через Appointment.
- Empty states, READ_ONLY и существующие permissions, WETOP tokens/Overlay/Table, светлая и тёмная темы.

## Границы

Prisma, миграции, domain model, backend contracts и бизнес-правила не менялись. Eligibility, overlap, разрешения, scope и ограничения состояния остаются на API. Цена не редактируется произвольным числом в записи: используется существующая серверная цена в minor units. Фильтры записей ограничены выбранным днём согласно текущему read contract.

Старые `/beauty`, `/beauty/services`, `/beauty/masters`, `/beauty/schedule` сохранены для совместимости. Общий журнал остаётся существующим organization-level audit. Нового audit scope этот срез не вводит.

Production не обновлялся. Миграции 51/52 остаются отдельным rollout владельца. MV6 не начат.

## Проверки

Проверки совместимости: **40/40 PASS**, `tests/runs/logs/2026-10-04T15-46-41Z-e2e-fe04.log`. Включены старые Beauty branch/catalog/schedule/journal, Hospitality branch switching и loading-performance.

Первый полный unit-прогон выявил 34 инфраструктурных таймаута/проверки времени при избыточном параллелизме и четыре проверки дизайн-правил. Исправлены текстовый шеврон, отступы и слой sticky header; ratchet baseline снижен для удалённого разделителя в metadata. Повторный полный прогон использует два workers и параметры длинных shell-тестов, применённые при приёмке MV4. Assertions и тесты не удалялись.

- Full integration: **348 PASS, 9 existing skips**, `tests/runs/logs/2026-10-04T15-56-44Z-integration-56ae.log`. Включая 23 MV4 scope/permissions/concurrency теста.
- Full typecheck: **PASS**, `tests/runs/logs/2026-10-04T15-56-44Z-typecheck-282b.log`.
- Full lint: **PASS**, `tests/runs/logs/2026-10-04T15-56-44Z-lint-6570.log`.
- Full unit: **3339 PASS, 4 existing skips**, `tests/runs/logs/2026-10-04T15-56-24Z-unit-d905.log`. Параметры: `--maxWorkers=2 --testTimeout=30000`, как в принятом MV4.
- Real API browser: **10/10 PASS**, `tests/runs/logs/2026-10-04T15-57-56Z-e2e-323c.log`. Persist/reload/move/confirm/DONE, existing customer reuse, two Businesses/two Locations, STAFF, READ_ONLY, overlap, archives на desktop/mobile, TimeOff, timezone, onboarding; axe/keyboard/no overflow в четырёх visual modes.
- Onboarding regression: **4/4 PASS**, `tests/runs/logs/2026-10-04T15-58-56Z-e2e-81a3.log`. BEAUTY, FOOD_SERVICE, READ_ONLY и прежний Hospitality flow.
- `git diff --check`: PASS. Backend/schema/domain diff пуст. Старые snapshots MV3/B2-B5 восстановлены; новые снимки сохранены только в отчёте MV5.

Все итоговые recorded runs завершились без изменения отпечатка кода во время прогона. Новых skips нет.

Новый browser harness использует настоящие Nest Beauty controllers, RoleGuard, AuthorInterceptor и отдельный локальный PostgreSQL. Identity синтетическая, это доказательство UI + Beauty API + persistence, а не полноценного production login/email transport. Все имена и контакты вымышленные. Второй набор UI использует существующий loopback mock API и проверяет совместимость интерфейса; не является доказательством DB isolation.

Red/green: новое меню сначала дало 3 падения; overlap выявил сброс имени клиента; архивирование мастера выявило исчезновение исторической записи; добавление TimeOff выявило устаревший список открытой панели; переключение гостиницы на Beauty выявило оставшуюся строку Channex freshness. Исправления проверены браузером. Red logs:

- Navigation: `2026-10-04T15-13-34Z-unit-50c7.log`, green `2026-10-04T15-20-50Z-unit-a45c.log`.
- Overlap draft retention: `2026-10-04T15-28-22Z-e2e-dfbe.log`.
- Archived employee history: `2026-10-04T15-31-29Z-e2e-b014.log`.
- TimeOff panel refresh: `2026-10-04T15-39-12Z-e2e-0a81.log`.
- Stale Channex indicator after switching: `2026-10-04T15-45-38Z-e2e-2195.log`.

Все файлы находятся в `tests/runs/logs/`; окончательные green прогоны указаны выше.

## Снимки

24 снимка в `screenshots/`: Calendar, Appointment drawer, Appointments, Services, Employees, Customers; каждый в 1440/390 и light/dark. Календарь содержит три мастера, запись и отсутствие. Full-page mobile screenshot включает всю временную ось; нижняя навигация фиксируется на высоте viewport.

| Экран | Desktop light | Desktop dark | Mobile light | Mobile dark |
| --- | --- | --- | --- | --- |
| Calendar | [1440](screenshots/calendar-1440-light.png) | [1440](screenshots/calendar-1440-dark.png) | [390](screenshots/calendar-390-light.png) | [390](screenshots/calendar-390-dark.png) |
| Appointment | [1440](screenshots/drawer-1440-light.png) | [1440](screenshots/drawer-1440-dark.png) | [390](screenshots/drawer-390-light.png) | [390](screenshots/drawer-390-dark.png) |
| Appointments | [1440](screenshots/appointments-1440-light.png) | [1440](screenshots/appointments-1440-dark.png) | [390](screenshots/appointments-390-light.png) | [390](screenshots/appointments-390-dark.png) |
| Services | [1440](screenshots/services-1440-light.png) | [1440](screenshots/services-1440-dark.png) | [390](screenshots/services-390-light.png) | [390](screenshots/services-390-dark.png) |
| Employees | [1440](screenshots/employees-1440-light.png) | [1440](screenshots/employees-1440-dark.png) | [390](screenshots/employees-390-light.png) | [390](screenshots/employees-390-dark.png) |
| Customers | [1440](screenshots/customers-1440-light.png) | [1440](screenshots/customers-1440-dark.png) | [390](screenshots/customers-390-light.png) | [390](screenshots/customers-390-dark.png) |

## Review и передача

Проверены scope источники, money paths, server actions, состояние форм после отказа, исторические записи, permissions, повторное использование общих компонентов, отсутствие новых dependencies. Поздний ответ графика другого мастера не может подменить открытого сотрудника. Дизайн-baseline только ужесточён: удалено одно прежнее разрешённое нарушение в layout, новые исключения не добавлялись.

24 снимка получены последним real API browser прогоном. Визуально проверены desktop/mobile calendar и drawer, таблицы/карточки услуг и мастеров, список записей и клиентов. На коротких слотах полные сведения доступны в drawer и подсказке карточки.

Production, release branch и миграции не затрагивались. Следующий шаг: review PR MV5 владельцем. После передачи STOP; MV6 не разрешён.
