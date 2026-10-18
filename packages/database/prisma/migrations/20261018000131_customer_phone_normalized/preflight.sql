-- READ ONLY. Возвращает только агрегаты, без телефонов, имён и идентификаторов.
WITH formatted AS (
  SELECT organization_id, phone,
    btrim(replace(replace(phone, chr(160), ' '), chr(8239), ' '), ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13)) AS value
  FROM customers
), digits AS (
  SELECT *, regexp_replace(value, '[^0-9]', '', 'g') AS number FROM formatted
), normalized AS (
  SELECT organization_id, phone,
    CASE WHEN value ~ ('^\+?[0-9 ().' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || '-]+$') AND length(number) BETWEEN 10 AND 15
      THEN CASE
        WHEN length(number) = 11 AND left(number, 1) IN ('7','8') THEN '+7' || substr(number, 2)
        WHEN length(number) = 10 AND left(value, 1) <> '+' THEN '+7' || number
        ELSE '+' || number
      END
    END AS key
  FROM digits
), collisions AS (
  SELECT count(*) AS n FROM normalized WHERE key IS NOT NULL GROUP BY organization_id, key HAVING count(*) > 1
)
SELECT count(*) AS customers,
  count(key) AS supported_phones,
  count(*) FILTER (WHERE phone IS NOT NULL AND key IS NULL) AS unsupported_phones,
  (SELECT count(*) FROM collisions) AS duplicate_groups,
  (SELECT coalesce(sum(n - 1), 0) FROM collisions) AS extra_duplicate_rows
FROM normalized;
