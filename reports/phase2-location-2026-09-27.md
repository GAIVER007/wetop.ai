# Phase 2 — Location foundation (ADR-100 §17.1), 27.09.2026

Поручение владельца 27.09.2026: «Начинай Phase 2 — Location foundation. Строго по замороженной ADR-100».
Содержание фазы — v1 §D.3/§L Фаза 2 и v2 §12 (`reports/hospitality-beauty-target-architecture{,-v2}-2026-09-27.md`);
спецификация таблиц утверждённым порядком §17 — `DATA_MODEL.md` §17.6 (v2.2).

## 1. Что сделано

- **Схема** (`packages/database/prisma/schema.prisma`): enum `LocationVertical` (`HOSPITALITY`|`BEAUTY`);
  модель `Location` (`organization_id` NOT NULL FK, `vertical` — неизменяемая денормализованная копия,
  `name`, `address?`, `phone?`, `email?`, `timezone`, `currency CHAR(3)`, `created_at`; индекс по организации);
  `Property.location_id` — nullable UNIQUE FK (1:1, ON DELETE RESTRICT). `Property` не переименована,
  ни один её существующий FK не тронут; hotel-enum'ы не расширялись.
- **Миграция `20260927000029_phase2_location`** (+ `down.sql`): тип, таблица, колонка;
  **детерминированный backfill в той же транзакции** — каждой строке `properties` без `location_id`
  создаётся ровно одна `Location` копией полей точки бизнеса (v1 §D.3), связка через CTE с заранее
  вычисленными id (по имени не сопоставляем — имя не уникально). Для Luxx — одна строка. NOT NULL не вводится.
- **RLS (ADR-103)**: `locations` — арендаторская таблица: политика `rls_tenant` по `organization_id`
  в миграции, имя добавлено в `RLS_TENANT_TABLES` (`packages/database/src/rls.ts`) — сторож
  `rls-isolation.test.ts` «новая таблица не проскочит» её видит.
- **Код**: новый `apps/api/src/database/location-ref.ts` — кэш-резолвер Location организации по образцу
  `property-ref.ts` (ключ — организация+схема, отказ не запоминается). `organizationPropertyRef()`
  (`property-ref.ts`) идёт к объекту **через Location** (v1 §D.4 шаг 2) с фолбэком на прежний путь по
  `properties.organization_id`, пока миграция не применена; внешний контракт `PropertyRef` не менялся —
  ни один из ~20 репозиториев не тронут.
- **Business НЕ добавлен** — Phase 2.5 (отдельная команда владельца). Поведение Luxx не менялось:
  UI/маршруты/навигация/онбординг без правок.

## 2. Доказательства (журнал tests/runs/JOURNAL.md, логи в коммите)

| Набор | Красный (до Phase 2) | Зелёный (код+миграция Phase 2) |
|---|---|---|
| unit (location-ref) | `…15-29-08Z-unit-8793.log` (модуля нет) | ✅ 2115/2118 `…15-36-08Z-unit-105e.log` |
| integration (backfill+путь через Location) | `…15-39-02Z-integration-2ffb.log` (база без 029: 27 красных, включая оба новых) | ✅ **111/111** `…15-41-25Z-integration-efae.log` |
| typecheck / lint | — | ✅ `…15-33-57Z-typecheck-fb84.log`, `…15-34-24Z-lint-0e9c.log` |
| e2e (изолированный стенд, миграции включая 029) | — | ✅ **25/25** `…15-42-08Z-e2e-123b.log` |
| `scripts/ops/check-migrations.sh` (чистый PG16) | — | **RESULT: OK** — вся цепочка …026→…029, diff-паритет, откаты снимок-в-снимок |

Прозрачность для Hospitality: весь прежний набор зелёный; в `property-ref.test.ts` правки только у подделки
базы (она выучила форму запроса `where.location`) и у счётчика рейсов — поведение вошедшего не менялось,
что и доказывают integration/e2e без единой правки.

## 3. Инструкция владельцу — применение на рабочей базе (сам НЕ применяю)

```
0) Mac, папка WETOP, ветка с Phase 2 (или main после влития PR #98): git pull; npm ci --no-audit --no-fund
1) BACKUP: штатный бэкап Supabase (Dashboard → Database → Backups), убедиться в свежем.
2) MIGRATE DEPLOY: npm run migrate:deploy -w packages/database
   Ожидаемо: применяются 20260927000027_tenant_columns, 20260927000028_rls_policies (из main, ADR-103)
   и 20260927000029_phase2_location (Phase 2). Все три утверждены; 027 идемпотентна к уже применённой 026.
3) Деплой кода — обычным порядком (build web, kickstart api/web по docs/deploy.md §1).
4) VERIFICATION (SQL Editor):
   SELECT count(*) AS locations FROM locations;                                  -- ожидание: 1
   SELECT count(*) FILTER (WHERE location_id IS NULL) AS without_location,
          count(*) AS properties FROM properties;                                -- ожидание: 0 / 1
   SELECT name, vertical, timezone, currency FROM locations;                     -- Luxx, HOSPITALITY, Asia/Almaty, KZT
   b. Стойка глазами: /today, /guests, /journal, /channels — как до миграции.
   c. ОБЯЗАТЕЛЬНО — фактическая сверка Luxx (CLAUDE.md §6), снятая ПОСЛЕ migrate deploy:
      npx tsx scripts/reconciliation/src/cli-inventory.ts        -- фонд 88/88, расхождение 0
      APP_API_URL=http://127.0.0.1:3001 npm run reconcile:selfcheck   -- сутки в ноль
      «Миграция таблиц броней и денег не касается» — обоснование риска, не замена сверки.
5) ROLLBACK: откатить код; при необходимости снять схему —
   psql -f packages/database/prisma/migrations/20260927000029_phase2_location/down.sql
   и DELETE FROM _prisma_migrations WHERE migration_name='20260927000029_phase2_location';
   крайний случай — restore из бэкапа шага 1.
```

## 4. Риски

- Низкий (по замороженному плану): чисто аддитивно, ни одна Reservation/Payment/InventoryUnit/RatePlan/
  ChannelMapping не меняет id и содержимое; `properties.organization_id` остаётся рабочим (окно
  совместимости до Фазы 8); старый код с новыми таблицами совместим (колонки nullable, таблицу он не читает).
- Резолвер до применения миграции делает один дополнительный пустой рейс (путь через Location) на организацию
  на процесс — единожды, ответ кэшируется; после применения рейс снова один.
- RLS-политика `locations` активна только для роли `wetop_app` (на проде вход у неё выключен до этапа
  `DATABASE_APP_URL` — docs/ops/rls.md), поведение текущих подключений не меняется.

## 5. Стоп

Phase 2 останавливается здесь (поручение: «После завершения Phase 2 остановиться и принести отчёт перед
Phase 2.5»). Phase 2.5 (Business, `locations.business_id`) — только по отдельной команде владельца.

## 6. Дополнение поздним вечером 27.09 — Q-199 (столкновение с линией ADR-104)

После завершения Phase 2 в `main` влит PR #99: архитектура v3 (ADR-104) и план
`plans/phase-business-location-2026-09-27.md`, чья спецификация `locations` расходится с этой фазой
(без organization_id и vertical, с business_id NOT NULL, Business+Location одной фазой). Развилка
записана как **Q-199**. **Q-199 закрыт владельцем тем же вечером — вариант Б (строго ADR-104/v3)**:
эта фаза ОТМЕНЕНА до применения куда-либо, миграция `20260927000029_phase2_location` удалена из ветки;
инструкция §3 выше НЕ действует. Действующая реализация — **Platform P1 — Business + Location foundation**:
`reports/platform-p1-business-location-2026-09-27.md`, миграция `20260927000030_platform_p1_business_location`.
Отчёт сохранён как история линии ADR-100.
