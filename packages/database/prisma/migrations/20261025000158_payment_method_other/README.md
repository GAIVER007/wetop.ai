# 158 Способ оплаты «Другое»

Утверждено владельцем 25.10.2026 («Давай да» на DATA_MODEL `PAYMENT-OTHER-PROPOSAL-20261025`):
`docs/decisions/2026-10-25-payment-method-other.md`.

Аддитивно, новых таблиц нет:

- `PaymentMethod` += `OTHER` («Другое»: ссылка на оплату, кошелёк, приложение банка);
- CHECK `branch_payment_method_settings_method_branch` пускает `OTHER`;
- таблицы гостиницы (`payments`, `cash_operations`, `cash_reconciliations`, `payment_method_settings`) закрыты для
  `OTHER` новыми CHECK, `payment_requests` уже закрыта своей проверкой;
- строк настроек миграция не создаёт: без строки «Другое» выключено (домен), у действующих филиалов ничего не меняется.

## Применение (production)

1. Свежая резервная копия и проверка восстановления по docs/ops/backups.md.
2. `migration.sql` одной транзакцией.
3. Проверка: `SELECT 'OTHER'::"PaymentMethod"` без ошибки; `\d branch_payment_method_settings` показывает `OTHER` в
   CHECK; `SELECT count(*) FROM branch_payment_method_settings WHERE method::text = 'OTHER'` = 0.
4. Код можно выкладывать до и после миграции: старый код `OTHER` не знает; новый без миграции получит ошибку
   базы только при попытке включить или принять «Другое».

## Откат

`down.sql`: отказывает, если «Другим» уже принимали деньги. Иначе удаляет строки настроек `OTHER` и возвращает
CHECK миграции 151 и пересоздаёт тип `PaymentMethod` без `OTHER` (как откат 141).
