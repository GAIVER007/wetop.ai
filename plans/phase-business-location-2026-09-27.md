# План фазы Business + Location (27.09.2026) — ЖДЁТ ПОДТВЕРЖДЕНИЯ ВЛАДЕЛЬЦА

> Следующая schema-фаза по замороженной архитектуре (`ARCHITECTURE.md`, ADR-104; `DATA_MODEL.md` v2.0
> §18; freeze-сводка второй линии — `ARCHITECTURE.md` ветки `claude/hopeful-thompson-2v8v8a`, ADR-100
> той линии: та же иерархия). Порядок — прямое указание владельца 27.09.2026: **Business + Location
> вместе одной additive-фазой → backfill Luxx → `Property.location_id` → проверка в ноль**; отдельной
> фазы «сначала Location, потом Business» нет — `locations.business_id NOT NULL` (§18.2), organizationId
> на Location отвергнут (§18.3). **Миграция не пишется и не применяется до подтверждения этого плана
> владельцем.** Предпосылка: Phase 1 изоляции закрыта и применена на рабочей базе
> (`20260927000026_phase1_tenant_scope`); RLS-миграции в `main` (ADR-103).

## 1. Что появляется (схема — additive, ничего не удаляется и не переименовывается)

Одна миграция (имя по конвенции даты, номер после последней в `main`):

1. Таблица `businesses` — по `DATA_MODEL.md` §18.1: `id`, `organization_id NOT NULL → organizations`,
   `name`, `vertical` (enum `BusinessVertical`: `HOSPITALITY`, `BEAUTY`), `status` (enum
   `BusinessStatus`: `ACTIVE`, `ARCHIVED`), `created_at`, `updated_at`; индекс по `organization_id`.
2. Таблица `locations` — §18.2: `id`, `business_id NOT NULL → businesses`, `name`, `address`,
   `phone`, `email`, `timezone NOT NULL`, `currency NOT NULL`, `status` (enum `LocationStatus`),
   `created_at`, `updated_at`; индекс по `business_id`. Без `organization_id` (§18.3).
3. `properties.location_id uuid NULL → locations` + индекс. `Property` не переименовывается,
   `properties.organization_id` остаётся (замок ADR-061 работает без правки кода).
4. `organizations.reporting_currency varchar(3) NOT NULL DEFAULT 'KZT'` (freeze-решение №3: валюта
   отчётности — у организации; сами курсы/`ExchangeRate` — не в этой фазе).

RLS: на новые таблицы — те же политики по организации, что ставил ADR-103 (у `businesses` —
`organization_id` прямо, у `locations` — через `business_id`), тем же приёмом `TO wetop_app` без
`FORCE`. Если удобнее отдельной миграцией следом — решается при написании, содержание то же.

## 2. Backfill (данными, внутри той же миграции)

Для каждой организации, у которой есть объект (`properties.organization_id`):
- один `Business`: `name` = название объекта, `vertical = HOSPITALITY`, `status = ACTIVE`;
- один `Location` на каждый её объект: `name`, `address`, `phone`, `email`, `timezone`, `currency` —
  из записи `Property`;
- `properties.location_id` проставляется.

Для Luxx конкретно: Business «Luxx Aparts» (HOSPITALITY) → Location «Luxx Aparts Almaty» →
существующая строка Property. Организации без объекта не получают ничего (их цепочку создаст
онбординг). Объект с `organization_id IS NULL` («ничей») остаётся с `location_id IS NULL` — счётчик
таких строк печатается отчётом, как в phase1 (`scripts/ops/phase1-scope-report.sql` — образец).

`NOT NULL` на `properties.location_id` — **отдельной** миграцией после проверки backfill, не в этой.

## 3. Что меняется в backend

Ничего. Ни один репозиторий, резолвер (`property-ref.ts`) и экран не правится: колонка nullable,
код её пока не читает. Перевод замка и служебных путей на цепочку Location → Business — следующая
фаза (контекст, `ARCHITECTURE.md` §6), своим планом.

## 4. Какие FK не меняются

Все существующие: `Reservation`, `ReservationItem`, `Allocation`, `InventoryUnit`,
`AccommodationType`, `RatePlan`, `DailyRate`, `ChannelMapping`, `Folio`/`Payment`, `TrackedSite`,
phase1-колонки (`guests`/`audit_logs`/`external_events`/`channel_outbox`) — ссылаются куда ссылались.
Ни один существующий ID не меняется.

## 5. Риски и откат

- Живая база: применяет владелец — бэкап → миграция → проверка → откат (AGENTS.md §14–§15).
- Тёзки объектов: имя не уникально — backfill идёт по строкам `properties`, не по именам.
- Пересечение с RLS: миграция обязана идти **после** RLS-миграций `main` (история миграций общая);
  политики новых таблиц — в том же стиле.
- `down.sql`: снять политики новых таблиц, колонку `properties.location_id`,
  `organizations.reporting_currency`, таблицы `locations`, `businesses` (в этом порядке). Hospitality
  не затронут.

## 6. Проверка в ноль (доказательства)

1. Число строк всех существующих таблиц до/после равно; единственный UPDATE — `properties.location_id`.
2. Четыре сверки заново в ноль: фонд **88/88**, двойной ввод суток (`day self-check RESULT OK`),
   цены **8 640**, балансы **1 449/1 449** — через `npm run test:record` (TESTING.md).
3. Связность: у каждого Property с организацией есть Location; у каждого Location — Business;
   `businesses.organization_id` = `properties.organization_id` его объекта; запрос — в отчёт фазы.
4. `check-migrations.sh` на чистом PostgreSQL 16: apply → diff-паритет схемы → откат к идентичному
   снимку.
5. Изоляция: `tests/integration/organization-isolation.test.ts` расширяется — сосед не видит Business
   и Location чужой организации (красный до правки политик/выборок, зелёный после).

## 7. Что фаза НЕ делает

Не трогает Beauty-таблицы (§19 — своим планом после этой фазы), RequestActor/scope, экраны, онбординг,
`ExchangeRate`, `CustomerBusiness`, активацию расширений; не снимает `properties.organization_id`;
не ставит NOT NULL на `location_id`.
