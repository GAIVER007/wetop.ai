# Фаза Business + Location — отчёт и инструкция владельцу (27.09.2026)

План — `plans/phase-business-location-2026-09-27.md` (утверждён владельцем 27.09.2026 с восемью
уточнениями консультанта). Решения: ADR-104 (модель §18 `DATA_MODEL.md` v2.0/v2.2), ADR-100-заморозка
(иерархия). **Рабочую базу агент не трогал; применяет владелец — раздел 4.**

## 1. Что в ветке

| Часть | Файл |
|---|---|
| Миграция фазы | `packages/database/prisma/migrations/20260927000029_business_location/migration.sql` + `down.sql` |
| Починка отката …27 | `…/20260927000027_tenant_columns/down.sql` — возврат FK к определениям phase1 (перенос из ветки `claude/hopeful-thompson-2v8v8a`); без неё `check-migrations.sh` ловил расхождение схемы после отката. Сама миграция `…27` не тронута ни байтом |
| Схема | `schema.prisma`: `Business`, `Location`, `Property.locationId`, `Organization.reportingCurrency`, три enum |
| RLS | политики `rls_tenant` на обе таблицы в миграции `…29` (стиль ADR-103); реестр `packages/database/src/rls.ts` |
| Отчёт фазы | `scripts/ops/phase-business-location-report.sql` — только чтение |
| Тесты | `tests/integration/rls-isolation.test.ts` — три новых теста уровня БД |

Слияние с линией Phase 1: код штампов/чтений PR #98 сведён с текущим `main` (RLS, trial) в этой же
ветке; `ARCHITECTURE.md` — одна каноническая редакция (детальная v3 + раздел «Замороженные решения»).
Backend фазой не меняется: ни один репозиторий, `property-ref.ts` и экран не правился.

## 2. Что делает миграция `…29`

1. **Схема (additive):** `businesses` (§18.1), `locations` (§18.2, без `organization_id` — §18.3),
   `properties.location_id NULL` + индекс, `organizations.reporting_currency NULL` **без DEFAULT**.
2. **Backfill строго по Organization:** организация с объектами → ровно один Business
   (`name` = имя организации), Location на каждый её Property (контакты/таймзона/валюта — из строки
   Property), `properties.location_id` проставляется. Никакой идентификации по именам.
   `reporting_currency` — валюта объектов, если она одна (Luxx → KZT); иначе NULL + отчёт.
3. **RLS:** `businesses` — по `organization_id = app_current_org()`, `locations` — через родителя;
   `TO wetop_app` без `FORCE` — до включения ролей поведение прежнее, как у всех политик ADR-103.
4. **Чего нет:** NOT NULL на `location_id` (gate владельца, заранее не объявляется), правок Hospitality-FK,
   правок кода, Beauty-таблиц, `ExchangeRate`, `CustomerBusiness`.

## 3. Доказательства (журнал `tests/runs/JOURNAL.md`, 27.09)

| Проверка | Результат | Лог |
|---|---|---|
| Изоляция БД **красным** до миграции | ❌ 3/9 — `relation "businesses" does not exist` | `…15-44-42Z-integration-a517.log` |
| Изоляция БД после | ✅ 9/9 — организация видит только свои Business/Location; чужие не приходят прямым SQL по id; запись в чужую организацию отвергает база (`row-level security`); `wetop_service` видит всё; join-политика под действующей политикой businesses — без сюрпризов | `…15-48-18Z-integration-b9b2.log` |
| `check-migrations.sh`, чистый PostgreSQL 16 | ❌ FAIL на откате `…27` (FK) → починка down.sql → ✅ RESULT: OK вся цепочка, включая `…29` | вывод в PR |
| typecheck / lint | ✅ чисто | `…15-52-28Z`, `…15-52-51Z` |
| unit | ✅ 2109/2112 (3 пропуска — только macOS) | `…15-53-15Z-unit-bd35.log` |
| integration полный | ✅ 112/112 | `…15-54-27Z-integration-95a7.log` |
| Живые e2e, локальный стенд с применённой `…29` | ✅ 25/25 (прогон 24/25 до этого поднял несвежую сборку web с ветки A1 — красный не этой ветки, разобран в журнале) | `…15-59-00Z-e2e-7057.log` |
| Отчёт фазы на локальной базе | Luxx Aparts: 1 Business, 1 Location, связность 0/0/0, `reporting_currency = KZT`, gate NULL = 0 | раздел 5 |

## 4. Инструкция владельцу (после влития PR в `main`)

1. Копия базы: `scripts/ops/db-backup.sh` (как перед phase1).
2. Снять отчёт «до»: `psql "$DATABASE_URL" -f scripts/ops/phase-business-location-report.sql > /tmp/bl-before.txt`
   (разделы про `businesses`/`locations` скажут, что таблиц нет, — это ожидаемо; важны счётчики строк).
3. Обновить код на сервере (как обычно по `docs/deploy.md`) и применить миграцию:
   `npm run migrate:deploy -w packages/database`. Прогон напечатает `NOTICE` backfill — сохранить.
4. Снять отчёт «после»: тот же скрипт в `/tmp/bl-after.txt`. Сверить:
   - счётчики существующих таблиц «до» = «после»;
   - Luxx: ровно 1 Business, ровно 1 Location, `missing_location = 0`, `chain_mismatch = 0`;
   - `reporting_currency` у Luxx = KZT; `left_null` — только организации без объектов;
   - gate `properties_location_id_null` = 0.
5. Четыре сверки в ноль, как после phase1: `cli-inventory` (88/88), `cli-day-selfcheck` (RESULT OK),
   цены 8 640, балансы 1 449/1 449.
6. Стойка: экраны не менялись — достаточно открыть Главную и шахматку.
7. Откат при беде: `psql "$DATABASE_URL" -f packages/database/prisma/migrations/20260927000029_business_location/down.sql`
   + `DELETE FROM "_prisma_migrations" WHERE migration_name = '20260927000029_business_location';`
   (Hospitality не затронут: удаляются только новые таблицы, колонки и политики).

## 5. Отчёт фазы на локальном стенде (образец «после»)

```
Business на организацию:  Luxx Aparts — 1
Связность properties:     total 1 · ownerless 0 · missing_location 0 · chain_mismatch 0
Location без Property:    0
reporting_currency:       organizations 1 · filled 1 (KZT) · left_null 0
Gate NOT NULL:            properties.location_id IS NULL — 0
```

## 6. Что дальше (не в этой фазе)

RequestActor/scope/переключатель контекста и онбординг цепочки — следующая архитектурная работа
(`ARCHITECTURE.md` §6, §15) своим планом; NOT NULL на `location_id` — только через gate §2 плана;
включение ролей RLS на рабочей базе — за владельцем (`docs/ops/rls.md`).
