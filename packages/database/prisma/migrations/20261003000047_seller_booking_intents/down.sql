-- Откат 20261003000047_seller_booking_intents: убрать намерения брони продавца. Брони, созданные из чата, остаются
-- обычными бронями; связь «бронь ← намерение» теряется — перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "seller_booking_intents";
DROP TYPE IF EXISTS "SellerBookingIntentState";
