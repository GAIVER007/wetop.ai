-- Состояние до миграции 106: права по умолчанию миграции 26 (как у down.sql миграции 59)
GRANT SELECT, INSERT, UPDATE, DELETE ON food_booking_rules TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON food_closed_days TO wetop_app, wetop_service;
