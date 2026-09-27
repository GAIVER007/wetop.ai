# Platform P1 — фаза Business + Location (27.09.2026) — УТВЕРЖДЁН с уточнениями 27.09.2026

> Именование этапов — решение владельца 27.09.2026 (ADR-107): этот план = **Platform P1**;
> дальше **Platform P2** — RequestActor/scope (`plans/platform-p2-request-context-2026-09-27.md`,
> стартует только когда P1 в `main` и применён на рабочей базе с проверкой в ноль) и
> **Platform P3** — переключатель + онбординг + «Партнёры».

> Следующая schema-фаза по замороженной архитектуре (`ARCHITECTURE.md`, ADR-104 и раздел «Замороженные
> решения» — ADR-100-заморозка; `DATA_MODEL.md` v2.0 §18). Порядок — прямое указание владельца 27.09.2026:
> **Business + Location вместе одной additive-фазой → backfill → `Property.location_id` → проверка в ноль**;
> отдельной фазы «сначала Location, потом Business» нет — `locations.business_id NOT NULL` (§18.2),
> organizationId на Location отвергнут (§18.3).
>
> **Статус: план утверждён владельцем 27.09.2026** («После внесения этих уточнений план считаю утверждённым
> и можно писать Business + Location migration») — с восемью уточнениями консультанта, внесёнными в этот
> текст; они помечены «*(уточнение N)*». **Рабочую базу агент не трогает: после готового PR — отчёт и
> инструкция владельцу, применяет владелец** (AGENTS.md §14–§15).

## 0. Предпосылки — выполнены до написания миграции *(уточнения 1–2)*

1. **Phase 1 сведена с `main`.** Код штампов и чтений Phase 1 (ветка `claude/hopeful-thompson-2v8v8a`,
   PR #98) слит с текущим `main` (RLS ADR-103, trial ADR-102) в ветке этой фазы; файлы миграций
   `20260927000027_tenant_columns` оставлены байт в байт как в `main` — их применяет владелец. На слитом
   дереве: typecheck и lint чисто, integration **109/109** (в т.ч. изоляция Phase 1 7/7 и RLS), unit
   2108/2111 (3 пропуска — только macOS) — журнал `tests/runs/JOURNAL.md` 27.09. Новые `Guest`/`AuditLog`/
   `ExternalEvent`/`ChannelOutbox` продолжают получать tenant scope (это и проверяют изоляционные тесты).
   После влития этого PR `main` — единственный source of truth.
2. **Один канонический `ARCHITECTURE.md`.** Детальная v3 — каноническая; freeze-сводка второй линии
   встроена в неё разделом «Замороженные решения»; второго корневого файла больше нет.

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
4. `organizations.reporting_currency varchar(3)` — **NULL, без DEFAULT** *(уточнение 4)*: слепой
   `DEFAULT 'KZT'` создал бы ложные данные организации с объектом в другой валюте. Заполнение — только
   правилом backfill ниже; у новых партнёров валюту отчётности выберет онбординг/создание Business
   (фаза онбординга, не эта).

RLS: на новые таблицы — политики в этой же миграции (или отдельной следом — решается при написании,
содержание то же), тем же приёмом ADR-103 `TO wetop_app` без `FORCE`: у `businesses` —
по `organization_id = app_current_org()` прямо, у `locations` — через join к `businesses`.
Поведение join-политики под уже действующей политикой `businesses` проверяется тестом *(уточнение 6)* —
рекурсивных эффектов быть не должно: политика `locations` читает `businesses` от имени той же роли,
и видимые строки `businesses` уже отфильтрованы своей политикой (это и есть ожидаемое поведение).

## 2. Backfill (данными, внутри той же миграции) — строго по Organization *(уточнение 3)*

Правило:

```
Organization (у которой есть хотя бы один Property по properties.organization_id)
  → ровно ОДИН Business:  name = organizations.name (текущий бренд), vertical = HOSPITALITY, status = ACTIVE
    → N Location — по одному на каждый Property организации:
        name, address, phone, email, timezone, currency — из строки Property
  → properties.location_id проставляется
```

- Business создаётся **один на организацию**, сколько бы объектов у неё ни было; `Business.name` — имя
  организации, **не** имя объекта. `Location.name` = имя объекта.
- Никакой идентификации по совпадению названий: backfill идёт по строкам `properties` и FK
  `properties.organization_id`, имена — только как значения полей.
- `organizations.reporting_currency` *(уточнение 4)*: если у всех Property организации одна валюта —
  берётся она (для Luxx это даёт KZT); если валют несколько или у организации нет объектов — остаётся
  NULL и строка попадает в отчёт миграции (счётчик + список org id), ничего не угадывается.
- Организации без объекта не получают ничего (их цепочку создаст онбординг). Объект с
  `organization_id IS NULL` («ничей») остаётся с `location_id IS NULL` — счётчик таких строк печатается
  отчётом, как в phase1 (`scripts/ops/phase1-scope-report.sql` — образец).

**`NOT NULL` на `properties.location_id` в этой фазе не вводится и заранее не объявляется**
*(уточнение 5)*: перед любой будущей NOT NULL-миграцией — отдельный gate
`SELECT count(*) FROM properties WHERE location_id IS NULL;` — значение 0, либо по каждой оставшейся
строке явное решение владельца. Это отдельное будущее решение, не «автоматическая следующая миграция».

## 3. Что меняется в backend

Ничего. Ни один репозиторий, резолвер (`property-ref.ts`) и экран не правится: колонка nullable,
код её пока не читает. Перевод замка и служебных путей на цепочку Location → Business — следующая
фаза (контекст, `ARCHITECTURE.md` §6), своим планом. *(уточнение 7 — подтверждено владельцем:
`property-ref.ts` в этой фазе на Business/Location не переводится.)*

## 4. Какие FK не меняются

Все существующие: `Reservation`, `ReservationItem`, `Allocation`, `InventoryUnit`,
`AccommodationType`, `RatePlan`, `DailyRate`, `ChannelMapping`, `Folio`/`Payment`, `TrackedSite`,
phase1-колонки (`guests`/`audit_logs`/`external_events`/`channel_outbox`) — ссылаются куда ссылались.
Ни один существующий ID не меняется. Hotel-enum'ы не расширяются.

## 5. Риски и откат

- Живая база: **применяет только владелец** — бэкап → миграция → проверка → откат (AGENTS.md §14–§15);
  агент приносит отчёт и пошаговую инструкцию в PR.
- Тёзки объектов: имя не уникально — backfill идёт по строкам `properties`, не по именам.
- Пересечение с RLS: миграция идёт **после** RLS-миграций `main` (история миграций общая);
  политики новых таблиц — в том же стиле.
- `down.sql`: снять политики новых таблиц, колонку `properties.location_id`,
  `organizations.reporting_currency`, таблицы `locations`, `businesses` (в этом порядке). Hospitality
  не затронут.

## 6. Проверка в ноль (доказательства) *(уточнения 6 и 8)*

1. Число строк всех существующих таблиц до/после равно; единственные UPDATE —
   `properties.location_id` и `organizations.reporting_currency`.
2. Четыре сверки заново в ноль: фонд **88/88**, двойной ввод суток (`day self-check RESULT OK`),
   цены **8 640**, балансы **1 449/1 449** (если контрольный снимок доступен) — на рабочей базе их
   снимает владелец после применения; на локальном стенде — те же CLI до/после миграции.
3. Связность (запрос — в отчёт фазы): у каждой организации с объектами ровно **один** Business;
   у каждого Property с организацией есть Location; у каждого Location — Business;
   `businesses.organization_id` = `properties.organization_id` его объекта (для Luxx: ровно 1 Business,
   ровно 1 Location, существующий Property привязан к ней).
4. `check-migrations.sh` на чистом PostgreSQL 16: apply → diff-паритет схемы → откат к идентичному
   снимку (`down.sql` доказан).
5. Изоляция **на уровне БД под `wetop_app`**, не только application guard *(уточнение 6)*:
   расширение `tests/integration/rls-isolation.test.ts` / `organization-isolation.test.ts` —
   красное до политик, зелёное после:
   - организация A видит только свои `businesses`;
   - организация A видит только `locations` своих Business (join-политика);
   - организация B не получает строк A даже прямым SQL/Prisma-запросом под app-ролью;
   - `wetop_service` выполняет разрешённые служебные операции (видит все строки — по утверждённому
     RLS-плану ADR-103 службные пути ходят под `wetop_service` без политик);
   - поведение join-политики `locations` под действующей политикой `businesses` — без рекурсивных
     и неожиданных эффектов.
6. Поведение пользователя Luxx не меняется ничем наблюдаемым (экраны и API этой фазой не тронуты).

## 7. Что фаза НЕ делает

Не трогает Beauty-таблицы (§19 — своим планом после этой фазы), RequestActor/scope, экраны, онбординг,
`ExchangeRate`, `CustomerBusiness`, активацию расширений; не снимает `properties.organization_id`;
не ставит NOT NULL на `location_id` и не обещает его следующей миграцией (§2, gate владельца).
