# HELD 131, Beauty appointment lines

Отдельный релиз для BEAUTY-ZAPIS-20261017 A1/A2/A3/E2. Production application остаётся за владельцем.

Порядок: backup и проверка восстановления, остановка writers Beauty, применение migration.sql, проверки backfill count/sum/interval, выкладка совместимого API и всех writers, затем включение multi-line UI. Миграция переводит непересечение с envelope Appointment на интервалы AppointmentLine. Старые INSERT/UPDATE одной услуги синхронизируются триггером; legacy UPDATE многострочного визита отклоняется.

Проверить до релиза: стойка, сайт, бот и импорт создают line; CANCELLED/NO_SHOW освобождают время; реактивация с пересечением отклоняется; RLS режет соседнюю организацию; новый total не ниже чистой оплаты; online booking replay сохраняет прежний ответ.

Rollback допустим только когда цены мастеров пусты и каждый визит имеет ровно одну строку, полностью представимую legacy Appointment. Иначе down.sql отказывает, чтобы не потерять историю.
