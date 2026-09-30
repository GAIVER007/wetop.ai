-- Отчёт «объект у данных интеграции» перед B1.5 / B2 (SEC-1b, стадия B, Q-222; решение владельца 30.09.2026).
-- Запуск (только чтение, ничего не меняет):
--   psql "$DATABASE_URL" -v integration_property_id="<UUID объекта Luxx>" -f scripts/ops/integration-tables-scope-report.sql
-- Без -v отчёт работает, колонки про объект интеграции остаются пустыми.
--
-- Зачем: запросы к очереди и журналу событий Channex после B1.5 фильтруются по объекту, который выбирает сервер. Строка с
-- property_id IS NULL под такой фильтр не попадёт. Особенно опасны PENDING-сообщения очереди: воркер перестанет их видеть.
-- Правило: NULL-строки НЕ привязываются по догадке. Эта миграция 20260927000026 уже привязала всё, что выводилось однозначно
-- (провайдер с сопоставлениями ровно одного объекта); то, что осталось, однозначно не выводится.

\if :{?integration_property_id}
\else
  \set integration_property_id ''
\endif

\echo '=== 1. Сводка ==='
WITH cfg AS (SELECT NULLIF(:'integration_property_id', '')::uuid AS pid),
provider_scope AS (  -- сколько объектов имеет сопоставления провайдера
  SELECT m.provider, count(DISTINCT m.property_id) AS objects
    FROM channel_mappings m GROUP BY m.provider
),
tables(tbl) AS (VALUES ('external_events'), ('channel_outbox')),
t AS (
  SELECT 'external_events'::text AS tbl, provider, property_id IS NULL AS is_null FROM external_events
  UNION ALL
  SELECT 'channel_outbox', provider, property_id IS NULL FROM channel_outbox
),
agg AS (
  SELECT t.tbl,
         count(*)                                                       AS total,
         count(*) FILTER (WHERE t.is_null)                              AS nulls,
         count(*) FILTER (WHERE NOT t.is_null)                          AS linked,
         count(*) FILTER (WHERE t.is_null AND ps.objects = 1)           AS null_rule_ok,
         count(*) FILTER (WHERE t.is_null AND COALESCE(ps.objects, 0) <> 1) AS null_rule_no
    FROM t LEFT JOIN provider_scope ps ON ps.provider = t.provider
   GROUP BY t.tbl
)
SELECT tables.tbl                          AS "таблица",
       COALESCE(a.total, 0)                AS "строк",
       COALESCE(a.nulls, 0)                AS "NULL",
       COALESCE(a.linked, 0)               AS "с объектом",
       COALESCE(a.null_rule_ok, 0)         AS "NULL, 1 объект",
       COALESCE(a.null_rule_no, 0)         AS "NULL, 0 или >1",
       CASE WHEN COALESCE(a.nulls, 0) = 0 THEN 'да: NULL нет'
            WHEN COALESCE(a.null_rule_no, 0) = 0 THEN 'да: по правилу «один объект у провайдера»'
            ELSE 'НЕТ: решает владелец, не по догадке' END AS "безопасно отнести?"
  FROM tables LEFT JOIN agg a ON a.tbl = tables.tbl
UNION ALL
SELECT 'system_incidents', count(*), NULL, NULL, NULL, NULL,
       'не применимо: колонки property_id нет, инциденты сторожа на всю установку'
  FROM system_incidents
 ORDER BY 1;

\echo ''
\echo '=== 2. channel_outbox с NULL: по статусу и провайдеру (PENDING — то, что воркер перестанет видеть) ==='
SELECT status::text AS "статус", provider AS "провайдер", count(*) AS "строк",
       min(created_at) AS "старейшая", max(created_at) AS "новейшая"
  FROM channel_outbox WHERE property_id IS NULL
 GROUP BY 1, 2 ORDER BY 1, 2;

\echo ''
\echo '=== 3. external_events с NULL: по статусу и провайдеру ==='
SELECT status::text AS "статус", provider AS "провайдер", received_via::text AS "канал", count(*) AS "строк",
       min(received_at) AS "старейшая", max(received_at) AS "новейшая"
  FROM external_events WHERE property_id IS NULL
 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

\echo ''
\echo '=== 4. Объекты, которым принадлежат строки с property_id (нет ли строк «чужого» объекта под провайдером Channex) ==='
SELECT 'channel_outbox' AS "таблица", property_id AS "property_id", count(*) AS "строк"
  FROM channel_outbox WHERE property_id IS NOT NULL GROUP BY 2
UNION ALL
SELECT 'external_events', property_id, count(*) FROM external_events WHERE property_id IS NOT NULL GROUP BY 2
 ORDER BY 1, 3 DESC;

\echo ''
\echo '=== 5. Условие выкладки B1.5: PENDING-сообщений очереди с NULL должно быть 0 ==='
SELECT count(*) AS "channel_outbox: PENDING с NULL",
       CASE WHEN count(*) = 0 THEN 'можно выкладывать B1.5'
            ELSE 'СТОП: воркер перестанет их отправлять — отчёт владельцу, не привязывать по догадке' END AS "вывод"
  FROM channel_outbox WHERE property_id IS NULL AND status = 'PENDING';
