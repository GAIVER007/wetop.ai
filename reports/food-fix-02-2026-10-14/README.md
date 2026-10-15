# FOOD-FIX-02 RESULT

Date: 14.10.2026
Branch: `claude/food-fix-02-20261014`
Base main SHA: `ecd2127bc` (merge PR #520; влитость FOOD-FIX-01 проверена до старта)
PR: см. ветку (создаётся этим срезом)

## 1. Baseline

PHASE A перепроверила все три пункта по коду свежего `main` до правок; таблица «сейчас/ожидание/файлы/тесты»
в `plans/food-fix-02-2026-10-14.md`. Инвентаризация мест выручки: `report()` (день), `periodReport()`
(период), `/branches/summary` (поступления и расходы), `GET /bar/report` (собственный P&L бара, канон),
`/restaurant-finance` (кассовая лента), `/sales` (выручка диалогов, не затрагивается). Решения: ADR-182.

## 2. P1.8 Bar revenue

- Problem: выручка бара ресторана не входила в отчёт периода и сводку организации, при том что оплаты
  поставщикам бара в расходах сводки уже были (асимметрия: расходы есть, приходы нет).
- Root cause: `periodReport()` считал только закрытые заказы; сводка для ресторанного филиала читала
  только `restaurant_payments`, а продажи бара living в `bar_sales` + приход кассы и туда не попадали.
- Solution: без новой модели; формула взята у самого бара.
- Canonical definition: «выручка бара» = Σ `total_revenue` продаж `bar_sales` в `POSTED` по местному дню
  `created_at` филиала; сторно (REVERSED, кассовая операция гаснет той же транзакцией) исключает продажу
  задним числом. В `period-report` отдельное поле `barRevenueMinor` (в `revenueMinor` заказов не
  вмешивается, средний чек по заказам); в сводке поступления = оплаты заказов + продажи бара, средний чек
  построчно и в итогах только из оплат заказов (новое служебное поле `paidMinor` строки валюты). Ручные
  приходы кассы не входят. Что не входит: розница бара гостиницы в поступления Property (симметричная
  задача HOSPITALITY, записана наблюдением в ADR-182).
- Files: `apps/api/src/food-service/restaurant.service.ts`, `apps/api/src/hotel/organization-summary.ts`,
  `apps/web/src/lib/food-types.ts`, `apps/web/src/app/management/analytics/vertical/food-period.tsx`.
- Tests: `tests/integration/food-fix-02-revenue.test.ts` (4: раздельная выручка двух филиалов, границы
  23:59/00:01 по поясу, сторно, сводка: 120 000 и 80 000 поступлений, итог 200 000, средний чек 75 000 без
  бара, ручной приход 999 000 не виден); unit `organization-summary.test.ts` (+1); мутация: без правок
  4/4 красные (`…15-06-04Z-integration-ed8f`).
- Result: green 4/4 (`…15-05-47Z-integration-5223`), unit 3/3 (`…15-06-49Z`).

## 3. P1.7 Migration 101

- Problem: `food_booking_rules` и `food_closed_days` без guard-триггера вертикали и без `*_grants`-миграции.
- Root cause: миграция 101 вышла вне конвенции 058/059; жила на правах по умолчанию (миграция 26), которые
  восстановление рабочей базы не реиграет (реиграются только `*_grants`): после restore `wetop_app` терял
  бы доступ; строку можно было вставить гостиничному филиалу и менять `location_id`.
- Migration strategy: вперёд, историческая 101 не тронута (101–104 применены на бою 14.10).
- Guard: №105 `food_booking_rules_guard`: функция по образцу `food_ownership_guard`, закреплённый
  `search_path`, BEFORE INSERT OR UPDATE на обе таблицы: локация принадлежит бизнесу FOOD_SERVICE,
  `location_id` неизменяем. `down.sql` снимает триггеры и функцию.
- Grants: №106 `food_booking_rules_grants`, least privilege по фактическим операциям API:
  `food_booking_rules` SELECT/INSERT/UPDATE (DELETE в API нет), `food_closed_days` SELECT/INSERT/DELETE
  (UPDATE в API нет); `REVOKE ALL` перед выдачей. `down.sql` возвращает права по умолчанию миграции 26.
- RLS: был с миграции 101 (ENABLE + FORCE + `rls_tenant`), обе таблицы в реестре `rls.ts`; не менялся.
- Files: `packages/database/prisma/migrations/20261014000105_food_booking_rules_guard/`,
  `…106_food_booking_rules_grants/`, `DATA_MODEL.md` §43.
- Tests: `tests/integration/food-booking-rules-guard.test.ts` (3: гостиничной локации отказ «Food location
  required» на обеих таблицах; `location_id` неизменяем прямым SQL; `has_table_privilege` по матрице least
  privilege). Red 3/3 (`…14-58-03Z`) → green 3/3 (`…14-58-37Z`). `check-migrations`: 110 миграций, каждая
  применяется и откатывается чисто, включая 105 и 106; сверка `schema.prisma` локально не идёт без CLI
  Prisma в клонированных `node_modules` (ограничение среды, сверяет гейт `release-checks`).
- Result: закрыт; **миграции на рабочей базе применяет владелец до выкладки.**

## 4. P1.10 Destructive confirmations

- Inventory (полная, в `plans/food-fix-02-2026-10-14.md`): без подтверждения были «Отменить заказ» (POS),
  «Аннулировать» операцию кассы, «Сторно» партии склада, «Вернуть на склад»/«Без возврата на склад» бара;
  уже защищены и не трогались: отмена/«не пришли» брони (`useConfirm`), аннулирование платежа
  (двухшаговая форма с причиной), списание и инвентаризация (форма с причиной), массовый архив товаров
  бара (`useConfirm`).
- Actions changed: четыре пробела закрыты существующим `useConfirm`/`ConfirmDialog` (DESIGN.md §14):
  заголовок-вопрос с номером или суммой, последствие в теле, кнопка названа действием («Отменить заказ»,
  «Аннулировать», «Сторнировать», «Вернуть на склад»), отказ «Оставить как есть».
- Authorization preserved: права не менялись; API-проверки (`refunds` на сторно и аннулирования,
  `property` на сторно партии) остаются; подтверждение не security-контроль.
- Double-submit protection: кнопки гаснут pending-состояниями (`useTransition`); у бара две server-формы
  заменены клиентским `BarReturnButtons` с общим pending.
- Files: `apps/web/src/app/food/order-drawer.tsx`, `food/cash-board.tsx`, `food/stock-board.tsx`,
  `apps/web/src/app/bar/return-buttons.tsx` (новый), `bar/operations/page.tsx`.
- Tests: `tests/food-ui/restaurant.spec.ts` (отмена заказа: отказ оставляет «Новый», подтверждение даёт
  «Отменён»; аннулирование кассы через диалог), `tests/food-ui/stock.spec.ts` (сторно через диалог),
  `tests/ui/bar.spec.ts` (возврат: отказ оставляет «Продано», подтверждение даёт «Возврат»).
- Result: закрыт.

## 5. Tests

Integration: food-booking-rules-guard 3/3; food-fix-02-revenue 4/4 (+ мутация 4/4 red).
Unit: полный 4747/4772 (25 красных: флейки нагрузки в 9 файлах: auto-deploy, db-restore, db-backup,
guard-run, launchd-status, body-parsers, payment-requests, rate-window, wizard-chat; порознь все зелёные,
68/69 с одним штатным пропуском); точечные (сводка, бар-контроллер, route-access, сторож хуков) 19/19.
Food UI: полный **42 passed / 0 failed / 20 skipped** за 4 мин 19 с (`…18-24-56Z-e2e-81d2`), только с
`--workers=1`.
Hospitality: `tests/ui/bar.spec.ts` 12/12 с новым диалогом возврата.
Beauty: кодом не затронута (общих файлов с ней в диффе нет).
Typecheck: чисто (`…15-10-32Z`). Lint: чисто (`…15-11-28Z`).
Классифицированный средовой случай: один полный food-ui шёл 2 ч 49 мин (14 красных по 15–18 минут на
тест): голодание под параллельной проверкой миграций на той же PostgreSQL; на свободной машине набор
зелёный. Регрессией не является (доказано повтором).

## 6. Regression

FOOD: полный food-ui зелёный (все 16 маршрутов покрыты набором: today, floor-plan, table-reservations,
dining-areas, orders, kitchen, drinks, menu, stock, cashbox, restaurant-finance, employees, shifts,
payroll, restaurant-settings, customers; плюс аналитика периода).
HOSPITALITY: бар (операции, возвраты, обзор) 12/12; `/finance` и брони кодом не тронуты;
`route-access.test.ts` зелёный по всем маршрутам.
BEAUTY: не затронута: в диффе нет её файлов; RBAC не менялся.

## 7. DB / migrations

Migration changed: нет (историческая 101 не тронута).
New migration: `20261014000105_food_booking_rules_guard` (+down), `20261014000106_food_booking_rules_grants`
(+down). Обе аддитивные, данных не меняют. **На рабочей базе применяет владелец до выкладки** (сервер
откажет автодеплою сам, ADR-152).
RLS: не менялся (был с 101). Triggers: добавлен `food_booking_guard` на две таблицы.
Grants: least privilege по API (правила без DELETE, дни без UPDATE).

## 8. Files changed

API: `food-service/restaurant.service.ts`, `hotel/organization-summary.ts` (+ unit-тест).
Web: `food/order-drawer.tsx`, `food/cash-board.tsx`, `food/stock-board.tsx`, `bar/return-buttons.tsx`
(новый), `bar/operations/page.tsx`, `management/analytics/vertical/food-period.tsx`, `lib/food-types.ts`.
DB: миграции 105, 106.
Tests: `tests/integration/food-booking-rules-guard.test.ts`, `tests/integration/food-fix-02-revenue.test.ts`
(новые), `tests/food-ui/restaurant.spec.ts`, `tests/food-ui/stock.spec.ts`, `tests/ui/bar.spec.ts`.
Docs: `DECISIONS.md` (ADR-182), `DATA_MODEL.md` (§33.2, §43, §45), `plans/food-fix-02-2026-10-14.md`,
`docs/status/2026-10-14-food-fix-02.md`, этот отчёт.

## 9. Remaining P0

Нет.

## 10. Remaining P1

P1.9 (бой): хранилище фото выключено (нет ключей S3), «WETOP Restaurant» тестовый объект в архиве: за
владельцем. Наблюдение-близнец P1.8 для гостиницы: розница бара Property не входит в поступления сводки
(HOSPITALITY-срез, не FOOD).

## 11. Remaining P2

Без изменений, список в аудите §22: тона статусов и легенда шкалы, поиск клиентов, select клиентов в
форме брони, выбор даты в заказах, правка категорий меню, дубль редактирования периодов, «Открыть заказ»
в список, мобильный план зала (перекрытие столов), «₸» хардкодом, три паттерна вкладок, названия
«Бронирования/Расписание».

## 12. Recommended NEXT TASK

FOOD-UX-01 «пакет P2 первой очереди»: статусные тона и легенда шкалы одним реестром, поиск в «Клиентах»
и в выборе клиента формы брони, выбор даты на «Заказах», правка и архив категорий меню: четыре самых
заметных для смены места, без изменения модели и прав, с red → green по каждому экрану.

STOP.
