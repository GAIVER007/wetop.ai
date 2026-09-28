-- Отчёт backfill Platform P1 (миграция 20260927000030_platform_p1_business_location, ADR-104, Q-199 вариант Б).
-- Запуск: psql "$DATABASE_URL" -f scripts/ops/platform-p1-report.sql — или одним запросом в Supabase SQL Editor.
-- Ничего не меняет — только чтение.
--
-- reporting_currency (условие владельца 27.09.2026, приёмка Platform P1): DEFAULT 'KZT' НЕ считается
-- фактически подтверждённой валютой. Подтверждена — только выведенная из однозначной валюты объектов
-- организации; всё остальное (объектов нет или валюты объектов расходятся) — UNRESOLVED, перечисляется
-- по строкам. Ожидание на рабочей базе: businesses 1/1/1; locations 1/1; properties без location_id 0;
-- broken_chain 0; Luxx — confirmed KZT; UNRESOLVED — только организации без объектов (если такие есть).
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
  SELECT 50, 'reporting_currency', 'orgs_total / confirmed_iz_valyuty_obektov / UNRESOLVED',
         concat(
           count(*),
           ' / ',
           count(*) FILTER (WHERE distinct_currencies = 1 AND reporting_currency = only_currency),
           ' / ',
           count(*) FILTER (WHERE distinct_currencies IS NULL OR distinct_currencies <> 1
                               OR reporting_currency IS DISTINCT FROM only_currency))
    FROM (
      SELECT o.id, o.reporting_currency,
             count(p.id) FILTER (WHERE p.id IS NOT NULL) AS props,
             NULLIF(count(DISTINCT p.currency), 0) AS distinct_currencies,
             min(p.currency) AS only_currency
        FROM organizations o LEFT JOIN properties p ON p.organization_id = o.id
       GROUP BY o.id, o.reporting_currency
    ) x
  UNION ALL
  SELECT 51, 'reporting_currency UNRESOLVED', o.name::text,
         CASE WHEN x.distinct_currencies IS NULL THEN concat('net obektov (DEFAULT ', o.reporting_currency, ' ne podtverzhden)')
              WHEN x.distinct_currencies <> 1 THEN concat('valyuty obektov raskhodyatsya: ', x.distinct_currencies)
              ELSE concat('reporting_currency ', o.reporting_currency, ' ne sovpadaet s valyutoy obektov ', x.only_currency)
         END
    FROM organizations o
    JOIN (
      SELECT o2.id, NULLIF(count(DISTINCT p.currency), 0) AS distinct_currencies, min(p.currency) AS only_currency
        FROM organizations o2 LEFT JOIN properties p ON p.organization_id = o2.id
       GROUP BY o2.id
    ) x ON x.id = o.id
   WHERE x.distinct_currencies IS NULL OR x.distinct_currencies <> 1
      OR o.reporting_currency IS DISTINCT FROM x.only_currency
) t
ORDER BY ord, metric;
