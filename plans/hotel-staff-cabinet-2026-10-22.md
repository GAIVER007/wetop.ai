# План: кабинет горничной и ресепшена, зарплата и график гостиницы (22.10.2026)

Решение владельца 22.10.2026: «Да, делать: план + миграция 143 + экраны». Решение и обоснование схемы:
`docs/decisions/2026-10-22-hotel-staff-cabinet.md`. Инвентаризация: `/tmp/personnel/audit/D-roles-inventory.md` §4, S10.

## Что есть сейчас (код ветки hermes/hstaff-20261022)

- Уборка: статус у места `inventory_units.housekeeping_status` (DIRTY / CLEAN / INSPECTED), журнал
  `housekeeping_events(inventory_unit_id, from_status, to_status, user_id, created_at)`. `user_id` без FK и не
  заполняется: `UnitsRepository.setHousekeeping` пишет событие без автора. Смена статуса `POST /units/:code/housekeeping`
  под правом `desk`. Кто убирает номер, не хранится нигде.
- Задачи стойки `desk_tasks`: исполнитель `assignee_user_id → users` (FK есть), закрытие `done_at`/`done_by_id`.
  `GET/POST/PATCH /tasks` под `desk`: видит и закрывает всё любой с `desk`.
- Сотрудники гостиницы: таблица `employees` общая (бизнес + `employee_locations`), но гостиница своих сотрудников не
  создаёт: «Сотрудники и доступ» (`/team`) приглашает только учётные записи; «Личный кабинет» (EMPLOYEE) в приглашении
  гостиницы скрыт (`team-board.tsx`). У гостиницы объект и филиал один к одному (`properties.location_id UNIQUE`).
- Зарплата: `monthPayrollRows` (оклад, процент от закрытых заказов/выполненных записей, премии и штрафы, выплаты из
  кассы филиала) и `/payroll` открыты только `BRANCH_CASH_VERTICALS = FOOD_SERVICE, BEAUTY`; у гостиницы нет
  возможности `branch.payroll`, `/payroll` уводит на «Главную» (`features.ts`: `BF`).
- Касса филиала (`restaurant_cash_operations`) для гостиницы закрыта триггером `restaurant_cash_guard`
  (только FOOD_SERVICE, BEAUTY). У гостиницы своя касса объекта `cash_operations` (§21) без сотрудника и периода.
- График: недельный шаблон `working_hours` + `time_offs` общий; экран смен есть у ресторана (`/employees/shifts`,
  `/food-service/shifts` под возможностью `food.staff`) и салона (`/beauty/schedule`).
- Кабинет `/my-work`: `employee-portal` пускает только BEAUTY и FOOD_SERVICE.

## Срезы (коммит на каждый)

1. **План и решение** (этот файл + `docs/decisions/2026-10-22-hotel-staff-cabinet.md`).
2. **Миграция 143** `20261022000143_hotel_staff_cabinet` (migration.sql + down.sql + README.md):
   - `housekeeping_events.user_id` → FK `users` ON DELETE SET NULL (мусор обнуляется до FK);
   - `housekeeping_events.employee_id` uuid NULL → FK `employees` ON DELETE SET NULL: чья уборка (для зарплаты и «Моего
     месяца»), берётся из назначения в момент «Убрано»;
   - `inventory_units.housekeeping_assignee_id` uuid NULL → FK `employees` ON DELETE SET NULL: «Кто убирает»;
   - `employee_pay_settings.per_cleaning_minor` bigint NOT NULL DEFAULT 0 CHECK ≥ 0: сдельная ставка за уборку;
   - триггер `hotel_housekeeping_employee_guard`: сотрудник того же бизнеса, что филиал объекта места;
   - индексы `(employee_id, created_at)` и `(housekeeping_assignee_id)`.
   GRANT/REVOKE нет (столбцы существующих таблиц). schema.prisma вручную, DATA_MODEL §4.1 новый подраздел.
   Проверки: `prisma validate`, `generate`, `migrate diff` без дрейфа, `test:schema`, unit migrations-*,
   organization-migration-order, integration db-restore-prod и beauty-release-schema.
3. **Права и API** (без нового права, по образцу `waiterSelf`, но на `self`):
   - `GET /hotel-staff/me` (`self`): свой сотрудник гостиницы, «Мои уборки сегодня» (места, назначенные мне, со
     статусом), «Мои задачи» (открытые задачи с `assignee_user_id = я` и сроком не позже сегодня + сделанные сегодня),
     неделя графика, зарплата за месяц (тот же `monthPayrollRows`), «Мой месяц» (уборок, задач сделано, смен);
   - `POST /hotel-staff/me/units/:code/clean` (`self`): только своё назначенное место, DIRTY → CLEAN, автор и
     сотрудник в журнале; чужое место 403;
   - `POST /hotel-staff/me/tasks/:id/done` (`self`): только своя задача;
   - `GET /hotel-staff/employees` (`desk`), `POST /hotel-staff/employees` (`staff`): сотрудники гостиницы;
   - `PUT /units/:code/housekeeping-assignee` (`desk`): руководитель или стойка назначает, кто убирает;
   - `GET /hotel-staff/shifts`, `PUT /hotel-staff/employees/:id/working-hours`: график, тот же код, что у ресторана;
   - `/food-service/payroll`, условия оплаты и премии открываются HOSPITALITY (`BRANCH_PAYROLL_VERTICALS`, возможность
     `branch.payroll` у гостиницы); база гостиницы: сдельно = уборки месяца × ставка. Выплата из кассы гостинице
     закрыта словами (касса объекта другая, см. решение): только начисления.
   - уборка стойкой (`POST /units/:code/housekeeping`) тоже пишет автора и назначенного сотрудника.
   - Тесты: `route-access.test.ts`, HTTP `tests/integration/core-security/hotel-housekeeping-scope.test.ts`
     (сначала красный): горничная видит и отмечает только свои уборки, чужая 403, шахматка/финансы/гости 403.
4. **Web**: `/my-work` для HOSPITALITY (`HotelCabinet`: «Мои уборки сегодня», «Мои задачи», график, зарплата, «Мой
   месяц» одной строкой; телефон первым, кнопки ≥ `--touch-target`, классы `.hk-`); «Кто убирает» в карточке места
   номерного фонда; меню «Персонал» гостиницы: «График работы» (`/employees/shifts`), «Зарплата» (`/payroll`);
   «Моя работа» в меню профиля гостиницы; `/team` гостиницы: уровни «Без входа» и «Личный кабинет» в едином
   `StaffAccessPicker` (сначала создаётся сотрудник, потом приглашение с `employeeId`). Тесты навигации и прав,
   `docs/design/history.md`.
5. **UI-проверка**: spec на стенде с настоящим API (если поднимется), скриншоты `/tmp/personnel/audit/D-me/hk-*.png`.

## Откат

`down.sql` миграции 143 снимает триггер, индексы, FK и столбцы; код до 143 их не читает. Теряются назначения уборки,
сдельные ставки и привязка уборок к сотрудникам; журнал статусов остаётся.

## Не входит

- Выплата зарплаты гостиницы из кассы объекта (нужен `employee_id`/`period` в `cash_operations` §21 и сверка с
  отчётами кассы гостиницы): отдельное решение владельца.
- Ежедневный план уборки по датам (назначение хранится до смены, без даты), проверка «Проверено» горничной.
- Уведомления горничной (Telegram) и задачи-повторы.
