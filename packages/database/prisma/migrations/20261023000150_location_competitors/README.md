# 150 Загрузка конкурентов салона и ресторана

Решение владельца 23.10.2026 («конкурентов будем отслеживать через Booking и т. д., где будем видеть их
загруженность»; «да давай делай все варианты»). DATA_MODEL §60, план `plans/2026-10-23-competitors-business-manual.md`,
проба площадок `reports/2026-10-23-competitor-platform-probe.md`. В production НЕ применено.

Что добавляет (только новое, гостиничные `competitors*` §23 не трогаются):

- `location_competitors`: сосед филиала салона или ресторана (имя уникально в филиале без учёта регистра, ссылка
  http(s) на его онлайн-запись или бронь, расстояние >= 0); не удаляется, «убрать» = `active = false`;
- `location_competitor_snapshots`: снимок дня `SOLD_OUT` / `FEW_LEFT` / `AVAILABLE` (тип §23.1) и `free_slots`,
  если площадка показывает число окон или столов; уникально `(competitor_id, day, observed_on)`, `day >= observed_on`;
- триггер `location_competitor_guard`: филиал того же бизнеса и организации, вертикаль BEAUTY или FOOD_SERVICE;
  владелец строки и ключ снимка не меняются;
- RLS ENABLE + FORCE, `rls_tenant` по `organization_id`; права в этой же миграции (смешанная), те же строки в
  `scripts/ops/restore-mixed-domain-grants.sql`.

## Применение (production)

1. Свежая резервная копия и проверка восстановления по docs/ops/backups.md.
2. `migration.sql` одной транзакцией (`mig deploy`).
3. Проверка: `\dt location_competitor*`; `SELECT relforcerowsecurity FROM pg_class WHERE relname LIKE
   'location_competitor%'` = t, t; `SELECT has_table_privilege('wetop_app', 'location_competitors', 'DELETE')` = false.
4. После проверки выкладываются API и UI.

## Откат

`down.sql`: только пока таблицы пусты (иначе отказ с просьбой выгрузить данные).
