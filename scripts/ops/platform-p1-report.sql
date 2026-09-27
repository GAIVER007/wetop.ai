-- Отчёт backfill Platform P1 (миграция 20260927000030_platform_p1_business_location, ADR-104, Q-199 вариант Б).
-- Запуск: psql "$DATABASE_URL" -f scripts/ops/platform-p1-report.sql — или одним запросом ниже в Supabase SQL Editor.
-- Ничего не меняет — только чтение. Ожидание на рабочей базе (один объект Luxx):
--   businesses: total 1 (HOSPITALITY, ACTIVE); locations: total 1; properties: without_location 0;
--   цепочка: broken_chain 0; reporting_currency: ambiguous 0.
SELECT section, metric, value FROM (
  SELECT 10 AS ord, 'businesses' AS section, 'total / hospitality / active' AS metric,
         concat(count(*), ' / ', count(*) FILTER (WHERE vertical = 'HOSPITALITY'), ' / ', count(*) FILTER (WHERE status = 'ACTIVE')) AS value
    FROM businesses
  UNION ALL
  SELECT 20, 'locations', 'total / active',
         concat(count(*), ' / ', count(*) FILTER (WHERE status = 'ACTIVE'))
    FROM locations
  UNION ALL
  SELECT 30, 'properties', 'total / linked / without_location',
         concat(count(*), ' / ', count(*) FILTER (WHERE location_id IS NOT NULL), ' / ', count(*) FILTER (WHERE location_id IS NULL))
    FROM properties
  UNION ALL
  SELECT 40, 'tsepochka Organization->Business->Location->Property', 'broken_chain (dolzhno byt 0)',
         concat(count(*))
    FROM properties p
    LEFT JOIN locations l ON l.id = p.location_id
    LEFT JOIN businesses b ON b.id = l.business_id
   WHERE p.location_id IS NULL OR b.id IS NULL OR b.organization_id IS DISTINCT FROM p.organization_id
  UNION ALL
  SELECT 50, 'reporting_currency', 'orgs_with_props / matches_property_currency / ambiguous',
         concat(
           count(*),
           ' / ',
           count(*) FILTER (WHERE distinct_currencies = 1 AND reporting_currency = only_currency),
           ' / ',
           count(*) FILTER (WHERE distinct_currencies > 1))
    FROM (
      SELECT o.id, o.reporting_currency,
             count(DISTINCT p.currency) AS distinct_currencies,
             min(p.currency) AS only_currency
        FROM organizations o JOIN properties p ON p.organization_id = o.id
       GROUP BY o.id, o.reporting_currency
    ) x
) t
ORDER BY ord;
