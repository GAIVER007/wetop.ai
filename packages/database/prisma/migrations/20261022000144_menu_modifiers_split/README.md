# 144 Модификаторы блюд и деление счёта по позициям

Решение владельца 22.10.2026 («Да, оба: план + миграция + экраны»): `docs/decisions/2026-10-22-menu-modifiers-split.md`,
DATA_MODEL §33.7, план `plans/menu-modifiers-split-2026-10-22.md`.

Миграция аддитивная, пять новых таблиц:

- `menu_modifier_groups` (группа бизнеса: «Размер», «Добавки»; `min_select`, `max_select`, обязательная = `min_select >= 1`);
- `menu_modifiers` (модификатор группы, `price_delta` в minor units, может быть отрицательной);
- `menu_item_modifier_groups` (какие группы у блюда, порядок);
- `restaurant_order_item_modifiers` (снимок выбранного у строки заказа: группа, имя, прибавка);
- `restaurant_payment_items` (оплата по позициям: платёж держит строки; частичный уникальный индекс
  `order_item_id WHERE released_at IS NULL` не даёт оплатить строку дважды).

Триггеры: `restaurant_modifier_guard` (принадлежность бизнесу, неизменность родителя, строка платежа из заказа платежа),
`restaurant_payment_items_release` (аннулирование платежа освобождает его строки), `restaurant_order_item_paid_guard`
(оплаченную строку нельзя удалить). RLS `rls_tenant` как у соседей ресторана, таблицы в `packages/database/src/rls.ts`.

Права: GRANT/REVOKE в этой же миграции (смешанная), поэтому те же строки скопированы в
`scripts/ops/restore-mixed-domain-grants.sql` (восстановление копии без прав).

## Применение (production)

1. Свежая резервная копия и проверка восстановления по docs/ops/backups.md.
2. `migration.sql` одной транзакцией.
3. Проверка: `\dt menu_modifier*`, `\dt restaurant_payment_items`; `SELECT has_table_privilege('wetop_app',
   'restaurant_payment_items', 'INSERT')` = true, `... 'DELETE'` = false.
4. После проверки выкладываются API и UI.

## Откат

`down.sql`: снимает триггеры, таблицы и функции. Теряются группы модификаторов, снимки выбора у строк и разбивка
платежей по строкам; цены строк уже заморожены в `restaurant_order_items.price`, суммы заказов и платежи верны.
Без CASCADE.
