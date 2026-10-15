-- Журнал премий и штрафов только дописывается (DATA_MODEL §33.4, Q-REST-7, ADR-171): миграция 26 выдала полный
-- набор прав по умолчанию, 82 его не отозвала. Лишнее отзывается, правило модели становится правилом базы
REVOKE UPDATE, DELETE, TRUNCATE ON employee_pay_adjustments FROM wetop_app, wetop_service;
