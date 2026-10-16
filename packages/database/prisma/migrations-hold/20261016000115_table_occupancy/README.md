# Отдельный выпуск: фактическая посадка

RESTAURANT_OCCUPANCY_CAPTURE по умолчанию выключен. Не переносить в migrations до отдельного release approval. Backup: pg_dump таблиц dining_tables, table_assignments, restaurant_reservations и новых occupancy-таблиц. Применять migration.sql транзакционно после совместимых writers. Проверить RLS/FORCE RLS, ограничения интервалов и локальный occupancy-isolated набор. Только затем включить флаг. Не создавать историю из плановых дат или оплаченных заказов.

Rollback: выключить capture и новые reads; сначала экспортировать обе occupancy-таблицы. Сохранить данные и ограничения; не удалять историю при откате UI. Полное удаление допустимо только до первых production-записей: DROP FUNCTION occupancy_command(uuid,text,text,uuid,uuid,uuid,uuid,uuid); DROP TABLE table_occupancy_commands; DROP TABLE table_occupancy_sessions; DROP FUNCTION occupancy_scope_guard(); Расширение btree_gist не удалять.
