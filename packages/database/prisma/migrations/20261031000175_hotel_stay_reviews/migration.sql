-- 175 HOTEL-REVIEWS-20261031: ссылка на отзыв после выезда (гостиница). Аддитивно: прежний код таблицу не читает.

BEGIN;

CREATE TABLE "hotel_stay_reviews" (
  "reservation_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "stars" SMALLINT,
  "comment" TEXT,
  "submitted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_stay_reviews_pkey" PRIMARY KEY ("reservation_id"),
  CONSTRAINT "hotel_stay_reviews_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "hotel_stay_reviews_reservation_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "hotel_stay_reviews_stars_check" CHECK ("stars" IS NULL OR "stars" BETWEEN 1 AND 5),
  CONSTRAINT "hotel_stay_reviews_comment_check" CHECK ("comment" IS NULL OR char_length("comment") <= 2000),
  CONSTRAINT "hotel_stay_reviews_submitted_check" CHECK (("submitted_at" IS NULL) = ("stars" IS NULL))
);

ALTER TABLE "hotel_stay_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hotel_stay_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "hotel_stay_reviews" FOR SELECT TO wetop_app
  USING (EXISTS (
    SELECT 1 FROM reservations r
    JOIN properties p ON p.id = r.property_id
    WHERE r.id = hotel_stay_reviews.reservation_id
      AND p.organization_id = app_current_org()
  ));

REVOKE ALL ON TABLE "hotel_stay_reviews" FROM wetop_app, wetop_service;
GRANT SELECT ON TABLE "hotel_stay_reviews" TO wetop_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "hotel_stay_reviews" TO wetop_service;

COMMIT;
