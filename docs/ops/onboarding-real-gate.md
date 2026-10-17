# Путь первого салона в гейте выпуска (`tests/onboarding-real`)

Для ответственного за выпуск. С 17.10.2026 набор входит в `release-checks` отдельной задачей
`onboarding-real` (`.github/workflows/release-checks.yml`). `auto-release` перематывает `release` только при
общем `conclusion == success`, поэтому красная задача держит выкладку. Свой механизм выпуска набор не вводит.

## Что проверяет

11 сценариев на настоящих сайте (`apps/site`, `next dev`), стойке (`apps/web`), API (`tests/onboarding-real/api.ts`,
модуль авторизации и онбординга) и PostgreSQL 16 со схемой `pms_test`:
регистрация с кнопки «Начать работу» на `/for/salons/`, подтверждение почты, организация в пробном периоде 7 дней,
салон и филиал, все шаги настройки, услуга, мастер, график, запись клиента, выход и вход в новом браузере с теми же
ID и сроком; повтор, потерянный ответ, закрытая карточка (O07c), неподтверждённая почта; ресторан и гостиница v1.

Почта: API набора подменяет отправку и принимает только адреса `@example.invalid`. Секретов и внешних отправок нет.
`api.ts` откажется стартовать, если база не локальная или схема не `pms_test`.

## Успех

Задача зелёная только если:
- Playwright вышел с кодом 0 (`--forbid-only`, повторов в конфиге нет);
- `node scripts/ci/check-playwright-report.mjs onboarding-real-report.json 11` подтвердил: выполнено не меньше 11,
  упавших, пропущенных и прошедших со второй попытки ноль. Пустой отбор и `test.skip` успехом не считаются.

Серверы стенда поднимает конфиг набора из того же checkout (`reuseExistingServer: false`): чужой сервер на портах
55843–55845 даст ошибку старта, а не ложный успех.

## Как запустить локально (тот же порядок, что в CI)

```bash
PMS_LOCAL_PGPORT=55462 PMS_LOCAL_PGDATA=$TMPDIR/pms-onboarding-db bash scripts/ops/local-db.sh start
```

Затем создать чистую базу `pms_dev` с расширением `btree_gist` и выполнить, подставив адрес своей базы:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55462/pms_dev DIRECT_URL=postgresql://postgres@127.0.0.1:55462/pms_dev npm run test:schema
```

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55462/pms_dev DIRECT_URL=postgresql://postgres@127.0.0.1:55462/pms_dev PLAYWRIGHT_JSON_OUTPUT_FILE=$PWD/onboarding-real-report.json npx playwright test --config tests/onboarding-real/playwright.config.ts --forbid-only --reporter=list,json
```

```bash
node scripts/ci/check-playwright-report.mjs onboarding-real-report.json 11
```

Нужна своя установка `npm ci` в рабочей копии: ссылка на чужие `node_modules` подменяет пакеты монорепозитория
(`@pms/domain` из другой ветки). При падении артефакт `onboarding-real-results`: `test-results` и отчёт JSON.
