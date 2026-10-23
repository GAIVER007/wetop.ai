# 151 Способы оплаты филиала салона и ресторана

Решение владельца 23.10.2026 («Да, делай по этой схеме»): `docs/decisions/2026-10-23-branch-payment-methods.md`,
DATA_MODEL §21.7.

Миграция аддитивная, одна новая таблица `branch_payment_method_settings` (филиал, способ, включён, порядок):

- способы только шесть денежных способов кассы филиала (CHECK `branch_payment_method_settings_method_branch`);
- способ один раз на филиал (уникальный индекс `location_id, method`), порядок неотрицательный;
- строк нет, значит умолчания: все шесть включены, поэтому выкладка у филиалов ничего не меняет;
- таблица гостиницы `payment_method_settings` (§21.6) не трогается.

RLS `rls_tenant` как у кассы филиала (миграция 86), таблица в `packages/database/src/rls.ts`.
Права: `SELECT, INSERT, UPDATE` для `wetop_app` и `wetop_service`, без `DELETE`. GRANT/REVOKE в этой же миграции
(смешанная), поэтому те же строки в `scripts/ops/restore-mixed-domain-grants.sql`.

## Применение (production)

1. Свежая резервная копия и проверка восстановления по docs/ops/backups.md.
2. `migration.sql` одной транзакцией.
3. Проверка: `\dt branch_payment_method_settings`; `SELECT has_table_privilege('wetop_app',
   'branch_payment_method_settings', 'UPDATE')` = true, `... 'DELETE'` = false; `SELECT count(*) FROM
   branch_payment_method_settings` = 0.
4. После проверки выкладываются API и UI. Без таблицы новый API отвечает ошибкой только на экране настроек
   способов и в местах приёма денег салона и ресторана, поэтому миграция применяется до выкладки кода.

## Откат

`down.sql`: удаляет таблицу. Теряется только выбор и порядок способов, филиалы возвращаются к умолчанию.
Платежи и операции кассы не меняются.
