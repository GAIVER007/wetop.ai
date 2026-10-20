# Дневная динамика owner-home, 16.10.2026

## Результат
- Дневные суммы в current.revenue.daily, receipts.daily, paidExpenses.daily из уже выбранных canonical rows, без запросов на каждый день и без изменения финансовых writers/схемы.
- Период и timezone проверенного location передаются сервером. Hotel charge serviceDate остаётся DATE; оплаты и расходы используют timestamp. Дедупликация sourceType:sourceId, отдельные валюты и BigInt суммы.
- Салонные поступления UNAVAILABLE; неизвестная валюта гостиничных cash остаётся PARTIAL с количеством источников. Документы не заменяют кассовые суммы.
- Серверный SVG общей lineGeometry вместо заглушки, точные суммы в таблице и итогах, относительная шкала для больших чисел. Нативный переключатель валют details, сегодня одна реальная дневная точка, не выдуманные часы. Загрузка не смешана с денежной шкалой.
- APP_UNIFIED_OWNER_HOME и production не включались. Категории не менялись, прежний интеграционный тест классификации не повторялся.

## Доказательства
- До начала просмотрен зелёный full typecheck 2026-10-16T09-40-14Z-typecheck-31d9 и test:status.
- RED projection: 2026-10-16T09-44-04Z-unit-4c19, отсутствующий модуль daily.
- RED SSR: 2026-10-16T09-45-45Z-unit-b203, отсутствующий компонент графика; доменные тесты уже зелёные.
- GREEN: 2026-10-16T09-48-01Z-unit-cf52, 22/22, проекция, SSR, изменённые адаптеры, service и существующая главная. Fixtures адаптеров дополнены реальными полями дат, которые теперь выбирает запрос.
- Собственная PostgreSQL, только owner_home_test@127.0.0.1:55516/wetop_owner_home, pms_test: 2026-10-16T09-47-55Z-integration-a7ba, 1 новый тест service→summary, три периода today/week/calendar MTD; 5 прежних тестов пропущены. Дневные суммы сверены с current по каждой валюте.
- Первый integration RED не доказывает функциональный дефект: 2026-10-16T09-45-07Z-integration-cfb8, ECONNREFUSED. Обнаружен существующий PGDATA по socket lock; собственный postgres запущен на прежнем 127.0.0.1:55516 без reset, установки, миграций или изменения .env. pg_isready подтвердил готовность. Временной лимит не позволил отдельный успешный функциональный RED integration до реализации.
- gbrain callers/blast для изменённых readOwnerMoney, OwnerSummaryService.report, OwnerSummaryView вернули not_built/not_found; выполнен fallback поиска ссылок по исходникам.

## Честные границы
- Не проводились браузерные скриншоты/axe/desktop-mobile визуальная приёмка или production build.
- Новый реальный integration покрывает FOOD_SERVICE revenue/receipts и периоды. Денежные расходы подключены к тем же кассовым rows, но дополнительная real-DB проверка непустого expense daily и непустого hotel charge daily остаётся задачей следующего узкого тестового среза.
- Сравнение с прошлым периодом не добавлено. Исторические валюты, coverage и payment ledger салона не придуманы. Полная release acceptance не заявляется.

### Открытый reader-gap гостиничной валюты (release audit)
Прочитан read-only аудит /srv/hermes/cache/delegation/subagent-summary-0-20261016_094905_971689.txt. Held SQL уже содержит cash.currency_snapshot, часть supplier writers его заполняет, но текущий Prisma owner reader выбирает только amount и присваивает currency=null. Поэтому daily честно повторяет текущее неполное KPI, однако теряет даже доказанные новые snapshot currencies. Это незакрытый reader-rollout дефект, не утверждение отсутствия валюты в самой БД. В bounded daily slice схема/финансовые writers/rollout не расширялись; до приёмки нужен отдельный безопасный snapshot reader и непустые гостиничные integration fixtures. Не брать Property.currency и не заполнять старые валюты догадками.

## Финальная проверка типов
2026-10-16T09-49-55Z-typecheck-1f0f: полный root + API + web GREEN, код не менялся во время прогона. Предыдущий 09-48-12Z-typecheck-a2ab выявил nullable serviceDate Prisma; исправлено non-null assertion после SQL-фильтра serviceDate gte/lte, который исключает NULL. Последний smoke 2026-10-16T09-50-10Z-unit-0996: 7/7 GREEN.
