# HELD 117 — Beauty workload history

Не переносить в общую цепочку и не применять в production без отдельного разрешения. Зависит от held 116: restaurant_local_instant(timestamp,text), плюс действующая Beauty schema. Полный CREATE SQL, не ALTER-only патч.

До релиза: backup БД и проверка восстановления, применить согласованные зависимости, затем migration.sql; код writer/reader выкладывается согласованно. Включение `BEAUTY_WORKLOAD_CAPTURE=true` отдельно. Валидация: три append-only таблицы, RLS FORCE, разрешения wetop_app, реальные schedule/appointment writers и изоляция организации. Контракт: docs/contracts/beauty-workload-history.md.

Локальная проверка fresh apply: отдельная транзакционная схема, клоны зависимых таблиц, весь migration.sql, ROLLBACK. Накатанные ранее данные pms_test сохранены.

Rollback: выключить новые reads, но не снимать history hooks при наличии данных.
Populated state: сохранить все три таблицы, hooks, source IDs и timestamps; только forward repair.
`down.sql` теперь реализует транзакционный empty-only откат: отказ при любой строке в любой
из трёх таблиц или установленном 118; блокировки источников защищают guard/teardown.
Удаляются сначала hooks/policies/indexes/functions, затем appointment_workload_revisions,
beauty_capacity_intervals, beauty_schedule_versions. Общая restaurant_local_instant остаётся.
Synthetic-репетиция не является проверкой восстановления production backup.
