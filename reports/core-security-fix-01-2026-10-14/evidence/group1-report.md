# CORE-SECURITY-FIX-01, группа 1 (A2, F4, F5, U3-b): отчёт

Дерево: `/Users/urijzapojnov/Documents/ChatGPT/WETOP/.claude/worktrees/core-security-fix-01`, ветка `claude/core-security-fix-01-20261014`.
База: своя PostgreSQL 16 на 55460 (`DATABASE_URL=postgresql://postgres@127.0.0.1:55460/pmslocal`, схема `pms_test`).
Ничего не закоммичено. Логи красных и зелёных прогонов: `/private/tmp/claude-501/-Users-urijzapojnov-Documents-ChatGPT-WETOP/064def95-82d3-4a81-84b3-dbb4f57647c2/scratchpad/csf01-notes/` (a2-red.log, a2-green.log, f4-red.log, f4-green.log, u3b-red.log, u3b-green.log, f5-run.log, neighbors-unit.log, neighbors-integration.log, unit-api-all.log, typecheck.log, eslint.log).

ВАЖНО для координации: в той же папке `tests/integration/core-security/` и в `packages/domain/src/accounts/scopes*.ts`, `apps/api/src/auth/role.guard.ts`, `apps/api/src/guests/guests.controller.ts`, `apps/api/src/auth/organization-level.decorator.ts` работает ДРУГОЙ исполнитель (файлы `scope-ai-seller.test.ts`, `scope-world.ts` и т.д. не мои). Его `scope-ai-seller.test.ts` на моих прогонах был красным, а `npm run typecheck` показывает единственную ошибку именно в нём (`scope-ai-seller.test.ts(118,30): Cannot find name 'OWN_SCOPE'`, пока файл правится). Моих ошибок typecheck нет.

## Итог по пунктам

| Пункт | Решение | Красный до | Зелёный после |
|---|---|---|---|
| A2 `/system/connection` | исправлено | 4 из 8 | 8 из 8 |
| F4 `PUT /beauty/employees/:id/locations` | исправлено | 5 из 14 | 14 из 14 |
| F5 явный `customerId` | **код не менялся, REQUIRED OWNER DECISION** | не применимо (охранные тесты зелёные на чистой main) | 12 из 12 |
| U3-b гонка нового телефона Beauty | исправлено | 3 из 8 | 8 из 8 |

## A2: `GET /system/connection`

Было: `apps/api/src/database/connection.ts:40-41` (`property.findFirst({ where: { name: LUXX_APARTS_PROPERTY.name } })`), `:95-103` (catch прятал любой отказ за `DATABASE_UNAVAILABLE`, а `assertPropertyVisible` ловился тем же catch). Указатель запроса и роль места не читались, ограниченный менеджер салона/ресторана/другого филиала получал имя, пояс, валюту и счётчики `Luxx Aparts`.

Кто вызывает: `apps/web/src/lib/hotel-api.ts:103` (только `apps/web/src/app/platform/page.tsx:176`, с `.catch(() => null)`, вошедший главный администратор); служебные вызовы без человека: `tests/e2e/_schema-guard.setup.ts`, `scripts/preview/real-config.ts`, `tests/live-system/*`. Их путь сохранён.

Стало (`apps/api/src/database/connection.ts`):
- новый `private propertyId()`: если `actsForOrganization()` (вошедший человек или публичный путь организации), объект берётся `propertyRef(db, LUXX_APARTS_PROPERTY.name)`, то есть по области запроса (LOCATION → объект этого филиала, BUSINESS, ORGANIZATION → самый ранний объект организации), `assertPropertyVisible` внутри. Ограниченный без гостиницы в выбранном месте получает 404 `PROPERTY_NOT_SET_UP_MESSAGE`, без организации 403. Служебный ходок (нет человека) идёт прежним поиском по имени (`PROPERTY_MISSING`, как раньше).
- реквизиты и счётчики читаются по `id` (`findUnique`), а не по имени.
- `catch` пробрасывает `HttpException` (403/404 доходят до человека), прочее по-прежнему `DATABASE_UNAVAILABLE`.
- юнит `apps/api/src/database/connection.test.ts` подстроен под два запроса (`findFirst` для служебного выбора, `findUnique` для реквизитов), семантика проверок прежняя (7 из 7).

Побочное изменение поведения (осознанное): владелец чужой организации раньше получал 200 `DATABASE_UNAVAILABLE`, теперь 200 с реквизитами и счётчиками СВОЕЙ гостиницы (это его данные).

Тесты: `tests/integration/core-security/system-connection.test.ts` (8 тестов): ALLOW владелец, неограниченный менеджер, менеджер H1 на H1; DENY T07 (менеджер H2 видит H2, не `Luxx Aparts`; указатель H1 у менеджера H2 даёт 403/404), T06 (менеджер салона 403/404 без данных), менеджер ресторана 403/404, чужой владелец видит только свою гостиницу. Красный до (a2-red.log): 4 из 8, причина правильная: ответ 200 с `"name":"Luxx Aparts"` и счётчиками для менеджера H2, салона и ресторана; чужой владелец получал `property: null`. Команда: `DATABASE_URL=… npx vitest run --project integration tests/integration/core-security/system-connection.test.ts`.
Тест называет объект `Luxx Aparts` (ловушка старого поиска), а `afterAll` переименовывает его, чтобы поиск по имени в соседних тестах не находил.

## F4: `PUT /beauty/employees/:id/locations`

Было: `apps/api/src/beauty/schedule.ts` `setLocations` (около 242-300): `removed = current.filter(row => !wanted.includes(...))` и `deleteMany` привязок и графика без проверки области. Менеджер BL1 снимал мастера с неназначенного BL2 и стирал график BL2 (тест B-6 из CORE-01).

Стало (`apps/api/src/beauty/schedule.ts:setLocations`):
- область вызывающего = `roleAt(currentRole(), currentAssignments(), { businessId, locationId }) !== null` (без назначений и владелец: всё, как раньше).
- добавить мастера в филиал вне области (id в теле, где мастер не работает) нельзя: `ForbiddenException(SCOPE_CHOOSE_MESSAGE)` 403, ничего не меняется.
- привязки вне области не снимаются и не меняются, график там не стирается; в теле такой филиал, где мастер уже работает, ничего не меняет (форма `LocationsForm` отдаёт список целиком, строгий 403 на каждый id вне области ломал бы сохранение для ограниченного менеджера мастера с несколькими филиалами). Пустой список от ограниченного снимает мастера только с филиалов внутри области.
- проверка будущих записей при снятии только для реально снимаемых (внутри области); запись аудита `beauty.employee.locations.set` теперь пишет итоговый список `finalIds`.
- решения по отказам: чужой бизнес/другая вертикаль/чужая организация в теле остаются 400 («Среди выбранных филиалов есть чужой», проверка уже была), чужой мастер 404.

Тесты: `tests/integration/core-security/beauty-employee-locations.test.ts` (14 тестов). ALLOW: владелец (снимает BL2 при указателе BL1, график уходит), неограниченный менеджер, менеджер на весь бизнес, менеджер BL1 в своём филиале (снять/поставить). DENY: B-6 (менеджер BL1 не снимает BL2 и не стирает график), пустой список, замена списка, добавление BL2 (403), только BL2 в теле (403), форма с полным списком (ничего лишнего), филиал другого Beauty-бизнеса (400/403), филиал ресторана (400/403), мастер другого бизнеса (404), владелец чужой организации (403/404/400). Красный до (f4-red.log): 5 из 14, причины верные (привязка к BL2 снята, пустой список снял BL2, добавление в BL2 вернуло 200 с BL2 в ответе). После: 14 из 14.

Не покрыто: чтение остаётся открытым (B-1: `GET /beauty/employees` отдаёт телефон мастера другого филиала; `overview` отдаёт `locationIds` всех филиалов), правка карточки мастера B-2 и отсутствия B-8 не входили в мои пункты.

## F5: явный `customerId` в Beauty и Food: REQUIRED OWNER DECISION

Было: `apps/api/src/beauty/appointments.ts:~190-226` (клиент ищется по `organizationId` + `ACTIVE`, затем `customerBusiness.createMany skipDuplicates`), `apps/api/src/food-service/food.service.ts:~583-600` (то же, `NotFoundException('Клиент недоступен')`, затем `customerBusiness.upsert`).

Почему код не менялся: замысел записан явно и допускает выбор клиента сети по явному действию:
- `DATA_MODEL.md` §17.3: «Видимость/связь клиента в конкретном Business: join-сущность CustomerBusiness … создаётся при первом обращении клиента в этот Business»;
- `DATA_MODEL.md` §19.1 (MV4): «CustomerBusiness определяет видимость Customer в списке Business; создание Appointment атомарно создаёт/подтверждает эту связь для Customer своей Organization»;
- `DATA_MODEL.md` (Food, MV6): «Customer must be non-archived and same Organization; CustomerBusiness upsert and new customer are atomic with create»; Q-198 закрыт «канонический Customer на Organization».
- тот же путь даёт find-or-create по телефону в Beauty (`known` по `(organizationId, phone)`, тест U3 «Beauty: тот же телефон переиспользует клиента, в том числе клиента, созданного в Food»), поэтому закрыть только `customerId` оставило бы обход через телефон.
Задание велело в таком случае остановиться. Внесена запись о решении ниже.

REQUIRED OWNER DECISION (Q-CSF-F5): должен ли клиент той же организации из другого бизнеса/вертикали без строки `customer_businesses` для этого бизнеса приниматься по явному `customerId` и по телефону? Варианты: (а) оставить как «клиент сети» (замысел §17.3), (б) принимать только клиента со связью с этим бизнесом, новая связь создаётся только при явном действии «добавить клиента сети» либо при создании нового клиента, телефон существующего клиента другого бизнеса даёт 409. Рекомендация: (б), но это меняет записанный DATA_MODEL и сценарий «клиент сети», решать владельцу.

Что сделано без изменения кода: `tests/integration/core-security/customer-explicit-id.test.ts` (12 тестов, все зелёные на чистой main, прогон f5-run.log). Охранные (оберегают то, что держится): клиент своего бизнеса принимается и в Beauty, и в Food (администратор и владелец); клиент чужой организации 404 и связь не создаётся (оба направления); архивный, несуществующий, не-UUID: 404; указатель на неназначенный филиал 403; владелец чужой организации 403/404. Два теста с префиксом `PENDING OWNER DECISION (B-5)` и `(F-3)` фиксируют ТЕКУЩЕЕ поведение (клиент другого бизнеса/вертикали принимается и получает связь); после решения владельца их надо перевернуть на выбранное поведение.

Красного «до» здесь нет, поскольку исправления нет.

## U3-b: гонка нового телефона в Beauty

Было: `apps/api/src/beauty/appointments.ts:~209-226`: `tx.customer.create` для нового клиента с телефоном; при двух одновременных запросах проигравший падал на уникальном индексе `customers_organization_id_phone_key` (Prisma P2002), не перехватывалось, 201 и 500 (25 из 25 повторов в CORE-01; двойная отправка формы с новым клиентом и телефоном тоже 500).

Стало (`apps/api/src/beauty/appointments.ts`): `tx.customer.create` обёрнут в `try/catch`; P2002 (локальный `isUniqueViolation`, как в соседних модулях) превращается в `ConflictException('Клиент с таким телефоном уже записывается: повторите запись через несколько секунд')`. Исключение выбрасывается из колбэка `beautyTransaction`, поэтому транзакция проигравшего откатывается целиком. Индекс, модель клиентов и Food (повторный телефон, 409 «Такая запись уже существует») не менялись.

Тесты: `tests/integration/core-security/beauty-appointment-concurrency.test.ts` (8 тестов). ALLOW: новый клиент с телефоном 201; тот же телефон последовательно находит того же клиента. DENY/гонка: 5 повторов двух одновременных запросов с одним новым телефоном (разные мастера, то же время) дают ровно 201 и 409 с сообщением, клиент один, запись одна, связь с бизнесом одна; 5 повторов двойной отправки (одинаковые запросы) 201 и 409; последовательный повтор 409; повтор проигравшего после гонки находит того же клиента по телефону и проходит (2 записи, 1 клиент); администратор BL1 в неназначенный BL2 403; владелец чужой организации 403/404. Красный до (u3b-red.log): 3 из 8, причина верная: `expected [201, 500] to deeply equal [201, 409]`, тело 500 `Internal server error`. После: 8 из 8, стабильно три прогона подряд.

## Соседние прогоны (все зелёные)

- `npx vitest run --project unit apps/api scripts/preview`: 166 файлов, 1618 тестов; ранее `apps/api/src/beauty|database|auth|food-service|hotel`: 40 файлов, 380 тестов (в том числе `route-access.test.ts`, `scope.test.ts`, `connection.test.ts`).
- integration (37 соседних файлов: beauty-*, mv3/mv4/mv6/mv8, food-*, branches-scope, onboarding*, organization-isolation, request-scope, rls-*, scope-hardening, seller-*, member-scopes, membership-scopes-schema, access-extensions, audit-author, system-incidents) вместе с моими четырьмя: 41 файл, 267 тестов, все зелёные (neighbors-integration.log).
- моя четвёрка: 3 прогона подряд по 42 теста зелёных.
- `npm run typecheck`: единственная ошибка в чужом `scope-ai-seller.test.ts` (другой исполнитель, файл в работе); в моих файлах ошибок нет. `npx eslint` по изменённым и добавленным мной файлам: чисто. `npx prettier --check` по новым файлам и по `connection*.ts`: чисто. `schedule.ts` и `appointments.ts` не прогонялись через prettier (файлы им не форматируются, правки точечные).

## Что НЕ покрыто

- Пункты A1 (ИИ-продавец), Guest, self/onboarding, fail-closed указатель не трогались (чужие).
- F5: нет исправления, решение за владельцем; обход через телефон (find-or-create в Beauty) остаётся.
- F4: чтение мастеров другого филиала (B-1), правка карточки B-2, отсутствия B-8, расписание вне области не закрыты.
- Тесты не чистят созданные организации в `pms_test` (случайные идентификаторы, база тестовая; зависимостей между файлами нет).
- Живую стойку и UI не проверяли (кнопка «Сохранить филиалы» для ограниченного менеджера при мастере, работающем вне его области: ожидаемо успешна и оставляет чужие филиалы нетронутыми; на UI не прогонялось).

## Изменённые и добавленные мной файлы

Изменены:
- `apps/api/src/database/connection.ts`
- `apps/api/src/database/connection.test.ts`
- `apps/api/src/beauty/schedule.ts`
- `apps/api/src/beauty/appointments.ts`

Добавлены (папка общая с другим исполнителем):
- `tests/integration/core-security/harness.ts` (клиенты admin/tenant под RLS, `bootApp` с реальными RoleGuard и AuthorInterceptor, `call`, `seedHotel`, `seedLocation`, `seedUser`, `actorOf`, `nextMonday`, `almatyAt`, `CallResult`)
- `tests/integration/core-security/world.ts` (стенд салона и ресторана: два Beauty-бизнеса с филиалами, два Food-бизнеса, чужая организация, мастера, клиенты, действующие лица owner/orgMgr/mgrBl1/staffBl1/mgrBz/mgrFl1/staffFl1/foreignOwner)
- `tests/integration/core-security/system-connection.test.ts`
- `tests/integration/core-security/beauty-employee-locations.test.ts`
- `tests/integration/core-security/customer-explicit-id.test.ts`
- `tests/integration/core-security/beauty-appointment-concurrency.test.ts`

`git diff --stat` по моим четырём исходникам:
```
 apps/api/src/beauty/appointments.ts      | 37 +++++++++++-----
 apps/api/src/beauty/schedule.ts          | 30 ++++++++++---
 apps/api/src/database/connection.test.ts | 12 +++--
 apps/api/src/database/connection.ts      | 75 ++++++++++++++++++++------------
```
(в общем `git status` есть также чужие правки: `role.guard.ts`, `guests.controller.ts`, `packages/domain/src/accounts/scopes*.ts`, `organization-level.decorator.ts`, `scope-ai-seller.test.ts`, `scope-world.ts`.)
