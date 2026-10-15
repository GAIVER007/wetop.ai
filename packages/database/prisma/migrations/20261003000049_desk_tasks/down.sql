-- Откат 20261003000049_desk_tasks: задачи стойки теряются — перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "desk_tasks";
DROP TYPE IF EXISTS "TaskPriority";
