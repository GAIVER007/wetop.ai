# MV5: WETOP Beauty UI

Дата: 04.10.2026. Завершение проверки: 05.10.2026. Ветка `codex/mv5-beauty-ui-20261004`. [PR #242](https://github.com/GAIVER007/wetop.ai/pull/242).

**Итог 05.10.2026: полный GREEN после BAR-FIX.** PR #244 влит отдельно, MV5 синхронизирован. На одном code head прошли unit 3364, integration 348, browser 10 + 40 + 4, typecheck/lint и 59 migrations/drift/down. Прежние skips: unit 4, integration 9; новых нет. Исторические неуспешные прогоны ниже сохранены; актуальная приёмка в последнем разделе.

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

## Проверки до синхронизации с main 75c45295

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

## Синхронизация перед передачей PR

При создании PR #242 GitHub обнаружил новый main `75c45295`: независимый модуль бара (коммиты `2bfde1b5`, `709e728f`, `75c45295`). Единственный текстовый конфликт в `navigation-beauty.test.ts`: сохранены канонические MV5 маршруты и upstream assertion, что `/bar` не входит в Beauty menu. API facade, навигация и ADR объединены; upstream изменения бара сохранены.

`Business.vertical`, RequestActor/scope и channels boundaries upstream не менялись. Относительно свежего main diff MV5 по `apps/api`, `packages` и DATA_MODEL пуст. Новая bar migration принадлежит main, не MV5; применялась только к отдельной локальной базе проверки. Production не затрагивался.

Проверка всех **58 миграций**, schema drift и каждого down: **PASS**, [лог](merge-main-migrations.log). Typecheck и lint после синхронизации: **PASS**, логи `2026-10-04T16-04-17Z-typecheck-7984.log` и `2026-10-04T16-04-17Z-lint-5b7b.log`. Full integration после синхронизации: **346 PASS, 2 FAIL, 9 existing skips**, `tests/runs/logs/2026-10-04T16-06-35Z-integration-bbc0.log`.

### Impact report: upstream bar blocks merge

1. `bar_property_guard()` создаётся в `20261004000051_bar_inventory` без закреплённого `search_path`. Падает неизменённый `tests/integration/function-search-path.test.ts`. Неявное разрешение имён в trigger function нарушает принятую защиту migration 43.
2. `bar_categories`, `bar_products`, `bar_receipt_lines`, `bar_receipts`, `bar_sale_lines`, `bar_sales`, `bar_stock_lots`, `bar_stock_movements`, `bar_supplier_payments`, `bar_suppliers` отсутствуют в `RLS_TENANT_TABLES` (`packages/database/src/rls.ts`). Падает неизменённый `tests/integration/rls-isolation.test.ts`. В самой bar migration RLS включён и policies созданы; дефект в неполном реестре покрытия, не утверждение об отключённом RLS.

Причина подтверждена diff: bar migration, RLS registry и оба integration tests в ветке идентичны `origin/main`. До её появления тот же полный integration был зелёным. `Business.vertical`, RequestActor и channels boundaries не менялись.

Нужен отдельный upstream fix бара: закрепить search_path по принятому образцу migration 43 с rollback, синхронизировать tenant-table registry с существующими bar policies и повторить full integration. Уже вошедшую migration не переписывать без проверки истории применения. Затем обновить MV5 от исправленного main и повторить зависимые проверки. В MV5 эти DB-файлы не менялись.

До устранения этих двух причин PR #242 не merge/deploy. Проверка цепочки и rollback PASS не заменяет упавшие runtime/invariant проверки.

### Дополнительные проверки объединённой версии

- Real API Beauty browser: **10/10 PASS**, `tests/runs/logs/2026-10-04T16-08-37Z-e2e-b0f4.log`. Все 24 снимка подтверждены этим прогоном.
- Первый полный unit после синхронизации: 3362 PASS, 1 FAIL, 4 existing skips (`2026-10-04T16-04-17Z-unit-91f8.log`), socket hangup в существующем web-booking rate-limit тесте. Изолированный повтор всего файла: **40/40 PASS**, `2026-10-04T16-08-36Z-unit-276c.log`.
- Второй полный unit: 3323 PASS, 1 FAIL, 4 existing skips плюс ошибка запуска worker (`2026-10-04T16-09-35Z-unit-6537.log`). Таймаут `ci-runner.test.ts`, worker `deploy-server.test.ts` не стартовал. Изолированный повтор обоих файлов: **59/59 PASS**, `2026-10-04T17-24-37Z-unit-069f.log`. Эти неуспешные полные прогоны сохранены и не считаются зелёными.

- Дополнительный navigation browser run `2026-10-04T17-24-19Z-e2e-4d63.log`: 7 PASS, 1 timeout, 7 не запущены. Операция с лимитом 45 секунд заняла 17 минут; полный процесс длился 34 минуты. Не считается успешным.
- Serial unit `2026-10-04T17-25-24Z-unit-c9ec.log` также столкнулся с многочасовыми задержками в shell tests. Причина задержек не доказана; результат не считается зелёным. Для последующих проверок временно предотвращён idle sleep через `caffeinate`, без изменений тестовых assertions.

- Итог serial unit: **3299 PASS, 27 FAIL, 28 skipped/not-run, 3 worker errors**. Новых skip-аннотаций в тестах нет; увеличившееся число непройденных тестов связано с неуспешным выполнением набора.
- Повтор navigation browser с предотвращением idle sleep: **0 PASS, 1 FAIL, 14 not-run**, `2026-10-05T03-28-33Z-e2e-c087.log`. Chromium не запустился. Проблема среды остаётся неустранённой; этот повтор не доказывает исправность navigation suite.

Итог на синхронизированной версии: typecheck/lint и 58 migrations PASS, real Beauty API UI 10/10 PASS; full integration RED из-за двух подтверждённых upstream bar дефектов; свежий full unit и дополнительный navigation browser не GREEN. До merge требуются исправление bar invariants и успешные полные проверки в стабильной среде. Более ранние 40/40 UI и 4/4 onboarding сохраняются как историческое доказательство до sync.

Локальные синтетические организации `MV5-browser-*`: 0 после cleanup. Production не затрагивался. MV6 не начат. STOP.

## Регрессия после BAR-FIX, 05.10.2026

BAR-FIX [#244](https://github.com/GAIVER007/wetop.ai/pull/244) влит отдельно: `b07a182293f5b054b6e8aec28090ffc549ee3460`. Новая forward migration 53 и десять записей RLS registry; исходная bar migration не переписана. Red 2 failures -> focused green 8/8, full integration 348/9 existing skips, typecheck/lint, все 59 migrations/drift/down PASS. [Отчёт BAR-FIX](../bar-fix-2026-10-05/README.md).

MV5 synced head: `f22328623bcef68838b857c90b151396e1ee795e`. Конфликт только в добавленных ADR, сохранены обе записи. Diff MV5 относительно main по apps/api, packages, DATA_MODEL пуст.

Среда: Node 24.15.0 из /usr/local/bin соответствует .nvmrc (24); прежний default shell использовал Node 26.9.0. Это выявленное расхождение, не доказательство причины всех старых таймаутов. Full unit запускается отдельно от браузера, maxWorkers=2 по TESTING.md, без увеличения timeout. Локальная БД изолирована на 55753; idle sleep предотвращается только на время команд. Assertions и skip-аннотации не изменены.

Первый полный unit на Node 24: 3362 PASS, 2 FAIL, 4 existing skips (`2026-10-05T05-32-20Z-unit-5863.log`). Два падения в прежних shell scripts: `top_rel` и `day` рядом с символом `»` распознаются Bash как другое имя переменной при LC_ALL=C.UTF-8. Минимальный reproduction без проекта: `/bin/bash -c 'set -u; day=bad; printf "%s\n" "$day»"'` возвращает exit 127 (unbound variable) с C.UTF-8 и exit 0 (`bad»`) с C. Настройка процесса LC_ALL=C исправляет среду; исходные shell scripts в MV5 не меняются. Повторяется полный набор, а не только эти два теста.

- Full unit **PASS: 3364 passed, 4 existing skips**, `tests/runs/logs/2026-10-05T05-35-56Z-unit-955c.log`. Полный набор на неизменном synced head, Node 24, LC_ALL=C, maxWorkers=2, стандартные timeout. Focused retry не используется как замена full suite.

- Real Beauty API browser **10/10 PASS**, `tests/runs/logs/2026-10-05T05-39-22Z-e2e-590d.log`, Node 24 и LC_ALL=C. Все 24 снимка пересозданы; mobile dark calendar визуально перепроверен.

- Synced head migration validation **PASS: 59 migrations, no schema drift, all down checks**, [log](bar-fix-head-migrations.log).

- Full affected UI/navigation browser **40/40 PASS**, `tests/runs/logs/2026-10-05T05-41-11Z-e2e-215a.log`. Beauty branch/catalog/schedule/journal, Hospitality branch switching/loading. Это полный выбранный набор, без retries и skips.

- Full onboarding browser **4/4 PASS**, `tests/runs/logs/2026-10-05T05-46-40Z-e2e-a9ed.log`. BEAUTY, FOOD_SERVICE, READ_ONLY и Hospitality persistence.

- Full integration **348 PASS, 9 existing skips**, `tests/runs/logs/2026-10-05T05-47-38Z-integration-6d9e.log`.
- Full typecheck **PASS**, `tests/runs/logs/2026-10-05T05-47-38Z-typecheck-3719.log`.
- Full lint **PASS**, `tests/runs/logs/2026-10-05T05-47-38Z-lint-f7b3.log`.

Все перечисленные финальные recorded runs: commit f2232862, codeChangedDuringRun=false, flaky=0. После них меняются только отчёт, снимки и журнал доказательств. Сгенерированный next-env.d.ts и перезаписанные снимки прежних этапов возвращены к HEAD. Финальный code tree совпадает с проверенным.

Полный GREEN снимает прежний merge STOP по прямому разрешению владельца от 05.10.2026. Production/release не обновляются, migration rollout остаётся отдельным, MV6 не начинается.
