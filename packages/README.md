# packages

| Пакет | Назначение | Правило |
|---|---|---|
| `database/` | Prisma schema, миграции, seed | Миграции только после утверждения DATA_MODEL.md |
| `domain/` | Бизнес-логика: availability, reservation, folio, pricing | Не знает про Channex/eQonaq/HTTP |
| `integrations/` | Адаптеры Channex, eQonaq, fiscal, S3 | **Единственное место**, где допустимы vendor SDK и vendor ID (ADR-004) |
| `shared/` | Общие типы, money, даты, ошибки | Money — integer minor units (ADR-008) |

Границы модулей поддерживаются дисциплиной пакетов, а не сетью (ADR-002).

**Статус 07.09.2026:** каркас создан (шаг 1 Slice 1): npm workspaces, `@pms/*`, TS strict,
Vitest, ESLint. Правило ADR-004 закреплено в `eslint.config.js`: импорт Channex вне
`packages/integrations` — ошибка линтера (проверено). Код пакетов пока пуст.
