# Схема Prisma и база из миграций: таблицы v1.6 — 24.09.2026

Поручение: `packages/database/prisma/schema.prisma` должна описывать ровно ту базу, которую строят миграции, по
таблицам миграций v1.6 от 20.09.2026 (`20260920000015_email_verification`, `20260920000016_property_organization`).
Production-миграции не делать (AGENTS.md §15). Расхождение нашлось в той же сессии при сверке таблиц ИИ-продавца
(`reports/ai-assistant-seller-2026-09-24.md` §9).

## Итог

- Отличий четыре (шесть операторов: каждый из двух ключей — «снять» и «поставить заново»). **Во всех четырёх права
  миграция**, правилась только `schema.prisma`. Миграции, рабочая база, `DATA_MODEL.md` и `QUESTIONS.md` не тронуты:
  миграции описывают то, что на рабочей базе с 20.09, и ни одна из них не выглядит ошибкой (разбор ниже).
- `prisma migrate diff` базы, собранной из всех миграций, против схемы: **до** — шесть операторов, код выхода 2;
  **после** — `-- This is an empty migration.`, код выхода 0.
- Поведение кода не меняется: `relationMode` не задан, значит `foreignKeys`, и действия ключей выполняет база, а не
  Prisma — она и раньше делала то, что записано в миграциях. Единственное место, где заводится ссылка подтверждения
  (`apps/api/src/auth/email-verification.service.ts`, `emailVerification.create`), `id` не передаёт: раньше его
  выдавал клиент Prisma, теперь выдаёт база, строка та же. Удаляют организации только уборки интеграционных тестов,
  и объект они удаляют раньше организации.

## Как проверялось

База — локальная PostgreSQL 16, собранная из всех миграций с нуля. Рабочая база в проверке не участвовала.

```
npm run db:local -- reset                     # кластер заново, все миграции по порядку
cd packages/database
DATABASE_URL=<локальный адрес> DIRECT_URL=<локальный адрес> \
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
# то же с --exit-code: 0 — расхождения нет, 2 — есть
```

Локальный адрес печатает `npm run db:local -- url` (`postgresql://postgres@127.0.0.1:55432/pmslocal`).
`--from-migrations` не годится: в папке миграций нет `migration_lock.toml`, поэтому сравнение идёт с базой, которую
миграции построили. Тестовая схема `pms_test` строится из тех же файлов `migration.sql` (`tests/tools/test-schema.ts`),
и в ней ключи и умолчание те же, что в `public`.

## Четыре отличия

Состояние базы — по `pg_constraint` и `information_schema` локальной базы после `db:local -- reset`: `confdeltype`
и `confupdtype` — `a` (NO ACTION) или `c` (CASCADE).

| # | Что | Миграция и база | Схема до правки | `DATA_MODEL.md` | Решение |
|---|---|---|---|---|---|
| 1 | индекс `properties_organization_id_idx` | есть (миграция 16, `CREATE INDEX`) | нет `@@index` — diff удалил бы индекс | §1 про индекс молчит | `@@index([organizationId])` |
| 2 | ключ `properties_organization_id_fkey` | `REFERENCES organizations` без действий: ON DELETE NO ACTION, ON UPDATE NO ACTION (`a`/`a`) | необязательная связь без действий — по умолчанию Prisma ON DELETE SET NULL, ON UPDATE CASCADE | §1: «FK → organizations; NULL — ничья, видна только служебным ходокам»; действия не названы | `onDelete: NoAction, onUpdate: NoAction` |
| 3 | умолчание `email_verifications.id` | `DEFAULT gen_random_uuid()` (миграция 15) | `@default(uuid())` — id выдаёт клиент, в базе умолчания нет; diff снял бы DEFAULT | §13.10: «DEFAULT `gen_random_uuid()`» — как в миграции | `@default(dbgenerated("gen_random_uuid()"))` |
| 4 | ключ `email_verifications_user_id_fkey` | `REFERENCES users ON DELETE CASCADE`, ON UPDATE не задан — NO ACTION (`c`/`a`) | `onDelete: Cascade` — Prisma добавляет ON UPDATE CASCADE | §13.10: «ON DELETE CASCADE; индекс»; ON UPDATE не назван | `onDelete: Cascade, onUpdate: NoAction` |

**Почему миграция не ошибка и вопрос не нужен.**

- №3 и ON DELETE в №4 `DATA_MODEL.md` §13.10 называет прямо, и они совпадают с миграцией.
- №1: индекс нужен. Объект организации вошедшего выбирается прямо по `organization_id`
  (`apps/api/src/database/property-ref.ts`), а схема без `@@index` при следующем `prisma migrate dev` удалила бы его
  с рабочей таблицы.
- №2 — единственное место, где схема и миграция расходятся по смыслу. SET NULL из схемы при удалении организации
  молча сделал бы гостиницу ничьей: объект пропал бы у всех сотрудников, остался бы только служебным ходокам, и никто
  этого не заметил бы. NO ACTION из миграции такое удаление запрещает. Это осторожнее и не противоречит §1, где
  NULL — объект, который ещё ни за кем не числится, а не последствие удаления организации. Кода, который удаляет
  организацию, в платформе нет — только уборки интеграционных тестов.
- ON UPDATE в №2 и №4: `id` организаций и людей — uuid, их не меняют. CASCADE против NO ACTION на данные не влияет,
  правильна та сторона, что уже стоит на рабочей базе.

## Правка

Только `packages/database/prisma/schema.prisma`:

```diff
 model Property {
-  organization       Organization?       @relation(fields: [organizationId], references: [id])
+  /// Ключ и индекс — как их строит миграция 20260920000016: ON DELETE и ON UPDATE — NO ACTION.
+  /// Организацию, за которой числится объект, удалить нельзя: объект не становится ничьим молча.
+  organization       Organization?       @relation(fields: [organizationId], references: [id], onDelete: NoAction, onUpdate: NoAction)
 …
+  @@index([organizationId])
   @@map("properties")

 model EmailVerification {
-  id        String    @id @default(uuid()) @db.Uuid
+  /// id выдаёт база, у ключа на users нет ON UPDATE — как в миграции 20260920000015
+  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
   userId    String    @map("user_id") @db.Uuid
-  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
+  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: NoAction)
```

`prisma validate` — схема верна; клиент пересобран (`npm run generate -w @pms/database`, Prisma 7.10.0).
`prisma format` не запускался: он переставил бы пробелы по всему файлу.

## Вывод до и после

**До** (схема коммита `b9152bb6`, `--exit-code` — 2):

```
-- DropForeignKey
ALTER TABLE "email_verifications" DROP CONSTRAINT "email_verifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_organization_id_fkey";

-- DropIndex
DROP INDEX "properties_organization_id_idx";

-- AlterTable
ALTER TABLE "email_verifications" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**После** (схема с правкой, `--exit-code` — 0):

```
-- This is an empty migration.
```

Больше расхождений нет ни в одной таблице, в том числе в `user_errors` и `seller_profiles`.

## Разовая проверка на клиенте Prisma

Ссылку подтверждения через настоящую базу не заводит ни один integration-тест: unit-тесты `auth` ходят в поддельную
базу (`apps/api/src/auth/fake-db.ts`). Поэтому после правки пересобранный клиент (`createPrismaClient` из
`@pms/database`) прогнан скриптом вне репозитория по локальной базе. Скрипт пускает только адрес
`127.0.0.1:55432`, данные в нём вымышленные, за собой он всё убирает:

```
email_verifications.id от базы: true b4ca1f7c-ac0e-421d-a27c-a27a4e1eb82c
после удаления человека ссылок осталось: 0
удаление организации с объектом — отказ: P2003
объект по-прежнему числится за организацией: true
уборка: объект, затем организация — удалены
```

`emailVerification.create` без `id` получает его от базы, ссылки уходят вместе с человеком (ON DELETE CASCADE).
Организацию, за которой числится объект, база удалить не даёт (P2003 — нарушение внешнего ключа), и объект остаётся
за ней.

## Прогоны

Все прогоны — на дереве с правкой, через `npm run test:record`:

| Набор | Итог | Лог |
|---|---|---|
| typecheck | ✅ без ошибок | `tests/runs/logs/2026-09-24T19-17-31Z-typecheck-8c5f.log` |
| unit | 1727 прошло, 7 упало, 3 пропущено (из 1737) | `tests/runs/logs/2026-09-24T19-17-59Z-unit-951f.log` |
| integration, локальная PostgreSQL 16 | ✅ 64 из 64 | `tests/runs/logs/2026-09-24T19-19-54Z-integration-425d.log` |
| lint | ✅ без ошибок | `tests/runs/logs/2026-09-24T19-20-45Z-lint-a7a2.log` |

Семь упавших unit — те же сторожи оформления, что падали до правки (`…18-26-20Z-unit-4817.log`): список упавших
совпадает построчно. Все семь смотрят на файлы `main` из PR #64 (`55062c48`: `chessboard/board.css`, `page.tsx`,
`stay-resize.tsx`; `--weight-normal` без определения — там же) и PR #66 (`333c21f0`: `inventory/fund.css`, `page.tsx`,
`category-catalog.tsx`, `rooms/availability-finder.tsx`). Разбор — `reports/ai-assistant-seller-2026-09-24.md` §10.
Со схемой они не связаны.

Integration и до правки шёл на правильной стороне: схема `pms_test` строится из файлов миграций, а не из
`schema.prisma`. Красное → зелёное здесь доказывает `migrate diff`, а не integration.

## Что осталось

- **Рабочая база ничего не ждёт.** Правка приводит схему к тому, что уже стоит на рабочей базе с 20.09, миграции
  не нужно. Проверить это на самой рабочей базе агент не может и не должен: сверка шла только с базой, собранной
  из миграций.
- Сторож от повторения поставлен тем же вечером — раздел ниже.

## Сторож: `check-migrations.sh` сверяет схему (тем же вечером, «делай что осталось»; план ИИ-продавца §13)

Такое расхождение появляется, когда миграцию пишут руками и не правят схему. `--from-migrations` без
`migration_lock.toml` не работает, поэтому сверять можно только с базой, которую построили миграции.
`scripts/ops/check-migrations.sh` такую базу уже строит: `_mig_after` — вся цепочка на пустом PostgreSQL.

Сразу после её сборки идёт шаг `drift` — `prisma migrate diff … --exit-code`:

- код 0 — `ok`;
- код 2 — `FAIL` и первые операторы расхождения;
- нет CLI Prisma или сбой — тоже `FAIL`: пропуск был бы молчанием.

`DIRECT_URL` и `DATABASE_URL` заданы явно — на временную `_mig_after`: иначе `prisma.config.ts` взял бы `DIRECT_URL`
из `.env`, то есть рабочую базу. В CI задание `db` теперь ставит зависимости до этой проверки; само задание не идёт,
пока нет минут Actions.

**Красный** — схема до правки (`e505a601^`), подставлена на время прогона и возвращена, код выхода 1:

```
Миграций: 20
ok   вся цепочка легла на пустую базу
FAIL schema.prisma расходится с миграциями — prisma migrate dev вписал бы:
       ALTER TABLE "email_verifications" DROP CONSTRAINT "email_verifications_user_id_fkey";
       ALTER TABLE "properties" DROP CONSTRAINT "properties_organization_id_fkey";
       DROP INDEX "properties_organization_id_idx";
       ALTER TABLE "email_verifications" ALTER COLUMN "id" DROP DEFAULT;
       ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ok   20260907000001_init_inventory — откат вернул схему в прежнее состояние
…
RESULT: FAIL (1)
```

**Зелёный** — текущая схема, код выхода 0:

```
Миграций: 20
ok   вся цепочка легла на пустую базу
ok   schema.prisma описывает ровно ту базу, что строят миграции
ok   20260907000001_init_inventory — откат вернул схему в прежнее состояние
…
ok   20260924000019_seller_profiles — откат вернул схему в прежнее состояние
RESULT: OK
```

Всего 22 строки `ok`: цепочка, сверка и 20 откатов. Запуск — как раньше, на локальной базе
(`MIGRATION_CHECK_URL=postgresql://postgres@127.0.0.1:55432/postgres scripts/ops/check-migrations.sh`); нужен ещё `npm ci`.
