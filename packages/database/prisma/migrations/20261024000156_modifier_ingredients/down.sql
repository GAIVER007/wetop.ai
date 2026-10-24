-- Откат 156: добавки снова только меняют цену, продукты со склада по ним не списываются.
-- Уже записанные движения склада остаются (лента только дописывается), ссылок на эту таблицу у них нет.
BEGIN;
DROP TABLE "menu_modifier_ingredients";
DROP FUNCTION menu_modifier_ingredient_guard();
COMMIT;
