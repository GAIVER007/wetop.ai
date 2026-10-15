-- Откат стражи §43: триггеры и функция уходят, таблицы и данные целы
DROP TRIGGER IF EXISTS food_booking_guard ON food_booking_rules;
DROP TRIGGER IF EXISTS food_booking_guard ON food_closed_days;
DROP FUNCTION IF EXISTS food_booking_guard();
