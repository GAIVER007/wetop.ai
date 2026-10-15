# Beauty, срез B1: модель, миграция, RLS, правила домена

**Дата:** 03.10.2026. **Ветка:** `claude/bold-planck-k2ls6o`. **План:** `plans/beauty-phase3-2026-10-03.md`.
**Основание:** «да давай делай» владельца 03.10.2026 по плану фазы 3 и по `DATA_MODEL.md` §19.1 (ADR-138).

Интерфейса в этом срезе нет намеренно: B1 это таблицы, ограничения, изоляция и чистые правила.
Hospitality не тронут ни одним полем.

## Что сделано

- миграция `20261003000044_beauty_domain` с `down.sql`: три enum'а, десять таблиц, CHECK'и,
  шесть триггеров принадлежности, exclusion constraint на пересечение записей мастера, RLS на все десять;
- модели в `schema.prisma` (Customer, CustomerBusiness, Employee, EmployeeLocation, BeautyService,
  LocationService, EmployeeService, WorkingHours, TimeOff, Appointment) и связи у Organization, Business,
  Location и User;
- десять таблиц вписаны в `RLS_TENANT_TABLES` (`packages/database/src/rls.ts`): это сверяет
  `rls-isolation.test.ts`, реестр и база должны совпадать;
- домен `packages/domain/src/beauty/`: действующая цена и длительность услуги в филиале (Q-257), окно
  записи от длительности, попадание записи в график мастера и его отсутствия, проверка дат отсутствия.

## Red → green

| Что | Red | Green |
|---|---|---|
| Домен Beauty (17 тестов) | модуля нет, `…11-25-46Z-unit-1795.log` | **17 из 17**, `…11-26-44Z-unit-d38d.log` |
| Beauty на настоящей схеме (11 тестов) | таблиц нет, `…11-27-59Z-integration-acc1.log` | **11 из 11**, `…11-34-40Z-integration-e54a.log` |

Полные наборы на срезе: integration **245 из 245** (`…11-34-48Z-integration-4b6b.log`),
unit **2868 из 2871** (3 пропуска macOS, `…11-36-46Z-unit-eef2.log`), typecheck чисто
(`…11-35-46Z-typecheck-6802.log`), lint чисто (`…11-36-23Z-lint-b5d0.log`).

## Миграция: цепочка и откат

`scripts/ops/check-migrations.sh` на чистой базе: **46 миграций, цепочка применяется**, и по каждой
миграции откат возвращает схему в прежнее состояние, включая мою:
по строке `20261003000044_beauty_domain` скрипт печатает «ok», откат вернул схему в прежнее состояние.

**Общий RESULT: FAIL (1), и причина не в Beauty.** Падает один сводный пункт, «schema.prisma расходится с
миграциями», и расхождение целиком про кассу:

```
ALTER TABLE "cash_operations" DROP CONSTRAINT "cash_operations_category_id_fkey";
ALTER TABLE "cash_operations" DROP CONSTRAINT "cash_operations_related_id_fkey";
DROP INDEX "cash_operations_related_id_idx";
ALTER TABLE "cash_operations" ADD CONSTRAINT "cash_operations_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "cash_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Проверено, что это было до среза, а не из-за него.** Собрана отдельная база из миграций **без** моей
(45 миграций из `git show HEAD`), и та же сверка на ней дала то же расхождение, тот же код выхода 2:
про `cash_operations` и ни слова про Beauty. То есть расхождение принесла касса (миграция
`20261002000040_cashbox`, 02.10), а мой срез дрейфа не добавляет.

Причина, если браться: в миграции `cash_operations_category_id_fkey` создан с `ON DELETE RESTRICT`, а в
схеме связь `category CashCategory?` объявлена без `onDelete`, и Prisma считает её `SetNull`; колонка
`related_id` в схеме есть, а связи на саму таблицу нет, поэтому Prisma хочет снять и FK, и индекс.
Лечится в `schema.prisma` без миграции: `onDelete: Restrict` у `category` и объявленная связь на себя для
`relatedId` с `@@index([relatedId])`. **Не правил:** это чужой срез и за границей B1 (`AGENTS.md` §16),
предложено владельцу отдельной задачей.

## Два отличия от предложения §19.1, оба исправления по пути

1. **RLS без новых функций.** В §19.1 предлагались `app_business_visible` и `app_location_visible`. Они не
   понадобились: у `locations` в миграции `…030` уже есть рабочий образец «через родителя»
   (`EXISTS (SELECT 1 FROM businesses parent WHERE parent.id = …)`), и политика родителя сама режет чужие
   строки. Применён он: меньше кода, никаких новых функций и тот же результат. Доказано тестом изоляции.
2. **Триггерные функции без закреплённого `search_path`.** Первая версия ставила `SET search_path = ''` и
   полные имена `public."employees"`. Интеграционные тесты работают в схеме `pms_test` (ADR-042), где лежат
   свои копии тех же таблиц, и функция искала их в `public`: 11 тестов падали на «Филиал принадлежит другому
   бизнесу» при верных данных. Приведено к правилу проекта (так же сделан `cash_operations_category_guard`):
   имена без схемы, путь не закреплён, одна функция работает в обеих схемах. Это расходится с §19.1, и
   §19.1 приведён к коду.

## За владельцем

- миграция `20261003000044_beauty_domain` на рабочей базе, до выкладки кода (`AGENTS.md` §15,
  `docs/deploy.md`); откат `down.sql`;
- Q-252 (деньги записи) до среза B7; Q-251, Q-253…Q-257 ответом или согласием с умолчаниями;
- отдельной задачей: дрейф схемы кассы выше.

## Чего в B1 нет

Экранов, API, прав, онбординга салона, журнала записей. Это срезы B2…B6; B7 ждёт Q-252.
