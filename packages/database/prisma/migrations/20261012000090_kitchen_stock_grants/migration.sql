-- Права вынесены отдельно (образец 059, 082). Лента kitchen_stock_movements только дописывается:
-- миграция 26 выдаёт новым таблицам всё через ALTER DEFAULT PRIVILEGES, поэтому UPDATE и DELETE отзываются явно (урок Q-REST-7).
GRANT SELECT, INSERT, UPDATE, DELETE ON kitchen_products, kitchen_stock_lots TO wetop_app, wetop_service;
GRANT SELECT, INSERT ON kitchen_stock_movements TO wetop_app, wetop_service;
REVOKE UPDATE, DELETE ON kitchen_stock_movements FROM wetop_app, wetop_service;
