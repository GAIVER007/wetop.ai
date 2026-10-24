# 142 Станции ресторана и официант у брони

Решение владельца 21.10.2026 (голосом) и одобрение изменений БД и прав 22.10.2026:
`docs/decisions/2026-10-22-waiter-stations.md`, DATA_MODEL §33.6, план `plans/waiter-stations-2026-10-22.md`.

Миграция аддитивная:

- `menu_categories.station` (`MenuStation` = `KITCHEN | BAR`, NOT NULL DEFAULT `KITCHEN`); категории, чьё название
  совпадает с прежней регуляркой экрана «Напитки», получают `BAR`;
- `restaurant_order_items.station` (снимок станции категории), `status` (`OrderItemStatus` = `NEW | COOKING | READY |
  SERVED`), `ready_at`; CHECK: `ready_at` есть ровно у READY и SERVED; строки старых заказов получают статус заказа;
- `restaurant_reservations.employee_id` (FK `employees`, NULL) и триггер «сотрудник того же бизнеса».

GRANT/REVOKE нет: новые столбцы покрыты правами таблиц, типы открыты PUBLIC. RLS не меняется.

## Применение (production)

1. Свежая резервная копия и проверка восстановления по docs/ops/backups.md.
2. `migration.sql` одной транзакцией.
3. Проверка: `SELECT station, count(*) FROM menu_categories GROUP BY 1`; у строк открытых заказов статус равен статусу
   заказа; `\d restaurant_reservations` показывает `employee_id`.
4. После проверки выкладываются API и UI.

## Откат

`down.sql`: снимает триггер, столбцы и типы. Теряются станции категорий, статусы строк и «кто принял бронь»; статус
заказа целиком остаётся в `restaurant_orders.status`, поэтому старый код работает. Без CASCADE.
