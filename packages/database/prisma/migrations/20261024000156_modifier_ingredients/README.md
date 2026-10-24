# 156 Добавки списывают продукты склада

Решение: план `plans/2026-10-24-kitchen-for-all-verticals.md` (срез K2), DATA_MODEL §62.2, «Да» владельца
24.10.2026. В production НЕ применено: применяет владелец, после 155.

Что добавляет:

- `menu_modifier_ingredients`: `modifier_id` FK `menu_modifiers` (ON DELETE CASCADE), `product_id` FK
  `kitchen_products`, `norm_qty` numeric(14,3) > 0 на одну порцию, `sort_order`; UNIQUE `(modifier_id, product_id)`.
  Продукт того же бизнеса, что группа добавки (триггер). RLS ENABLE + FORCE, права как у меню.
- Данные не меняются: у существующих добавок продуктов нет, они как раньше меняют только цену.

## Применение

1. Свежая резервная копия с проверенным восстановлением.
2. `mig status`, `mig deploy` по `docs/deploy.md` (вместе с 155 или после неё).
3. Проверка: `SELECT count(*) FROM menu_modifier_ingredients;` = 0.

## Откат

`down.sql` удаляет таблицу и триггер. Записанные движения склада остаются в ленте.
