-- Права правил брони столов (DATA_MODEL §43, ADR-182) по фактическим операциям API:
-- правила живут upsert-ом (DELETE в API нет), закрытые дни закрывают и открывают (UPDATE в API нет).
-- До этой миграции таблицы жили на правах по умолчанию миграции 26 (SELECT/INSERT/UPDATE/DELETE),
-- которые восстановление рабочей базы не реиграет: реиграются только *_grants-миграции.
REVOKE ALL ON food_booking_rules FROM wetop_app, wetop_service;
REVOKE ALL ON food_closed_days FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON food_booking_rules TO wetop_app, wetop_service;
GRANT SELECT, INSERT, DELETE ON food_closed_days TO wetop_app, wetop_service;
