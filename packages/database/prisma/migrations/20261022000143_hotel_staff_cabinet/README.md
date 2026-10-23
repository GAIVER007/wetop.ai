# 143 Кабинет горничной и ресепшена гостиницы

Решение владельца 22.10.2026 («Да, делать: план + миграция 143 + экраны»):
`docs/decisions/2026-10-22-hotel-staff-cabinet.md`, DATA_MODEL §4.1, план `plans/hotel-staff-cabinet-2026-10-22.md`.

Миграция аддитивная:

- `housekeeping_events.user_id` получает FK на `users` (ON DELETE SET NULL); ссылки на несуществующих людей до этого
  обнуляются тем же `migration.sql`;
- `housekeeping_events.employee_id` (FK `employees`, NULL, ON DELETE SET NULL): чья уборка, для сдельной оплаты и
  «Моего месяца»; индекс `(employee_id, created_at)`;
- `inventory_units.housekeeping_assignee_id` (FK `employees`, NULL, ON DELETE SET NULL): «Кто убирает»;
- `employee_pay_settings.per_cleaning_minor` bigint NOT NULL DEFAULT 0, CHECK ≥ 0: ставка за одну уборку;
- триггер `hotel_housekeeping_employee_guard` на обеих таблицах: сотрудник того же бизнеса, что филиал объекта места.

GRANT/REVOKE нет: новые столбцы покрыты правами таблиц. RLS не меняется. `MembershipRole` не меняется.

## Применение (production)

1. Свежая резервная копия и проверка восстановления по docs/ops/backups.md.
2. `migration.sql` одной транзакцией.
3. Проверка: `\d housekeeping_events` показывает `employee_id` и оба FK; `\d inventory_units` показывает
   `housekeeping_assignee_id`; `SELECT count(*) FROM employee_pay_settings WHERE per_cleaning_minor <> 0` = 0.
4. После проверки выкладываются API и UI.

## Откат

`down.sql`: снимает триггеры, функцию, индексы, ограничения и столбцы. Теряются назначения уборки, сдельные ставки и
привязка уборок к сотрудникам; журнал статусов уборки остаётся. Без CASCADE.
