-- Откат 20260924000019_seller_profiles: таблица новая, данных гостей в ней нет — удаляется вместе с перечислениями.
DROP TABLE IF EXISTS "seller_profiles";
DROP TYPE IF EXISTS "SellerReplyLength";
DROP TYPE IF EXISTS "SellerAddressForm";
