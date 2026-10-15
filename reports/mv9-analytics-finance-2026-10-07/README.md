# MV9: отдельная аналитика Beauty и Food

Дата: 07.10.2026. Исходная база: main `c7e63d76a2687fdec387d89b1c718c3387a009e3` (MV8, PR #259). Перед финальной проверкой ветка перебазирована на main `012c06d8` (включая MKT4 и планы MV8.5). Код реализации после rebase: `42fec3d7`.
Ветка: `codex/mv9-analytics-finance-20261007`. План: `plans/mv9-analytics-finance-2026-10-07.md`, подтверждён владельцем сообщением «да».

## Результат

`/management/analytics` выбирает направление из доверенного `/auth/me`. Beauty и Food получают собственные отчёты по локальным датам начала записей и текущим статусам. Гостиничный обзор, загрузка, номера и каналы сохраняют прежние расчёты. Гостиничные подстраницы закрыты для других направлений до запросов гостиничных данных.

В меню Beauty/Food добавлена аналитика. Переключение филиала сохраняет общий маршрут аналитики, сбрасывает прежние параметры периода и сразу скрывает старые результаты. Повторное чтение после reload использует выбранный Business/Location.

Сводка организации разделяет салоны, рестораны и гостиницы. Каждый филиал сохраняет свой timezone и валюту. Частичный отказ источника отмечается у соответствующего филиала, без подстановки нулей. Общего денежного итога, конвертации, ADR/RevPAR для других направлений нет.

## Source map

| Показатель | Реализованный источник | Период и формула | Доступ |
|---|---|---|---|
| Beauty: BOOKED, CONFIRMED, DONE, NO_SHOW, CANCELLED | `GET /beauty/appointments?date=DATE`, `appointments.id/status/startsAt` | Число уникальных записей каждого статуса, локальная дата начала включена в `[from, to]` | Серверная проверка `reports`, затем действующая проверка API по Organization/Business/Location |
| Beauty: выручка | Тот же API, снимки `priceMinor`, `currency` | Сумма integer minor units записей DONE, через BigInt; валюты отдельно. DATA_MODEL §21.5, Q252, ADR-143 | Те же проверки; нет подмены актуальной ценой каталога |
| Food: BOOKED, CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW | `GET /food-service/reservations?date=DATE&limit=100&cursor=...` | Все страницы, затем отбор по локальной дате `startsAt`. Пересекающая день бронь предыдущих суток не включается повторно. Уникальные id и известные статусы обязательны | Те же проверки `reports` и действующего API |
| Food: финансы | Источника в согласованном срезе нет | Явное «Финансовый учёт ресторана не подключён» | Без фиктивного нуля |
| Hospitality: загрузка и выручка в сводке | Действующий `branchesApi.overview(from, to)` | Действующий гостиничный контракт и формулы, отдельная группа | Действующая проверка гостиничного отчёта |

Для Beauty проверяются дата ответа, locationId, timezone и локальная дата каждой записи. Для Food проверяется locationId каждой строки. Повторы на страницах Food дочитываются через действующий completeFoodList и не увеличивают результат. Повтор между днями, некорректный ответ, неизвестный статус или некорректный снимок денег приводит к видимой ошибке отчёта.

Адаптер вызывает только два фиксированных GET endpoints. Заголовок scope строится из серверного списка доступных филиалов, при сохранении сессии и `no-store`. Клиент не задаёт произвольный endpoint или доверенный scope. Schema, migrations, финансовый домен и внешние API не изменены.

## Ограничения

- Максимум 31 день включительно: техническое ограничение количества существующих дневных запросов. Дни и филиалы читаются последовательно, без параллельной нагрузки на пул БД.
- Это текущие статусы записей с началом за выбранный период, не исторический снимок статуса на прошлую дату.
- Beauty показывает утверждённую выручку по DONE, не фактические полученные оплаты. Касса B7 не добавлена.
- Проценты неявок и повторных посещений не рассчитываются. Продуктовые вопросы Q277/Q278 требуют знаменателя, окна истории и границ scope.
- Food POS, депозиты, фискализация, eQonaq, Channex и production submissions вне scope.

## Среда проверки

Отдельное дерево `/Users/urijzapojnov/wetop-mv8-20261007`, собственный PostgreSQL 16 на loopback :55793, браузерная база `mv9_local`, отдельная исходно чистая integration-база `mv9_integration`, timezone UTC. Все тестовые данные синтетические. Shared Supabase и чужие процессы не используются. Проверки запускаются через `npm run test:record -- ...`; журнал и полные логи сохранены в `tests/runs/`.

## RED перед GREEN

- Периодные агрегаты: `07-30-25Z-unit-d9b5` RED, `07-31-24Z-unit-32b7` GREEN.
- Загрузчик и меню: `07-32-04Z-unit-a613` RED, `07-33-56Z-unit-5a42` GREEN.
- Сохранение маршрута при переключении: `07-43-35Z-unit-c865` RED, `07-44-10Z-unit-34e0` GREEN.
- Отрицательный денежный вывод и чужой Food location: `07-47-28Z-unit-de3d` RED, итоговый полный unit GREEN.
- Браузерный MV9 на исходной гостиничной странице: `07-44-56Z-e2e-27a4` RED. После восстановления реализации новые 11 сценариев прошли, включая UI/API/SQL reconciliation.

Идентификаторы выше относятся к файлам `tests/runs/logs/2026-10-07T<id>.log`.

## Проверки и reconciliation

Проверки обновлённой ветки на main `012c06d8`:

| Набор | Результат | Лог в tests/runs/logs/ |
|---|---|---|
| Реальный API, БД и браузер: MV9 + branches + MV8 Today | 37/37 passed | `2026-10-07T09-29-00Z-e2e-13fd.log` |
| Усиленная точная сверка UI/API/SQL денег Beauty | 1/1 passed | `2026-10-07T09-31-33Z-e2e-ea44.log` |
| Гостиничные analytics/navigation/branches | 40 passed, один ENOSPC при записи trace; этот сценарий затем 1/1 passed | `2026-10-07T09-31-58Z-e2e-844a.log`, `2026-10-07T09-37-28Z-e2e-34bc.log` |
| Beauty: реальные операции и UI | 10/10 passed | `2026-10-07T09-38-06Z-e2e-106e.log` |
| Food: реальные операции и UI | 13/13 passed | `2026-10-07T09-39-32Z-e2e-c319.log` |

Общие проверки обновлённой ветки:

| Набор | Результат | Лог |
|---|---|---|
| Полный unit | 3731 passed, 4 штатных skipped | `tests/runs/logs/2026-10-07T09-41-32Z-unit-2faf.log` |
| Полный integration | 813 passed, 16 штатных skipped | `tests/runs/logs/2026-10-07T09-45-28Z-integration-a6e0.log` |
| Typecheck: корень, API, web | Все три passed | `tests/runs/logs/2026-10-07T09-47-48Z-typecheck-2147.log` |
| Lint | Passed | `tests/runs/logs/2026-10-07T09-47-48Z-lint-a84e.log` |
| Production build apps/web | Passed, Next 16.3.6 | `reports/mv9-analytics-finance-2026-10-07/web-build.log` |

Пропуски существовали до MV9: unit offsite/server bootstrap gates; integration public-schema introspection и backup/restore/wizard environment gates. Новых skip нет. Сборка выполнена локально, выкладка не выполнялась.

Новый браузерный набор `tests/branches-ui/analytics.spec.ts` независимо считает Beauty/Food статусы через Prisma groupBy, сравнивает с полным API и видимыми карточками, затем проверяет reload. Food fixture содержит 105 записей на двух страницах (53 BOOKED, 52 CONFIRMED), текущие SEATED/COMPLETED и бронь через полночь. Проверяются смешанная организация, частичный отказ Food API, read-only и STAFF, смена направления, невозможность открытия гостиничной вкладки другой вертикалью.

Восемь снимков в `screenshots/`: Beauty/Food, 1440/390, светлая/тёмная темы. Проверяются axe, клавиатура и отсутствие горизонтального overflow.

Гостиничный UI использует существующие specs и synthetic loopback API, не является доказательством реальной БД. Копия точного временного конфига: `hospitality-playwright-config.txt`. Он повторяет timeout/expect/browser стандартного UI-стенда, задаёт отдельные свободные порты :55933/:55934; сервер маркетингового сайта не нужен выбранным спекам. При повторении заменить пути checkout на локальные и сохранить конфиг как `.mts`. Реальные UI/API/SQL числа доказаны отдельным branches-ui набором.

## Промежуточные сбои, сохранённые в журнале

Первый integration обнаружил неверный timezone собственного локального PostgreSQL (Asia/Dubai) и таймаут на нагруженной машине. Настройка собственной базы исправлена на UTC, финансовый тест повторно прошёл. Продуктовый финансовый код не менялся.

Первый полный unit выявил новые подписи с запрещённой средней точкой, они исправлены. Остальные сбои сопровождались конкурирующей нагрузкой и несовместимостью Unicode-идентификатора старого bash-скрипта с locale. Полный повтор с LC_ALL=C и двумя workers прошёл: 3518 passed, 4 штатных skipped. Assertions и quality gates не ослаблялись.

Старый тест переключения гостиниц открывал обучение поверх выбора филиала. В этой спеке применена уже принятая в MV8 изоляция обучения; отдельная проверка автоматического открытия обучения осталась включена. Дополнительно проверяется реальный выбранный филиал и его экран, поскольку общий URL `/today` не доказывает завершение переключения.

Прогон `08-06-36Z-e2e-4463` дал 33/37, включая все 11 MV9; зафиксированы таймаут базы и запуска Chromium, длительность более часа. Ошибки не объявлены успешными: предусмотрен последовательный повтор без других проверок.

Прогон `09-22-29Z-integration-a38d` дал 790 passed / 1 failed / 16 skipped. Проверка Platform P1 backfill встретила ARCHIVED филиал, оставшийся после браузерного сценария в той же тестовой схеме. Следующий полный integration запущен в новой отдельной локальной базе, где тот же тест прошёл без изменения assertions.

Гостиничный UI-прогон `09-31-58Z-e2e-844a`: 40 passed / 1 failed. Последняя dark navigation проверка завершилась ENOSPC при сохранении trace, Next также сообщил ENOSPC в своём кэше. Удалены только сгенерированные dev/cache этого рабочего дерева (около 1.3 GiB), ни чужие процессы, ни исходники не затронуты. Тот же сценарий прошёл 1/1 в `09-37-28Z-e2e-34bc`.

## Review и границы доставки

Проверены scope headers, `reports` permission до получения данных, дата начала и полная pagination, integer money и валюты, отсутствие общего hotel-only KPI, ошибки без фиктивных нулей, bounded request fan-out. Архитектура записана в ADR-MV9-REPORTS.

Доставка этого среза: commit/push и отдельный PR, затем STOP. Merge, production/release, MV10 и MV11 не выполняются.

## Команды итоговой проверки

В собственной копии репозитория, PATH включает `/usr/local/bin` и CommandLineTools. URL ниже относится только к localhost без внешних учётных данных. Для своего запуска заменить локальные порт и имя базы.

```sh
LC_ALL=C npm run test:record -- unit --maxWorkers=2 --testTimeout=15000
DATABASE_URL=postgresql://postgres@127.0.0.1:55793/mv9_integration TEST_DATA=seed DATABASE_POOL_MAX=2 LC_ALL=C npm run test:record -- integration --testTimeout=15000
DATABASE_URL=postgresql://postgres@127.0.0.1:55793/mv9_local DATABASE_POOL_MAX=2 BRANCHES_UI_WEB_PORT=55963 BRANCHES_UI_API_PORT=55964 LC_ALL=C npm run test:record -- e2e --config tests/branches-ui/playwright.config.ts --workers=1
DATABASE_URL=postgresql://postgres@127.0.0.1:55793/mv9_local DATABASE_POOL_MAX=2 BEAUTY_UI_WEB_PORT=55913 BEAUTY_UI_API_PORT=55914 LC_ALL=C npm run test:record -- e2e --config tests/beauty-ui/playwright.config.ts --workers=1
DATABASE_URL=postgresql://postgres@127.0.0.1:55793/mv9_local DATABASE_POOL_MAX=2 LC_ALL=C npm run test:record -- e2e --config tests/food-ui/playwright.config.ts --workers=1
UI_FIXTURE_API=http://127.0.0.1:55934 FIXTURE_PORT=55934 LC_ALL=C npm run test:record -- e2e --config /tmp/wetop-mv9-ui.config.mts analytics-v2.spec.ts analytics-occupancy.spec.ts analytics-units.spec.ts analytics-channels.spec.ts analytics-design.spec.ts navigation.spec.ts branches.spec.ts --workers=1
LC_ALL=C npm run test:record -- typecheck
LC_ALL=C npm run test:record -- lint
LC_ALL=C APP_API_URL=http://127.0.0.1:55964 npm run build -w apps/web
```

Перед запуском проверить свободные loopback порты; integration и e2e запускать последовательно. Общий Supabase не использовать. Для branches-ui после полного прогона дополнительно повторён усиленный Beauty reconciliation сценарий; точная команда есть в логе.
