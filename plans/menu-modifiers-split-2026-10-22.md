# План: модификаторы блюд и деление счёта (22.10.2026)

Решение: `docs/decisions/2026-10-22-menu-modifiers-split.md`. Модель: DATA_MODEL §33.7. Ветка `hermes/fmod-20261022`.
Владелец 22.10.2026: «Да, оба: план + миграция + экраны».

| Срез | Что | Проверка |
|---|---|---|
| 1 | План и решение | ревью |
| 2 | Миграция 144 `20261022000144_menu_modifiers_split`: `menu_modifier_groups`, `menu_modifiers`, `menu_item_modifier_groups`, `restaurant_order_item_modifiers`, `restaurant_payment_items`; триггеры принадлежности, освобождения строк при аннулировании, запрета удаления оплаченной строки; RLS как у соседей; GRANT/REVOKE + копия в `restore-mixed-domain-grants.sql`; schema.prisma вручную; DATA_MODEL §33.7; откат | `prisma validate`, `migrate diff` без дрейфа, `test:schema`, unit migrations-*, integration db-restore-prod и beauty-release-schema |
| 3 | Домен `packages/domain/src/food/modifiers.ts`: разбор группы и модификаторов, проверка выбора (min/max/обязательная, чужой модификатор), цена строки, ключ строки, `splitEvenly`, сумма по выбранным строкам; `parseOrderItems` принимает `modifierIds`, `parseFoodPayment` принимает `itemIds` | unit (сначала красные) |
| 4 | API: `GET/POST/PATCH food-service/menu/modifier-groups`, `PUT menu/items/:id/modifier-groups`; меню отдаёт группы блюда; создание и дозаказ с `modifierIds` и `notes`; оплата с `itemIds`; аннулирование освобождает строки; заказ отдаёт модификаторы строки и отметку «оплачено» | route-access, integration `restaurant-modifiers-split.test.ts` |
| 5 | Web: вкладка «Добавки» в «Меню», раздел «Добавки и размеры» в окне блюда; окно выбора добавок в выборе блюд (стойка и `/waiter`), корзина показывает выбор и комментарий; кухня и бар показывают модификаторы и комментарий; карточка заказа: «Разделить счёт» (Поровну / По позициям) | unit web, design-*, typecheck:web, lint |
| 6 | food-ui `modifiers-split.spec.ts`: группы, привязка, заказ с выбором и комментарием, кухня, деление по позициям и поровну, заказ закрыт; 390 и 1440 без горизонтальной прокрутки, скриншоты | Playwright на реальном API |

Не делаем: списание склада по модификаторам, деление одной строки на части (строка оплачивается целиком),
печать отдельных чеков на каждого гостя.

Откат: `down.sql` миграции 144, затем код до этой ветки (цены строк уже заморожены, суммы заказов верны).
