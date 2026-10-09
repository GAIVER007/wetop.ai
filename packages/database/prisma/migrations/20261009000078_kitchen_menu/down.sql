-- Application rollback leaves menu data intact. Destructive schema rollback requires empty tables.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM menu_categories) OR EXISTS (SELECT 1 FROM menu_items) OR EXISTS (SELECT 1 FROM location_menu_items) THEN
  RAISE EXCEPTION 'Menu data present: refuse destructive rollback';
 END IF;
END $$;
DROP TABLE location_menu_items;
DROP TABLE menu_items;
DROP TABLE menu_categories;
DROP FUNCTION menu_ownership_guard();
