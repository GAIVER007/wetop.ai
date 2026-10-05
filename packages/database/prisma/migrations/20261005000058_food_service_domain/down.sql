-- Application rollback leaves Food data intact. Destructive schema rollback requires empty tables.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM dining_areas) OR EXISTS (SELECT 1 FROM dining_tables) OR EXISTS (SELECT 1 FROM service_periods) OR EXISTS (SELECT 1 FROM restaurant_reservations) OR EXISTS (SELECT 1 FROM table_assignments) THEN
  RAISE EXCEPTION 'Food data present: refuse destructive rollback';
 END IF;
END $$;
DROP TABLE table_assignments;
DROP TABLE restaurant_reservations;
DROP TABLE dining_tables;
DROP TABLE service_periods;
DROP TABLE dining_areas;
DROP FUNCTION food_seated_guard();
DROP FUNCTION food_ownership_guard();
DROP TYPE "RestaurantReservationSource";
DROP TYPE "RestaurantReservationStatus";
