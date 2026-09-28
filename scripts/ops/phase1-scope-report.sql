-- Отчёт backfill Phase 1 изоляции (миграция 20260927000026_phase1_tenant_scope, ADR-100 §17.2).
-- Запуск: psql "$DATABASE_URL" -f scripts/ops/phase1-scope-report.sql
-- Показывает по каждой из четырёх таблиц: всего строк, привязано, осталось NULL,
-- и раскладку NULL-остатка: «неоднозначно» (кандидатов больше одного) или «связи нет» (кандидатов ноль).
-- Ничего не меняет — только чтение.

\echo '=== guests ==='
SELECT count(*)                                        AS total,
       count(*) FILTER (WHERE organization_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE organization_id IS NULL)     AS remaining_null
  FROM guests;

\echo '--- guests: раскладка NULL-остатка ---'
WITH guest_orgs AS (
  SELECT sg.guest_id, p.organization_id
    FROM stay_guests sg
    JOIN reservation_items i ON i.id = sg.reservation_item_id
    JOIN reservations r ON r.id = i.reservation_id
    JOIN properties p ON p.id = r.property_id
   WHERE p.organization_id IS NOT NULL
  UNION
  SELECT r.primary_guest_id, p.organization_id
    FROM reservations r JOIN properties p ON p.id = r.property_id
   WHERE r.primary_guest_id IS NOT NULL AND p.organization_id IS NOT NULL
), candidates AS (
  SELECT guest_id, count(DISTINCT organization_id) AS orgs FROM guest_orgs GROUP BY guest_id
)
SELECT count(*) FILTER (WHERE c.orgs > 1)  AS ambiguous_multi_org,
       count(*) FILTER (WHERE c.orgs IS NULL) AS no_linked_reservations
  FROM guests g LEFT JOIN candidates c ON c.guest_id = g.id
 WHERE g.organization_id IS NULL;

\echo '=== audit_logs ==='
SELECT count(*)                                        AS total,
       count(*) FILTER (WHERE organization_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE organization_id IS NULL)     AS remaining_null
  FROM audit_logs;

\echo '--- audit_logs: NULL-остаток по entity_type (что не вывелось) ---'
SELECT entity_type,
       count(*)                                   AS remaining_null,
       count(*) FILTER (WHERE user_id IS NULL)    AS service_rows_no_author,
       count(*) FILTER (WHERE user_id IS NOT NULL) AS author_multi_membership_or_unknown
  FROM audit_logs
 WHERE organization_id IS NULL
 GROUP BY entity_type
 ORDER BY remaining_null DESC;

\echo '=== external_events ==='
SELECT count(*)                                     AS total,
       count(*) FILTER (WHERE property_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE property_id IS NULL)     AS remaining_null
  FROM external_events;

\echo '--- external_events: провайдеры NULL-остатка и число объектов с их сопоставлениями ---'
SELECT e.provider,
       count(*) AS remaining_null,
       (SELECT count(DISTINCT cm.property_id) FROM channel_mappings cm WHERE cm.provider = e.provider)
         AS mapped_properties_for_provider
  FROM external_events e
 WHERE e.property_id IS NULL
 GROUP BY e.provider;

\echo '=== channel_outbox ==='
SELECT count(*)                                     AS total,
       count(*) FILTER (WHERE property_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE property_id IS NULL)     AS remaining_null
  FROM channel_outbox;

\echo '--- channel_outbox: провайдеры NULL-остатка ---'
SELECT o.provider,
       count(*) AS remaining_null,
       (SELECT count(DISTINCT cm.property_id) FROM channel_mappings cm WHERE cm.provider = o.provider)
         AS mapped_properties_for_provider
  FROM channel_outbox o
 WHERE o.property_id IS NULL
 GROUP BY o.provider;
