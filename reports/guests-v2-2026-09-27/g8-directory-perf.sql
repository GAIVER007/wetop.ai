-- «Гости v2», G8: замер SQL-справочника на 20 000 вымышленных гостей. Всё в транзакции, в конце ROLLBACK.
-- Запуск на ЛОКАЛЬНОЙ базе: psql "postgresql://postgres@127.0.0.1:55432/pmslocal" -f reports/guests-v2-2026-09-27/g8-directory-perf.sql
\timing off
BEGIN;
-- вымышленная организация, объект, категория; 20 000 гостей по два проживания (выехал + будущая бронь)
CREATE TEMP TABLE perf_ids AS SELECT gen_random_uuid() AS org, gen_random_uuid() AS prop, gen_random_uuid() AS typ;
INSERT INTO organizations (id, name) SELECT org, 'Perf G8' FROM perf_ids;
INSERT INTO properties (id, organization_id, name, timezone, currency, check_in_time, check_out_time, updated_at)
  SELECT prop, org, 'Perf G8', 'Asia/Almaty', 'KZT', '14:00', '12:00', now() FROM perf_ids;
INSERT INTO accommodation_types (id, property_id, code, name, kind, capacity_adults, updated_at)
  SELECT typ, prop, 'PERF', 'Perf', 'PRIVATE_ROOM', 2, now() FROM perf_ids;
INSERT INTO guests (id, organization_id, first_name, last_name, updated_at)
  SELECT gen_random_uuid(), (SELECT org FROM perf_ids), 'Фикстура', 'Перф' || i, now() FROM generate_series(1, 20000) i;
CREATE TEMP TABLE perf_res AS
  SELECT g.id AS guest_id, gen_random_uuid() AS r1, gen_random_uuid() AS i1, gen_random_uuid() AS r2, gen_random_uuid() AS i2,
    (random() * 200)::int AS back
  FROM guests g WHERE g.organization_id = (SELECT org FROM perf_ids);
INSERT INTO reservations (id, property_id, confirmation_number, source, status, arrival_date, departure_date, adults, currency, total_amount, primary_guest_id, updated_at)
  SELECT r1, (SELECT prop FROM perf_ids), 'PF-' || r1, 'DESK'::"ReservationSource", 'CHECKED_OUT'::"ReservationStatus", current_date - back - 2, current_date - back, 1, 'KZT', 0, guest_id, now() FROM perf_res
  UNION ALL
  SELECT r2, (SELECT prop FROM perf_ids), 'PF-' || r2, 'DESK'::"ReservationSource", 'CONFIRMED'::"ReservationStatus", current_date + 5, current_date + 7, 1, 'KZT', 0, guest_id, now() FROM perf_res WHERE back % 3 = 0;
INSERT INTO reservation_items (id, reservation_id, accommodation_type_id, arrival_date, departure_date, price, status, updated_at)
  SELECT i1, r1, (SELECT typ FROM perf_ids), current_date - back - 2, current_date - back, 0, 'CHECKED_OUT'::"ReservationStatus", now() FROM perf_res
  UNION ALL
  SELECT i2, r2, (SELECT typ FROM perf_ids), current_date + 5, current_date + 7, 0, 'CONFIRMED'::"ReservationStatus", now() FROM perf_res WHERE back % 3 = 0;
INSERT INTO stay_guests (reservation_item_id, guest_id, is_primary)
  SELECT i1, guest_id, true FROM perf_res UNION ALL SELECT i2, guest_id, true FROM perf_res WHERE back % 3 = 0;
ANALYZE guests; ANALYZE stay_guests; ANALYZE reservation_items;
-- тот же запрос, что `directory()`: раздел ALL, последний визит за 30 дней, порядок «ближайший заезд», страница 1
EXPLAIN (ANALYZE, BUFFERS, SUMMARY)
WITH f AS (
  SELECT g."id", g."last_name", g."first_name",
    COUNT(ri."id") FILTER (WHERE ri."status"::text IN ('CHECKED_IN', 'CHECKED_OUT'))::int AS "visits",
    COALESCE(BOOL_OR(ri."status"::text = 'CHECKED_IN'), false) AS "inhouse",
    COALESCE(BOOL_OR(ri."status"::text IN ('CONFIRMED', 'TENTATIVE') AND ri."departure_date" >= current_date), false) AS "expected",
    MAX(ri."departure_date") FILTER (WHERE ri."status"::text = 'CHECKED_OUT') AS "last_departure",
    MIN(ri."arrival_date") FILTER (WHERE ri."status"::text IN ('CONFIRMED', 'TENTATIVE') AND ri."departure_date" >= current_date) AS "next_arrival"
  FROM "guests" g
  LEFT JOIN "stay_guests" sg ON sg."guest_id" = g."id"
  LEFT JOIN "reservation_items" ri ON ri."id" = sg."reservation_item_id"
  WHERE g."organization_id" = (SELECT org FROM perf_ids)
  GROUP BY g."id"
), s AS (
  SELECT f.*, CASE WHEN f."inhouse" THEN 'INHOUSE' WHEN f."expected" THEN 'EXPECTED'
    WHEN f."last_departure" >= current_date - 30 THEN 'RECENT' ELSE 'NONE' END AS "state" FROM f
)
SELECT s."id"::text FROM s
WHERE s."last_departure" BETWEEN current_date - 30 AND current_date
ORDER BY s."next_arrival" ASC NULLS LAST, s."last_name", s."first_name", s."id"
LIMIT 100 OFFSET 0;
ROLLBACK;
