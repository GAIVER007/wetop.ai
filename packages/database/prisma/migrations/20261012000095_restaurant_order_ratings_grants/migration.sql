-- Права оценок (DATA_MODEL §39): только чтение и запись новой; миграция 26 выдаёт полный набор, лишнее отзывается
GRANT SELECT, INSERT ON restaurant_order_ratings TO wetop_app, wetop_service;
REVOKE UPDATE, DELETE, TRUNCATE ON restaurant_order_ratings FROM wetop_app, wetop_service;
