-- Откат: таблица неисправностей техническая, на неё ничего не ссылается. История неисправностей теряется;
-- сторож после отката перестанет писать (API без таблицы падает на первом тике — выключить GUARD=off до отката).

DROP TABLE IF EXISTS "system_incidents";
DROP TYPE IF EXISTS "IncidentResolvedBy";
DROP TYPE IF EXISTS "IncidentStatus";
DROP TYPE IF EXISTS "IncidentSeverity";
DROP TYPE IF EXISTS "IncidentClass";
