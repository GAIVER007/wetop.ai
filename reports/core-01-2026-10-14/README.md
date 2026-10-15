# CORE-01 Verification Report

Date: 14.10.2026. Branch `claude/core-01-20261014`, base `origin/main` `b46db141a` (merge PR #528, влитость
проверена). План `plans/core-01-2026-10-14.md`. Это verification gate: код продукта не менялся, правилась
только документация (LIVE RULE дрейф) и добавлены тесты.

## Executive Summary

**Вердикт: NO-GO. CORE-SECURITY-FIX REQUIRED.**

Межвертикальная изоляция подтверждена: из Food/Beauty-скоупа гостиничные данные недостижимы (403 по
капабилити или 404 без Property), эксплуатируемого кросс-вертикального пути нет, «fallback на ранний
Property» существует только на организационном скоупе и в чужую вертикаль не ведёт. Но проверка нашла и
доказала рантайм-репродукцией **кросс-организационную запись**: повтор события менеджера каналов
(`POST /channels/channex/events/:revisionId/retry`) сбрасывает событие ЧУЖОЙ организации, потому что
`resetExternalEventAttempts` пишет по (provider, externalEventId) без привязки и работает служебной ролью
мимо RLS. Плюс подтверждены кодом дыры границы назначений внутри организации (гости организации целиком
видны сотруднику, назначенному на один филиал; и ещё три места). По воротам ТЗ (§18) это NO-GO:
CORE-02/03 не начинать, сначала CORE-SECURITY-FIX.

## Baseline

`origin/main` `b46db141a`; PR #528 merged (проверено `gh pr view`). Упомянутые в ТЗ
`WETOP-CORE-ARCHITECTURE-01.md` и «Core Unification Audit» в репозитории отсутствуют (внешние документы):
проверка шла от U1–U6 самого ТЗ и кода. Scope-модель: заголовок `x-wetop-scope` → `resolveScope`
(`apps/api/src/auth/scope.ts`) → `AuthorInterceptor` (роль места, капабилити) → сервисы/`propertyRef`.

## U1 Vertical Isolation

### Findings
- Гостиничные контроллеры с `@RequiresBusinessCapability('hospitality.*')`: reservations, rate-plans,
  chessboard (вкл. `/availability`), guests, pii-storage, units, inventory (чтение), rates, channels.
  Для Food/Beauty-скоупа: **403** до обработчика.
- Семейства без капабилити (finance, tasks, desk, dashboard, market, analytics, hotel-settings,
  inventory-editor, channels catalog/connection/content, `/availability/offers`): завязаны на Property
  выбранного бизнеса/филиала → для Food/Beauty-скоупа **404** «У вашей организации ещё нет объекта…»
  (`property-ref.ts:143-152`). Класс B.
- Исключения: `/audit` на Food-скоупе ловит 404 и расширяется до организации (владелец/право journal,
  by design, класс B-org); `/system/connection` игнорирует скоуп (счётчики, класс D low);
  `/system/freshness` для Food-скоупа в организации с Channex отвечает 404, а меню опрашивает его каждую
  минуту (функциональная мелочь, P3).
- Бар и маркетинговый бюджет для Food-филиала работают НАМЕРЕННО (location-generic, ADR-178), это не дыра.

### U1 Property Fallback
- **Fallback существует: CONFIRMED**, `property-ref.ts:141-151`: на организационном скоупе берётся
  **ранний** (orderBy createdAt asc) Property организации; на бизнес-скоупе ранний внутри бизнеса; на
  локейшен-скоупе ровно его Property.
- **«Food/Beauty-скоуп проваливается в чужой отель»: FALSE POSITIVE**: верифицированный businessId или
  locationId всегда в where, Property другого бизнеса не матчится (404). Тест-доказательство:
  `tests/integration/scope-hardening.test.ts:228-264`.
- Хвосты fallback (не кросс-вертикаль, целостность): (1) отвергнутый/протухший заголовок тихо даёт
  ORGANIZATION, и маршруты без капабилити **пишут в ранний отель** (`author.interceptor.test.ts:166-174`
  закрепляет это поведение как намеренное); (2) ранним может оказаться Property **архивного** филиала
  (статусы не фильтруются, `property-ref.ts:140-146`); (3) `HotelService.property()`
  (`hotel.module.ts:88-145`): `findFirst` **без orderBy**: на орг-скоупе `/hotel/settings` может попасть
  в другой Property, чем шахматка и финансы; (4) `POST /hotel/onboarding` на орг-скоупе в организации без
  отеля **создаёт новый HOSPITALITY-бизнес** правом `settings` (менеджер), тогда как `POST /branches`
  владелец-only (`onboarding.ts:153-182`).

### Tests
- Добавлен страж `apps/api/src/auth/capability-coverage.test.ts`: девять гостиничных контроллеров обязаны
  нести свою капабилити (route-access следит только за `@Access`); доказан мутацией (подмена ожидания
  красит, лог прогона мутации в журнале).

## U2 Location Scope

- `resolveScope` честный: любой кривой указатель (чужая организация, чужой бизнес, несогласованная пара,
  архив, не-UUID, мусор) целиком падает в ORGANIZATION; за пределы организации не расширяет никогда.
  Отказ приходит позже: 403 капабилити, 403 SCOPE_CHOOSE/SCOPE_FORBIDDEN для назначенных, 403/409 у
  beauty/food/marketing-scope; **для ненастроенного пользователя маршруты без капабилити тихо работают
  ранним отелем** (см. U1, целостность).
- Назначения (`roleAtPlace`): указать заголовком неназначенный филиал нельзя (403), НО ворота не
  действуют на `self`-маршруты и не проверяют идентификаторы в теле и доступ к объектам по id.
- **Доступ по id**: отели (брони, финансы, задачи, шахматка), beauty-записи, food (заказы, брони, касса,
  склад), бар, маркетинг-сайт: пришиты к Property/location: DENY поперёк филиалов. **Пришиты только к
  организации при по-филиальных данных**: гости отеля (`guests.repository.ts:303-309`: byId, card, update,
  документы, поиск, справочник: сотрудник, назначенный на отель B, читает гостей, проживания, балансы и
  документы отеля A), диалоги/профиль ИИ-продавца (`seller.repository.ts:48-51`), seller-agents мастера
  (под флагом `WIZARD_ENABLED`).
- **Идентификаторы из тела без сверки с назначениями**: `PUT beauty/employees/:id/locations`
  (`beauty/schedule.ts:251-255`): менеджер, назначенный на филиал A, перекраивает филиалы мастера по всему
  бизнесу (и удаляет графики чужого филиала).
- **Вообще без привязки**: `POST /channels/channex/events/:revisionId/retry` → подтверждено рантаймом, см.
  Confirmed Risks.

## U3 Food Customer Phone

- Точная строка телефона: **FALSE POSITIVE**: частичный уникальный индекс
  `customers(organization_id, phone) WHERE phone IS NOT NULL` (миграция 044:28); гонка упирается в 23505
  (у food 409; у beauty необработанный P2002 → **500**, мелкий дефект P3).
- Один номер в разных форматах: **CONFIRMED (P2, рантайм)**: нормализации у Customer нет
  (`normalizePhone` есть, используется только web-booking и members), food/beauty пишут сырую строку.
  Живая репродукция на настоящем Food-API: `+77012223344`, `87012223344` и `+7 701 222 33 44` создали
  **трёх** клиентов (три 201). Усиливает дубли UX: food-пикер видит только клиентов своего бизнеса, 409 по
  точному совпадению подталкивает завести клиента без телефона (дубли без телефона разрешены индексом).
- Модель не менялась (по ТЗ). Follow-up: нормализация телефона Customer + решение владельца о бэкфилле.

## U4 Food Booking Concurrency

- **Двойная бронь через API: FALSE POSITIVE.** Все пути записи идут через `foodTransaction`
  (org/business FOR SHARE, location FOR UPDATE) + `dining_tables FOR UPDATE` + единая проверка пересечения
  с буфером; обходных путей записи нет; walk-in под тем же замком. Рантайм: `mv6-food.test.ts` **19/19**
  на настоящей PostgreSQL, включая две параллельные репродукции (create+create и assign+assign на один
  стол: ровно один 409), журнал `…19-11-04Z-integration-008b`.
- Оговорки (архитектурные, не блокеры): **подстраховки в базе нет** (ноль EXCLUDE у назначений, в отличие
  от отеля `allocations_no_overlap_per_unit` и салона `appointments_no_overlap_per_employee`), и защита
  сломалась бы при переходе на REPEATABLE READ (снимок берётся до ожидания замка). Кандидат на будущий
  EXCLUDE-констрейнт отдельной задачей.

## U5 Other Vertical Boundaries

Food-маршруты отвергают HOSPITALITY/BEAUTY (mv6-food :389+), beauty аналогично (mv4-beauty), гостиница от
Food/Beauty закрыта капабилити/Property (U1), кросс-организация закрыта RLS + цепочками
(organization-isolation, rls-isolation) с единственным найденным исключением U2-1 (channels retry, таблица
`external_events` без RLS by design §17.3, фильтровать обязан код, и в этом месте он не фильтрует).

## U6 Documentation Drift

Код соответствует ADR-180 (все три вертикали приземляются на `/today`, `vertical-landing.ts:6-10`;
гостиничная Главная `hospitality-today.tsx`; «Финансы» отдельной группой). Исправлен LIVE RULE дрейф
(9 правок): DESIGN.md:54 (слияние помечено историей, добавлена строка ADR-180), DESIGN.md §1309 (блоки
владельца снова на `/today`), DESIGN.md:385 (реестр: настоящие пути `finance/day-attention.tsx`,
`finance/attention.css`), CLAUDE.md:19 (пометка «отменено ADR-180» у дубля 152), DECISIONS.md:136 (статус
под заголовком ADR-152-слияния), GLOSSARY.md:56 и README.md:48 и DATA_MODEL.md §18.1 (вертикали +
FOOD_SERVICE), design/references/MAPPING.md:14 (разделены строки `/finance` и `/today`). История (хроника,
датированные статусы, планы, отчёты) не тронута; замороженный ARCHITECTURE.md не тронут (поправка уже есть
в его хвосте). Кодовый дрейф НЕ правился (вне рамок): карточка «Сводка дня» в `/reports:236` ведёт в
`/finance` за заездами, которые теперь на `/today` (P3); устаревшие комментарии `finance/page.tsx:87` и
`owner-dashboard.css:2`.

## Time Utilities

Инвентаризация без переносов. SAFE TO SHARE: (A) «диапазон дат → полуоткрытое UTC-окно»:
`timeOffWindow` ≡ `periodBoundsUtc`/`zonedStartOfDay` + локальные обёртки finance/dashboard: один алгоритм,
DST-безопасный, различаются именами полей и округлением смещения; (B) «сегодня в поясе»: `todayAt`,
`propertyToday`, `foodLocal().date` + 5 приватных копий + веб `localInput().slice(0,10)`; (E) календарная
арифметика DATE-строк: 3 экспорта и ~40 приватных копий `plusDays/shiftDate`. SHARE WITH ADAPTER: веб
`propertyClock` (fallback на PLATFORM_TIMEZONE при кривом поясе, домен кидает), «instant → локальные части»
(`foodLocal` мс-штамп, beauty `localParts` минуты/weekday, `localMinutes` относительный, веб `localInput`),
«локальное время → instant» (`instantOf` против доменных полуночных). VERTICAL-SPECIFIC: гостиничные stay
dates (DATE без пояса, ночи, `display-date` UTC) и UTC-суточная квота ИИ (`utcDayStart`). Полная таблица
с вызовами в отчёте агента, перенос это кандидат CORE-03+.

## Money Boundary

Контуры денег разделены и не текут поперёк вертикалей: отель `payments/folios/cash_operations`
(propertyId), ресторан `restaurant_payments/restaurant_cash_operations` (locationId, FOOD-триггеры), бар
на филиале с «одной кассой» по CHECK (§44/§45), салон денег пока не имеет (сводка честно UNAVAILABLE).
Кросс-чтение одно и намеренное: `/branches/summary` (ADR-182). Известная асимметрия: розница бара
ГОСТИНИЦЫ не входит в поступления Property сводки (близнец закрытого P1.8, HOSPITALITY-срез). Деньги в
этом этапе не менялись.

## Confirmed Risks

| ID | Finding | Status | Severity | Evidence | Repro | Required Fix | Next Task |
|---|---|---|---|---|---|---|---|
| U2-1 | Повтор события каналов сбрасывает `external_events` ЧУЖОЙ организации (updateMany без привязки, служебная роль мимо RLS; маршрут доступен администратору каналов любой организации с Channex) | **CONFIRMED (рантайм)** | **P1, кросс-организационная запись** | `reservations.repository.ts:1408-1412`, `inbound.service.ts:609-612`, `integration-command.ts:38-51`; модель несёт `propertyId` (ADR-100 §17.2), фильтровать обязан код | `tests/integration/core-01-repro.test.ts` (`it.fails`, живёт зелёным пока дефект есть; инверсия прогнана: чужая строка стала attemptCount 0, RECEIVED) | Привязать сброс к `propertyId` интеграционного скоупа (однострочный where) + red → green | **CORE-SECURITY-FIX (блокер)** |
| U2-2 | Гости организации целиком доступны сотруднику, назначенному на один филиал (byId, карточка, правка, документы, справочник) | CONFIRMED (код) | P1 (внутри организации, поперёк бизнесов; граница признана недостроенной ещё в STAFF2.3b 09.10) | `guests.repository.ts:303-309, 817-899` | рецепт в отчёте U2 (HTTP, назначенный STAFF) | `visible()` с учётом назначений или явное решение «гости организационные» ADR-ом | CORE-SECURITY-FIX |
| U2-3 | `PUT beauty/employees/:id/locations` принимает филиалы тела без сверки с назначениями (сносит графики чужого филиала) | CONFIRMED (код) | P2 | `beauty/schedule.ts:251-282` | рецепт в отчёте U2 | сверка `locationIds` с назначениями | CORE-SECURITY-FIX |
| U2-4 | `GET /onboarding` (`self`) отдаёт черновик любого филиала организации назначенному пользователю | CONFIRMED (код) | P2 | `onboarding.module.ts:64-93`, `author.interceptor.ts:116` | рецепт в отчёте U2 | проверка назначений и для self-контекста | CORE-SECURITY-FIX |
| U1-C | `POST /hotel/onboarding` на орг-скоупе создаёт HOSPITALITY-бизнес правом `settings` (менеджер), минуя владелец-only `/branches`; в Food/Beauty-организации создаёт отель «из ниоткуда» | CONFIRMED (код) | P2 | `onboarding.ts:153-182`, `property-chain.ts:40-79` | не гонялась | потребовать выбранный бизнес или право владельца | CORE-SECURITY-FIX |
| U3-B | Один номер телефона в разных форматах создаёт дубли клиентов | CONFIRMED (рантайм: 3 клиента) | P2 | нет нормализации: `food.ts:158-163`, `appointments.ts:158-172`; индекс по сырой строке | живой прогон на стенде (в журнале сессии) | нормализация телефона Customer + бэкфилл (решение владельца) | отдельная задача (не блокер) |
| U4-B | У назначений столов нет EXCLUDE-подстраховки в базе; защита зависит от READ COMMITTED | CONFIRMED (код) | P2 (риск при изменении изоляции/прямом SQL) | миграция 058 без EXCLUDE; отель и салон имеют | прямой SQL (описан) | EXCLUDE-констрейнт отдельной миграцией | отдельная задача (не блокер) |
| U1-D | Тихий ORGANIZATION-fallback: протухший заголовок у ненастроенного пользователя пишет в ранний отель; архивный Property может быть «ранним»; `HotelService.property()` без orderBy | CONFIRMED (код + закрепляющий тест поведения) | P2 (целостность, не конфиденциальность) | `property-ref.ts:140-151`, `hotel.module.ts:88-145` | `author.interceptor.test.ts:166-174` | явный отказ вместо тихого fallback или детерминизм | CORE-SECURITY-FIX (решить правило) |

## False Positives

Кросс-вертикальная утечка через гостиничный API (403/404 доказаны); «Food-скоуп проваливается в ранний
Property» (where всегда с верифицированным бизнесом/филиалом); двойная бронь стола через API (две
параллельные репродукции зелёные); дубль клиента по точной строке телефона (частичный уникальный индекс).

## Unknowns

Диалоги ИИ-продавца поперёк филиалов (`seller.repository.ts:48-51`): CONFIRMED-by-code, но «агент
организации» мог быть осознанным решением до мультивертикали: нужна сверка с ADR-ами ИИ-продавца
(рецепт репродукции есть); seller-agents мастера под выключенным флагом (P3). Частота UX-пути
«409 по телефону → клиент без телефона» не измерена.

## Regression Tests

Добавлены: `apps/api/src/auth/capability-coverage.test.ts` (пин капабилити девяти контроллеров, доказан
мутацией); `tests/integration/core-01-repro.test.ts` (документированная репродукция U2-1 в `it.fails`:
зелёная пока дефект жив, закричит при починке: снять `.fails` в CORE-SECURITY-FIX). Прогнано как
доказательства: mv6-food 19/19 (конкуренция), живые репродукции U2-1 (инверсия) и U3-B (три формата).

## Documentation Changes

Девять правок LIVE RULE (список в U6). История, датированные статусы и замороженный ARCHITECTURE.md
не тронуты. Новый ADR не создавался (решений не принималось: только синхронизация с ADR-180 и MV1).

## Remaining Risks

Таблица Confirmed Risks целиком; плюс P3: beauty-гонка телефона отвечает 500 вместо 409; `/system/freshness`
404 для Food в организации с Channex при минутном опросе меню; `/system/connection` игнорирует скоуп;
карточка «Сводка дня» в `/reports` ведёт в `/finance`; устаревшие комментарии в `finance/*`.

## Recommended Next Tasks

1. **CORE-SECURITY-FIX (блокер, перед CORE-02/03):** U2-1 (привязка сброса событий к Property, снять
   `.fails` у репродукции), U2-2 (гости и назначения: или решение «организационные» ADR-ом), U2-3, U2-4,
   U1-C, правило для U1-D (тихий fallback). Каждое red → green, HTTP-уровень с настоящими guard'ами.
2. Затем non-blocking пакет: U3-B нормализация телефона (с решением владельца о бэкфилле), U4-B EXCLUDE
   для назначений, P3-мелочи.
3. Отдельно: сверка U2-5 (ИИ-продавец) с принятыми ADR-ами мультивертикали.

## GO / NO-GO

```text
NO-GO: CORE-SECURITY-FIX REQUIRED
```

Основание (ворота §18 ТЗ): подтверждённая несанкционированная кросс-организационная запись (U2-1, рантайм)
и подтверждённые кодом дыры границы назначений внутри организации (U2-2…U2-4, U1-C). Межвертикальная
изоляция при этом доказана, U3/U4 не блокируют. CORE-02/CORE-03 не начинать до закрытия CORE-SECURITY-FIX.

STOP.
