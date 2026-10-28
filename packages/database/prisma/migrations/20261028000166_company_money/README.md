# 166 Деньги компании WETOP

Решение владельца 28.10.2026: кабинет компании WETOP, «считаем в долларах», тарифы и цены вводит сам позже
(DATA_MODEL §63, `docs/decisions/2026-10-28-feat-company-money-20261028.md`).

Пять новых таблиц компании, не организаций: `platform_plans`, `platform_subscriptions`, `platform_payments`,
`platform_expenses`, `platform_team_members`. RLS нет, `wetop_app` прав не имеет, пишет только `wetop_service`.
Удаления нет: ошибочная оплата или расход отменяются отметкой. Существующие таблицы и данные не меняются.

## Применение (production)

1. Свежая копия базы (docs/ops/backups.md).
2. `migration.sql`.
3. Проверка: `SELECT count(*) FROM platform_plans` даёт 0, а
   `SELECT has_table_privilege('wetop_app','platform_payments','SELECT')` даёт `f`.

Код к миграции готов заранее: пока таблиц нет, кабинет показывает деньги словами «не подключено», остальное работает.

## Откат

`down.sql`. Если в таблицах уже есть записи, откат останавливается: возврат только по копии базы.
