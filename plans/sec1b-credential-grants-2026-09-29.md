# SEC-1b, стадия A: у `wetop_app` нет доступа к учётным данным (аудит 29.09.2026)

Решение — ADR-124, модель — `DATA_MODEL.md` v2.7 (§17.2–17.3). Открытый вопрос по стадии B — Q-222.

## Проблема

Миграция `…026_rls_roles` выдала роли запросов организации `wetop_app` полный доступ ко всем таблицам схемы. `DATA_MODEL.md`
§17.3 называет десять таблиц без RLS «только `wetop_service` читает по делу». Владелец подтвердил запросом к рабочей базе 29.09:
`wetop_app` имеет `DELETE, INSERT, SELECT, UPDATE` на `users`, `platform_admins`, `password_resets`, `email_verifications`,
`external_events`, `channel_outbox`, `system_incidents`; API держит 5 соединений этой ролью.

Риск: любая ошибка под организацией (пропущенный фильтр, инъекция) даёт чтение `users.password_hash`, а запись в
`platform_admins` — права главного администратора.

## Что нашёл разбор кода

Роль выбирается по контексту запроса (`databaseTenant()`): организация есть — `wetop_app`, иначе служебная. Организацию кладёт
только `AuthorInterceptor` (после гардов) — значит, всё до него (гард, `ActorMiddleware`), публичные маршруты, вебхуки, таймеры
и `PlatformController`/`SupportController` идут служебной ролью.

| Таблица | Под `wetop_app` (в запросе вошедшего) | Что сделано |
|---|---|---|
| `password_resets`, `email_verifications`, `wizard_sessions`, `wizard_events`, `wizard_surveys` | не найдено: все обращения из публичных маршрутов и таймеров | `REVOKE ALL` без правок кода |
| `users` | `/auth/me` (`whoami`, читал строку пользователя целиком); смена пароля; `seller-agents.owner()` (`include user: true`); чтения с явным `select` (сессия, сотрудники, журнал, бот) | `whoami` и смена пароля — служебной ролью; `owner()` перечисляет колонки; остальным хватает `SELECT (id, email, name, status, email_verified_at)` |
| `platform_admins` | чтение `revokedAt` (`whoami` — теперь служебно; бот поддержки — остаётся) | `SELECT (user_id, revoked_at)`, записи нет |
| `external_events`, `channel_outbox`, `system_incidents` | интеграционные маршруты оператора (Luxx); запись очереди цен внутри транзакции команды | **не тронуты** — стадия B, Q-222 |

Почему стадия B отдельно: роль внутри одной транзакции не сменить (её выбирает соединение при выдаче из пула), а `ratesChanged`
пишет очередь в Channex внутри транзакции команды. Отзыв `INSERT` без правки кода тихо остановил бы выгрузку цен
(`publishAfterCommit` глотает ошибку и пишет `channex.deltaLost`), а в `rates.service.ts` сорвал бы саму правку цен.

## Доказательства (локальная база, вымышленные данные)

- Красный → зелёный: `tests/integration/rls-credential-grants.test.ts` (8 тестов, красными были 7), юнит
  `auth.service.test.ts` (2 красных: `whoami` и смена пароля внутри запроса организации шли ролью организации).
- Настоящий Postgres 16, роль `wetop_app` (`SET ROLE`): внешний ключ `audit_logs.user_id → users` проверяется без прав на
  `users`; `SELECT password_hash`, `SELECT *`, `UPDATE users`, `INSERT platform_admins` отказывают.
- API в режиме `NODE_ENV=production` под `wetop_app` с отозванными правами: вход, `/auth/me`, смена пароля (дважды), сотрудники,
  сессии, приглашения (создание и список), журнал, настройки объекта, `/system/freshness`, `/channels/channex/connection`,
  `/guard/status` — 200/201; «permission denied» в логе нет. Журнал подписывается автором и организацией и на служебном пути.
- Маршруты сотрудников (`/auth/members`, `/auth/sessions`, `/auth/invites`) принимают только `Authorization: Bearer` — с
  `x-wetop-session` 401 и до этой правки (проверено возвратом прав).

## Порядок выкладки

1. **Код** (стойка и API) — как обычно. Он работает и с прежними правами.
2. **Проверить на рабочей базе перед миграцией:** `AUTH_REQUIRED` не `0` (при `0` публичные маршруты видят `request.user` и идут
   под `wetop_app`); в `.env` задан `DATABASE_APP_URL` (SEC-1a без него не даст запуститься).
3. **Резервная копия и миграция** `20260929000033_rls_credential_grants` — `docs/ops/rls.md`, раздел «SEC-1b».
4. **Проверка:** запросы из того же раздела; в стойке — войти, открыть «Сотрудники», «Журнал», сменить пароль.
5. **Откат:** `down.sql` (полный доступ обратно); код продолжает работать.

## Не входит

Стадия B (Q-222); закрытие автогранта на будущие таблицы (`ALTER DEFAULT PRIVILEGES` из `…026`) — отдельное решение;
эти же права в скриптах владельца (`scripts/ops/*`) — они ходят служебной ролью по `DATABASE_URL`.
