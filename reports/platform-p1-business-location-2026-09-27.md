# Platform P1 — Business + Location foundation (ADR-104, Q-199 вариант Б), 27.09.2026

Решение владельца 27.09.2026 (вечер): «Q-199 → выбираем ADR-104 / архитектуру v3… Business + Location
создаём вместе одной additive-фазой», имя фазы — Platform P1 (нумерация Phase 2/2.5 отменена; Phase 1
tenant isolation остаётся security-фазой). Основание: `ARCHITECTURE.md` (v3), `DATA_MODEL.md` §18 (v2.0
линии ADR-104) + журнал v2.3, план `plans/phase-business-location-2026-09-27.md` (подтверждён этим решением).
Временная миграция `20260927000029_phase2_location` линии ADR-100 (`Location.organization_id`/`vertical`)
**удалена из ветки до применения куда-либо** — на production и в `main` её никогда не было.

## 1. Что сделано

- **Схема** (`schema.prisma`): enum'ы `BusinessVertical` (canonical vertical ТОЛЬКО здесь), `BusinessStatus`,
  `LocationStatus`; модель `Business` (§18.1: organization_id NOT NULL, name varchar(200), vertical, status,
  created/updated); модель `Location` (§18.2: **business_id NOT NULL**, БЕЗ organization_id (§18.3) и БЕЗ
  vertical, name/address/phone/email, timezone varchar(50), currency varchar(3), status, created/updated);
  `Property.location_id` — nullable UNIQUE FK (1:1, миграционное окно; §18.4);
  `Organization.reporting_currency` varchar(3) NOT NULL DEFAULT 'KZT' (§18.4).
  Hospitality-таблицы (Reservation/ReservationItem/Allocation/InventoryUnit/AccommodationType/RatePlan/
  DailyRate/ChannelMapping/Folio/Payment) **не тронуты**, ни один существующий ID не меняется.
- **Миграция `20260927000030_platform_p1_business_location`** (+ `down.sql`), backfill в той же транзакции:
  - организация с объектами → **один** `Business` (vertical `HOSPITALITY`, имя организации, ACTIVE);
  - по одной `Location` на каждый её объект — поля из `Property` (имя, адрес, контакты, пояс, валюта);
    связка `properties.location_id` через CTE с заранее вычисленными id (по имени не сопоставляем);
  - `reporting_currency` — из фактической валюты объектов организации, только где она **однозначна**
    (ровно одна различная); неоднозначное и организации без объектов остаются на DEFAULT 'KZT' —
    ложные валютные данные молча не создаются, остаток виден отчётом.
  - Для Luxx: Organization «Luxx Aparts» → Business «Luxx Aparts» (HOSPITALITY) → Location (имя объекта) →
    существующий Property; reporting_currency = KZT (фактическая).
- **RLS — сразу под финальную цепочку** (приём миграции …028): `businesses` — политика по `organization_id`;
  `locations` — через родителя-Business; обе в `RLS_TENANT_TABLES`. Проверяется **под ролью `wetop_app`**:
  обход всех арендаторских таблиц в `rls-isolation.test.ts` (чужой видит 0, своя видит свой Business и его
  филиал через цепочку — сид теста расширен).
- **Код**: `location-ref.ts` переписан под финальную связь (`LocationRef{id, businessId, vertical(с Business),
  name, timezone, currency}`, выборка `location.business.organizationId`, кэш и «отказ не запоминается» — как
  прежде); `organizationPropertyRef()` идёт по цепочке Organization → Business → Location → Property с
  фолбэком на `properties.organization_id`, пока миграция не применена; внешний контракт `PropertyRef` не
  менялся — репозитории не тронуты. Локальный сид (`seed-local.ts`) строит цепочку сам (сид идёт после
  миграций — иначе свежая тестовая база оставалась бы без неё).

## 2. Доказательства (журнал tests/runs/JOURNAL.md, логи в коммите)

| Проверка | Красный | Зелёный |
|---|---|---|
| integration: цепочка/backfill/резолвер (`platform-p1-backfill.test.ts`, 3 теста) + RLS под wetop_app | база без 030: 28/112 красных, `…15-58-48Z-integration-8c02.log` | ✅ **112/112** `…15-59-25Z…`, `…16-02-53Z…` и на полностью свежем сиде `…16-06-05Z-integration-af29.log` |
| unit (location-ref под финальную связь, property-ref цепочка) | — (красный фазы снят интеграционным) | ✅ 2115/2118 `…16-00-11Z-unit-2602.log` |
| typecheck / lint | — | ✅ `…15-57-33Z-typecheck-35ac.log` (и после правки сида), `…15-58-00Z-lint-599e.log` |
| e2e — полный Hospitality suite на стенде с миграцией 030 | — | ✅ **25/25** `…16-01-29Z-e2e-4627.log` |
| `check-migrations.sh` (чистый PG16): цепочка …026→…027→…028→**…030**, prisma diff-паритет, откаты снимок-в-снимок | — | **RESULT: OK** |

Прозрачность для Luxx: поведение стойки не менялось (полный suite и e2e зелёные без правок продуктового кода);
фолбэк резолвера сохраняет прежний путь до применения миграции.

## 3. Инструкция владельцу — применение на рабочей базе (сам НЕ применяю)

```
0) Mac, папка WETOP, ветка PR #98 (или main после влития): git pull; npm ci --no-audit --no-fund
1) BACKUP: штатный бэкап Supabase (Dashboard → Database → Backups), убедиться в свежем.
2) MIGRATE DEPLOY: npm run migrate:deploy -w packages/database
   Ожидаемо: применяются 20260927000027_tenant_columns, 20260927000028_rls_policies (ADR-103)
   и 20260927000030_platform_p1_business_location. Миграции 029 в списке быть НЕ должно.
3) Деплой кода — обычным порядком (npm run build -w apps/web; kickstart api/web — docs/deploy.md §1).
4) VERIFICATION:
   a. Отчёт backfill: scripts/ops/platform-p1-report.sql (SQL Editor — вставить целиком, это один запрос).
      Ожидание: businesses 1/1/1; locations 1/1; properties 1/1/0; broken_chain 0; reporting_currency 1/1/0.
   b. Стойка глазами: /today, /guests, /journal, /channels — как до миграции.
   c. ОБЯЗАТЕЛЬНО — фактическая сверка Luxx (CLAUDE.md §6), снятая ПОСЛЕ migrate deploy:
      npx tsx scripts/reconciliation/src/cli-inventory.ts            — фонд 88/88, расхождение 0
      APP_API_URL=http://127.0.0.1:3001 npm run reconcile:selfcheck  — сутки в ноль
5) ROLLBACK: откатить код; при необходимости снять схему —
   psql -f packages/database/prisma/migrations/20260927000030_platform_p1_business_location/down.sql
   и DELETE FROM _prisma_migrations WHERE migration_name='20260927000030_platform_p1_business_location';
   крайний случай — restore из бэкапа шага 1.
```

## 4. Риски

- Низкий: чисто additive; деньги/брони/фонд миграция не читает и не пишет (кроме чтения валют объектов
  для reporting_currency); старый код с новыми таблицами совместим.
- До применения миграции резолвер делает один дополнительный пустой рейс на организацию на процесс
  (путь по цепочке перед фолбэком); после применения рейс снова один.
- RLS-политики новых таблиц активны только для роли `wetop_app` (вход у неё на проде выключен до этапа
  `DATABASE_APP_URL` — docs/ops/rls.md); текущие подключения не задеты.
- `Property.location_id` NOT NULL — отдельной миграцией после проверки на проде (§18.4), не в этой фазе.

## 5. Стоп

PR готов — останавливаюсь и приношу отчёт на утверждение (поручение Q-199). Следующие шаги (NOT NULL на
`location_id`, RequestActor scope, онбординг с Business, этап А ТЗ Главной) — только по отдельной команде.
