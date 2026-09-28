# Platform P1 cleanup: снят фолбэк резолвера, `properties.location_id` NOT NULL (28.09.2026)

Поручение владельца от 28.09.2026, после закрытия Platform P1:

> «убрать compatibility fallback через `properties.organization_id` из `organizationPropertyRef()` /
> `location-ref`; оставить единственный canonical путь: Organization → Business → Location → Property;
> … `Property.location_id` перевести в `NOT NULL` отдельной безопасной миграцией … никаких изменений
> Reservation / Finance / Inventory / Channels; полный regression для затронутого platform слоя; после
> этого STOP.»

Модель данных: `DATA_MODEL.md` v2.5, §18.4. Решение — ADR-104 (Platform P1), условие 2 приёмки владельца
от 27.09. Production-миграцию **сам не применяю**, инструкция — в §4.

## 1. Что сделано

**Резолвер.** В `apps/api/src/database/property-ref.ts` объект вошедшего человека (и пути «от имени
организации») ищется только по цепочке `location.business.organizationId`. Второй запрос по
`properties.organization_id` удалён. Объекта без цепочки вошедший больше не получает: ответ «ещё нет
объекта», тот же, что у организации без объекта. Контракт `PropertyRef` не менялся. Служебный путь по
имени (`propertyRef(db, name)`) не тронут. В `location-ref.ts` переписан только комментарий: упоминание
миграционного окна снято, логика прежняя.

**Миграция `20260928000031_platform_p1_location_not_null`.** Сначала проверяет данные, и если нашлось
что-то из списка ниже, падает с понятным текстом. Вся миграция идёт одной транзакцией, поэтому при
отказе ничего не меняется:
- объект без филиала (`location_id IS NULL`);
- объект, чей Business принадлежит другой организации (то же условие, что `broken_chain` в
  `scripts/ops/platform-p1-report.sql`).

Затем `ALTER TABLE properties ALTER COLUMN location_id SET NOT NULL`. `down.sql` снимает только NOT NULL.
Данные не правятся, ни один ID не меняется.

**Одна функция создания объекта: `createPropertyInChain`** (`packages/database/src/property-chain.ts`).
Правила те же, что у backfill миграции 030:
- Business — самый ранний HOSPITALITY организации, а если его нет, заводится один с именем организации;
- Location — копия полей объекта.

Без неё NOT NULL сломал бы всех, кто создаёт объект:

| Где создаётся объект | Было | Стало |
|---|---|---|
| Регистрация (`apps/api/src/auth/auth.service.ts`) | `tx.property.create` без филиала: с 27.09 новая организация получала объект **вне цепочки**, его держал только фолбэк | `createPropertyInChain` в той же транзакции |
| Первый импорт фонда Exely (`scripts/imports/src/exely/import-inventory.ts`) | то же, когда объекта ещё нет | `createPropertyInChain`. Правка — только в строке создания объекта; обновление существующего объекта и весь фонд не тронуты |
| Сиды `tests/tools/seed-local.ts`, `tests/tools/test-seed.ts` | строили цепочку отдельно после создания | через функцию; `linkPlatformChain` в `test-seed` стал не нужен и удалён |
| Интеграционные тесты (6 файлов) | `property.create` / сырой INSERT без филиала | через функцию или с явной цепочкой; перенос объекта между организациями — `tests/tools/property-owner.ts` `moveProperty` (переносит и Business) |

**Не менялись:** брони, счета, фонд, тарифы, каналы и их таблицы; `properties.organization_id` (замок
ADR-061) остаётся, миграция требует его совпадения с организацией Business; API и экраны.

## 2. Проверка всех путей поиска объекта

| Путь | Как ищет | Итог |
|---|---|---|
| `organizationPropertyRef()` — вошедший и «от имени организации» (виджет, продавец) | только цепочка | **фолбэк снят** |
| `organizationLocationRef()` | только цепочка (и была) | комментарий обновлён |
| `propertyRef(db, name)` — служебные ходоки (сторож, вебхуки, импорт, скрипты) | по имени, самый ранний | не меняется: у них нет организации |
| `hotel.module.ts` `property()` (настройки отеля, печатные формы), `hotel/onboarding.ts` `currentProperty()`, `reservations.repository.ts` `property()` | прямо по `properties.organization_id` | **не трогал**: бронь по поручению не менять, а колонка — действующий замок ADR-061. Эти пути отвечают так же, как цепочка, пока `organization_id` объекта совпадает с организацией его Business. Это гарантирует миграция 031 для существующих строк и `createPropertyInChain` для новых. Перевод этих трёх выборок на цепочку — естественная задача Platform P2 (RequestActor/scope) |
| `channels/operator-access.ts`, `channels/integration-owner.ts` | «чей объект у установки» — по сопоставлению Channex или по имени | не про вошедшего, не меняется |
| `guests.repository.ts`, `analytics.repository.ts`, `seller.repository.ts` | по колонке организации в своих таблицах / через `property.organizationId` | не про выбор объекта, не меняется |

## 3. Доказательства (журнал `tests/runs/JOURNAL.md`, логи в коммите)

Red → green:
- unit, резолвер и регистрация: red **2 из 58** (`…09-31-30Z-unit-416a.log`: объект без цепочки находился
  обходным путём; у объекта новой организации не было филиала) → green **62/62** (`…09-36-51Z-unit-6eda.log`).
- integration `property-chain.test.ts`: red (`…09-31-55Z-integration-a757.log`: база без 031 приняла объект
  без филиала). Прогон `…09-36-47Z` с пометкой «green» тоже красный: сырой `pg`-клиент теста ходил в `public`,
  а не в `pms_test`. Исправлено (`search_path` из `DATABASE_SCHEMA`), зелёный — в полном наборе ниже.
- typecheck: 10 ошибок (`…09-33-18Z`) нашли все места создания объекта в тестах → чисто (`…09-35-40Z`).

Полные наборы на итоговом дереве:
- unit **2299/2302**, 3 пропуска (`…09-40-37Z-unit-081c.log`);
- integration **127/127** (`…09-37-32Z-integration-84b2.log`);
- typecheck и lint — чисто (`…09-35-40Z`, `…09-40-14Z`);
- живой e2e **25/25** (`…10-04-51Z-e2e-8331.log`);
- e2e со входом, API ролью `wetop_app` (RLS) — **26/26** (`…10-06-19Z-e2e-4446.log`). Здесь объект вошедшего
  находится только цепочкой, то есть ровно тем путём, с которого снят фолбэк;
- `scripts/ops/check-migrations.sh` на чистом PostgreSQL 16 — **RESULT: OK**: цепочка до 031 ложится,
  `schema.prisma` = база, откат 031 возвращает схему снимок в снимок.

Проверка отказа миграции (локальная база, откатываемая транзакция):
- объект без филиала → `ERROR: platform_p1_location_not_null: 1 объект(ов) без филиала …`;
- Business чужой организации → `ERROR: … Business другой организации (broken_chain) …`;
- чистые данные → миграция применилась, `is_nullable = NO`.

**Два красных e2e по дороге — не дефект правки, разобраны:**
1. Локальный стенд `pms_test` засеяли 27.09 в 21:58 старым сидом **после** миграции 030, и объект остался
   без цепочки. Миграция 031 на нём честно отказала (`…09-42-27Z-e2e-b9b4.log`). Раньше e2e на этом стенде
   были зелёными только за счёт фолбэка. Схема пересобрана свежим сидом.
2. 7 из 25 дважды подряд. На чистом `main` те же спеки падают так же (`…10-01-50Z-e2e-6da8.log`). Причина:
   стенд отдавал web из готовой сборки `apps/web/.next` от 27.09, до экранов, влитых 28.09. После
   `npm run build -w apps/web` набор 25/25. Записано в `TESTING.md` (грабли 28.09).

## 4. Инструкция владельцу — применение на рабочей базе (сам НЕ применяю)

```
0) Mac, папка WETOP, main после влития PR: git pull; npm ci --no-audit --no-fund

1) BACKUP: штатный бэкап Supabase (Dashboard → Database → Backups), убедиться в свежем.

2) ПРОВЕРКА ДО: scripts/ops/platform-p1-report.sql в SQL Editor (вставить целиком, один запрос).
   Ожидание, как 28.09: properties 1/1/0 (without_location = 0), broken_chain 0.
   Если without_location или broken_chain не 0 — СТОП, прислать результат сюда
   (миграция всё равно откажет сама, но лучше увидеть заранее).

3) npm run migrate:status -w packages/database
   Ожидание: pending ТОЛЬКО 20260928000031_platform_p1_location_not_null.
   Если в списке есть другие миграции — СТОП, прислать список (их выкатывают по своим инструкциям).

4) MIGRATE: npm run migrate:deploy -w packages/database
   Ожидание: «All migrations have been successfully applied».
   Если ошибка «platform_p1_location_not_null: …» — ничего не изменилось; прислать текст сюда.

5) DEPLOY кода — обычным порядком (npm run build -w apps/web; kickstart api/web — docs/deploy.md §1).
   Порядок 4→5 безопасен: прежний код читает NOT NULL-колонку без изменений; объект он создаёт
   только регистрацией, а она закрыта (REGISTRATION_OPEN=0).

6) ПРОВЕРКИ ПОСЛЕ:
   a) SQL Editor:
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'location_id';
      → NO
   b) platform-p1-report.sql ещё раз → те же числа, broken_chain 0.
   c) npx tsx scripts/reconciliation/src/cli-inventory.ts            — фонд 88/88, расхождение 0
   d) APP_API_URL=http://127.0.0.1:3001 npm run reconcile:selfcheck — сутки в ноль
   e) Стойка глазами под своим входом: /today, /chessboard, /reservations, /guests, /hotel-settings —
      как до выкладки. Вошедший теперь получает объект только цепочкой; если вместо экрана
      «объект не настроен» — сразу откат шага 7 (код) и сообщение сюда.

7) ROLLBACK:
   код — вернуть предыдущий main и выложить (новая колонка прежнему коду не мешает);
   схема, если нужно — psql -f packages/database/prisma/migrations/20260928000031_platform_p1_location_not_null/down.sql
   и DELETE FROM _prisma_migrations WHERE migration_name = '20260928000031_platform_p1_location_not_null';
   крайний случай — restore из бэкапа шага 1.
```

## 5. Риски

- **Объект вне цепочки больше не виден вошедшему.** На рабочей базе таких нет (28.09: 1/1/0,
  broken_chain 0), а новых не будет: регистрация и импорт создают объект сразу в цепочке, и база без
  филиала его не примет. Миграция 031 это и проверяет.
- **Три выборки по `properties.organization_id`** (§2) остаются. Они равнозначны цепочке, пока совпадают
  две организации. Совпадение закреплено миграцией и единственной функцией создания, но переноса объекта
  между организациями в коде нет; если он появится, переносить надо и Business (как `moveProperty` в тестах).
- **RLS-gate не меняется:** публичная регистрация и первый внешний Partner — только после `DATABASE_APP_URL`
  в API, isolation-smoke под `wetop_app` и замера производительности (`docs/ops/rls.md`).

## 6. Дальше — STOP

Cleanup готов, дальше не иду. Platform P2 (RequestActor/scope) — только по отдельной команде владельца.
Switcher, onboarding и Partners UI — не раньше закрытия P2.
