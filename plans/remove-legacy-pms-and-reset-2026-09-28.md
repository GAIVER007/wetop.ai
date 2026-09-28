# Удаление наследия прежней PMS и обнуление WETOP — 28.09.2026

Статус: утверждено владельцем 28.09.2026. ADR-118, DATA_MODEL v2.5.

## Граница

- Текущий HEAD: UI, сайт, runtime, документация и тесты не содержат vendor-specific сведений прежней PMS.
- Git-история и старые применённые migrations не переписываются.
- Production после очистки сохраняет только identity-контур владельца; гостиничный домен начинается с onboarding.
- Channex и другие действующие интеграции не включаются и не переключаются в ходе очистки.

## Порядок

1. Зафиксировать исходные SHA, контейнеры, health, миграции и агрегатные счётчики.
2. Остановить старую синхронизацию и доказать, что она не запускается повторно.
3. Удалить vendor-specific runtime/UI/docs/tests; записать DATA_MODEL и ADR.
4. Добавить migration удаления пяти колонок с `down.sql` и тестом apply/rollback.
5. Добавить production-reset dry-run/apply: allowlist сохраняемых identity-таблиц, stop-checks, manifest счётчиков.
6. Прогнать unit, integration, e2e/UI, typecheck, lint, build и поиск запрещённого имени.
7. Commit/push `main`; создать полную production backup и проверить её читаемость.
8. Применить reset в транзакции, проверить нули и сохранённый identity-контур.
9. Продвинуть согласованный SHA в `release`, применить pending migrations и выполнить deploy.
10. Проверить server SHA, контейнеры, `/health`, `/login`, вход владельца и пустой onboarding.

## Стоп-условия

- нет полной проверенной копии;
- неизвестно, какой пользователь/организация должны сохраниться;
- активен чужой test-lock или deployment lock;
- появились необработанные внешние события;
- dry-run затрагивает identity-таблицы вне allowlist;
- apply/rollback migration не проходят на чистой PostgreSQL.
