# Контракт личности и ошибок рабочей стойки (для чата №3, 17.10.2026)

Источник: код `main` `a4f9b04b`. Документ ничего не меняет, он описывает то, на что стойка уже опирается.
Меняет эти правила только авторизация (чат №4).

## Как стойка узнаёт, кто вошёл

- Сессия: кука `wetop_session` (на `.wetop.ai` общая для стойки и API). Сервер стойки передаёт её в API
  заголовком `x-wetop-session` (`apps/api/src/auth/auth.guard.ts`).
- Выбранное место: кука `wetop_scope`, в API заголовком `x-wetop-scope`. Это намерение, а не право:
  API проверяет его на каждом запросе (`apps/api/src/auth/scope.ts`).
- Один источник правды: `GET /auth/me` (`auth.controller.ts`); стойка читает его через `currentMe()`
  (`apps/web/src/lib/desk-shell.ts`, кешируется на запрос).

## Ответ `GET /auth/me`

Не вошёл: `{ "user": null }` (код 200).

Вошёл:

```json
{
  "user": {
    "id": "uuid", "email": "…", "name": "… | null",
    "organizationId": "uuid", "role": "OWNER | MANAGER | STAFF",
    "platformAdmin": false,
    "scopes": [ ... ],          // только если у человека есть назначения по филиалам
    "restricted": true          // только у человека с областью; role тогда это роль в выбранном месте
  },
  "organization": { "name": "…", "status": "TRIAL | ACTIVE | READ_ONLY | SUSPENDED",
                    "trialEndsAt": "ISO | null" },
  "expiresAt": "ISO",
  "access": { "aiSeller": { "access": "active | expired | off", "status": "…", "activeUntil": "…", "daysLeft": 0 } },
  "context": { "scope": "ORGANIZATION | BUSINESS | LOCATION",
               "businessId": "uuid | null", "locationId": "uuid | null",
               "vertical": "HOSPITALITY | BEAUTY | FOOD_SERVICE | null" }
}
```

- `context` это фактический scope запроса. Если указатель места есть, а назначения на него нет, API отдаёт
  `{ scope: "ORGANIZATION", businessId: null, locationId: null, vertical: null }`, и стойка ведёт на выбор филиала.
- Пробный период: новые организации получают `trialEndsAt` = создание + 7 суток (`TRIAL_DAYS = 7`,
  ADR-TRIAL-7-DAYS-20261017). Повторный вход срок не меняет (проверено, см. ниже).

## Ошибки и что с ними делает стойка

| Ситуация | Ответ API | Стойка (`currentMe`, `deskShell`) |
|---|---|---|
| Нет сессии или она истекла | 401 `Войдите в систему` на защищённых маршрутах; `/auth/me` даёт `{ user: null }` | уводит на вход (`redirectToLoginIfRequired`), куки не трогает сама |
| Пробный период вышел, `READ_ONLY` | чтение 200; запись 403 с текстом `READ_ONLY_MESSAGE` (`packages/domain/src/accounts/trial.ts`) | вход открыт, кнопки записи скрыты (`deskShellOf(...).readOnly`) |
| `SUSPENDED` (архив) | сессии не действуют | как «нет сессии» |
| Нет права на раздел | 403 с текстом права | 403 не ведёт на вход: показывается отказ, сессия сохраняется |
| API недоступен, 500, 503 | как есть | ошибка не превращается во «вход»; меню получает `UNKNOWN_SHELL` (пункты по праву не появляются) |
| Сменился пользователь или организация в той же вкладке | | `WorkspaceSessionBoundary` перезагружает страницу |
| Переход с публичного адреса (`/register/setup`, `/login/…`) в рабочий | | `PublicEntryExit` прячет страницу и пересчитывает макет (`router.refresh()`), PR #627 |

Для модели ИИ-помощника есть отдельный безопасный вид (`packages/domain/src/accounts/requester-context.ts`):
`account.status`, `canMutate`, `trialEndsAt`, `reasonCode` (`TRIAL_ENDED`, `READ_ONLY_BY_PLATFORM`, `SUSPENDED`).
Почта, имя и id в нём не передаются.

## Чем подтверждено

`tests/onboarding-real` на `a4f9b04b` с настоящими сайтом, стойкой, API и PostgreSQL (подставная почта на
`@example.invalid`): 10 из 10, журнал `tests/runs/logs/2026-10-17T11-00-37Z-e2e-deb9.log`. O01 проходит путь
«Начать работу» на `/for/salons/` → регистрация → подтверждение почты → `/auth/me`: `TRIAL`, срок 7 суток,
`vertical BEAUTY`, филиал → настройка салона → услуга, мастер, график → запись клиента → выход и вход в новом
браузере: та же организация, филиал, `trialEndsAt`, те же ID услуги и мастера, настройка завершена, запись на месте.
