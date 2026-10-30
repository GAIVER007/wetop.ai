# 173 Выплаты зарплаты по дням и тип расхода

Владелец 30.10.2026 («Да всё окей чётко», затем «Давай»): «Зарплата» с колонкой «Как платим», выплаты по дням,
расход «Ежедневный / Разовый». DATA_MODEL PAYROLL-DAILY-20261030.

Аддитивно, прежний код новые колонки не читает:
- `employee_pay_settings`: `pay_frequency` (`DAILY`, `WEEKLY`, `MONTHLY`, по умолчанию `MONTHLY`: у всех как сейчас),
  `pay_weekday` (1–7, только у `WEEKLY`, CHECK), `pay_method` (чем обычно платим, необязательно).
- `restaurant_cash_operations`: `pay_date` (за какой день выплата, только с `employee_id`, CHECK), `expense_type`.
- `cash_operations`: `expense_type` (только у `EXPENSE`, CHECK). Старые расходы `NULL` («не указан»).
Новых таблиц и прав нет.

## Применение (production)

1. Резервная копия по docs/ops/backups.md.
2. `migration.sql` (сервер: `sudo -n wetop-release-migrate`).
3. Проверка: `\d employee_pay_settings` с `pay_frequency`, у всех строк `MONTHLY`.
4. Новый код читает новые колонки: выкладка после миграции (сервер ждёт её сам).

## Откат

`down.sql`: данные выплат не теряются (операции кассы остаются), теряются только день выплаты, частота и тип расхода.
