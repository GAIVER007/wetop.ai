-- Отчёт фазы Business + Location (миграция 20260927000029_business_location, ADR-104;
-- план plans/phase-business-location-2026-09-27.md §6). Запуск:
--   psql "$DATABASE_URL" -f scripts/ops/phase-business-location-report.sql
-- Ничего не меняет — только чтение. Владелец снимает его до и после миграции: до — разделы про
-- businesses/locations пусты (таблиц нет — psql скажет об этом и продолжит), счётчики строк совпадают с «после».

\echo '=== Счётчики строк существующих таблиц (до/после должны совпасть) ==='
SELECT 'organizations' AS tbl, count(*) FROM organizations
UNION ALL SELECT 'properties', count(*) FROM properties
UNION ALL SELECT 'reservations', count(*) FROM reservations
UNION ALL SELECT 'reservation_items', count(*) FROM reservation_items
UNION ALL SELECT 'inventory_units', count(*) FROM inventory_units
UNION ALL SELECT 'guests', count(*) FROM guests
UNION ALL SELECT 'folios', count(*) FROM folios
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'daily_rates', count(*) FROM daily_rates
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
ORDER BY 1;

\echo '=== Цепочки: Business на организацию (ожидается ровно 1 у организаций с объектами) ==='
SELECT o.name AS organization, count(b.id) AS businesses
  FROM organizations o LEFT JOIN businesses b ON b.organization_id = o.id
 GROUP BY o.id, o.name ORDER BY o.name;

\echo '=== Связность: каждый Property с организацией → Location → Business той же организации ==='
SELECT count(*)                                                         AS properties_total,
       count(*) FILTER (WHERE p.organization_id IS NULL)                AS ownerless,
       count(*) FILTER (WHERE p.organization_id IS NOT NULL
                          AND p.location_id IS NULL)                    AS missing_location,
       count(*) FILTER (WHERE p.location_id IS NOT NULL
                          AND b.organization_id IS DISTINCT FROM p.organization_id) AS chain_mismatch
  FROM properties p
  LEFT JOIN locations l ON l.id = p.location_id
  LEFT JOIN businesses b ON b.id = l.business_id;
-- ownerless > 0 — «ничьи» объекты: location_id у них NULL сознательно (план §2), решение владельца по каждому.
-- missing_location и chain_mismatch обязаны быть 0.

\echo '=== Location без Property (быть не должно после backfill: Location создавались по объектам) ==='
SELECT count(*) AS locations_without_property
  FROM locations l WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.location_id = l.id);

\echo '=== reporting_currency (уточнение 4: неоднозначное — NULL, не угадано) ==='
SELECT count(*)                                          AS organizations_total,
       count(*) FILTER (WHERE reporting_currency IS NOT NULL) AS filled,
       count(*) FILTER (WHERE reporting_currency IS NULL)     AS left_null
  FROM organizations;

\echo '--- организации, оставшиеся без reporting_currency, и почему ---'
SELECT o.id, o.name,
       (SELECT count(DISTINCT p.currency) FROM properties p WHERE p.organization_id = o.id) AS distinct_property_currencies
  FROM organizations o
 WHERE o.reporting_currency IS NULL
 ORDER BY o.name;
-- 0 валют — у организации нет объектов (валюту выберет онбординг); >1 — разные валюты объектов (решение владельца).

\echo '=== Gate будущего NOT NULL на properties.location_id (план §2: 0 либо решение владельца по строке) ==='
SELECT count(*) AS properties_location_id_null FROM properties WHERE location_id IS NULL;
SELECT id, name, organization_id FROM properties WHERE location_id IS NULL ORDER BY created_at;
