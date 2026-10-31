# 176 Поля подписки и расхода WETOP

Владелец 31.10.2026 «Да делай». DATA_MODEL PLATFORM-FIELDS-20261031.

Аддитивно: `platform_subscriptions` (promo_code, discount_percent, auto_renew), `platform_expenses` (payee, project,
recurring, document_ref). Новых таблиц и прав нет.

## Применение (production)

1. Резервная копия по docs/ops/backups.md.
2. `migration.sql` (сервер: `sudo -n wetop-release-migrate`).
3. Проверка: `\d platform_subscriptions`, у всех строк `auto_renew = true`; `\d platform_expenses`, `recurring = false`.

## Откат

`down.sql`: теряются только промокоды, скидки, отметки автопродления и поля расходов; суммы и даты остаются.
