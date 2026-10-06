# Что делает владелец после разбора 01.10.2026: по шагам (редакция 06.10.2026)

Редакция после слияния `main` 06.10.2026. Пункты аудита 1, 2, 3, 4, 6, 7 и 9 закрыты на `main` решениями ADR-137
(02.10) и ADR-139 (03.10), поэтому прежние шаги про раннер `wetop`, рулсеты GitHub, папку `migrations-held`, вопрос
Q-237 и ответ про миграцию 039 сняты. Осталось то, что по ADR-137 «Последствия» делается руками владельца, плюс два
шага этой ветки. Значения ключей в чат не диктуются (SECURITY.md §3): вписывайте их сами.

## Шаг 1. Слить PR #211 (5 минут, браузер)

1. https://github.com/GAIVER007/wetop.ai/pull/211 → Ready for review → Merge pull request.
   Проверок GitHub на PR нет: по ADR-139 единственная проверка `release-checks` запускается на кандидата, а не на PR.
   Что доказано на слитом дереве локально: `README.md` §5 (typecheck, lint, полный unit, integration на PostgreSQL 16).
2. Миграций в этом PR нет. В `main` после слияния остаются миграции, которых ещё нет в `release` (`c86e5296`):
   автовыкладка на такую вершину откажет до `--migrations-applied <sha>` (`docs/deploy.md` §1д).

## Шаг 2. Выкладка стойки (после шага 1; 100 минут проверки, 5 минут рук)

1. Actions → `release-checks` → Run workflow на ветке `main`. Около 95 минут.
2. По зелёному результату, на Mac из клона (нужен вошедший `gh` или `GITHUB_TOKEN` в окружении):

```bash
git fetch origin main
scripts/ops/promote-release.sh origin/main
```

   Скрипт проверит, что коммит в `main`, что `release-checks` на нём зелёная, что перемотка только вперёд, спросит
   «да» и запушит. Запасной путь с теми же условиями, проверенными глазами: `git push origin <sha>:release`.
3. Сервер заберёт `release` сам в течение двух минут; миграции в обновлении остановят выкладку до вашего
   `--migrations-applied` (`docs/deploy.md` §1д).

## Шаг 3. Channex, боевой объект (5 минут, кабинет или сервер; после шага 2)

Два выключателя у объекта в кабинете Channex: `allow_availability_autoupdate_on_modification` и
`allow_availability_autoupdate_on_cancellation` выключить, `..._on_confirmation` оставить (ADR-137 п. 3). Или на
сервере, когда образ со слитым PR уже выложен:

```bash
cd /root/wetop
docker compose -f deploy/compose.yml exec -w /app api node --import tsx \
  scripts/reconciliation/src/cli-channex-property-settings.ts            # показать, что стоит сейчас
docker compose -f deploy/compose.yml exec -w /app api node --import tsx \
  scripts/reconciliation/src/cli-channex-property-settings.ts --apply    # поставить рекомендованные
```

Если объектов в маппинге несколько, добавьте `--property=<id>`. Это запись в production Channex, поэтому только
по вашей команде; агент сам этого не делает (AGENTS.md §15).

## Шаг 4. Вторая копия базы вне сервера (20 минут, Cloudflare и сервер)

По `docs/ops/backups.md`, раздел «Вторая копия вне сервера (Cloudflare R2, ADR-137)»: пара ключей age (закрытый
остаётся у вас, публичный `age1…` в `.env` сервера как `OFFSITE_AGE_RECIPIENT`), бакет R2 и ключ с правами только на
объекты этого бакета, строки `OFFSITE_*` в `/root/wetop/.env`, cron после ночной копии, затем «Проба восстановления из
R2». Скрипт `scripts/ops/db-backup-offsite.sh` уже на `main` и выложен.

## Шаг 5. Ключ дежурного агента (15 минут, консоль Anthropic и сервер)

По `scripts/ops/guard/README.md`, раздел «Ключ или подписка»: рабочее пространство `wetop-guard` в консоли Anthropic с
пределом расхода, ключ API в `.env` рядом с `scripts/ops/guard/compose.yml`, строку `CLAUDE_CODE_OAUTH_TOKEN=…`
убрать, пересобрать образ. В журнале первого разбора должно быть «платит ключ API». С токеном подписки без
`GUARD_ALLOW_SUBSCRIPTION=1` агент не стартует: это намеренно.

## Шаг 6. Откат и тихие сутки (5 минут решения, учение отдельно)

`CUTOVER.md`, раздел ROLLBACK, таблица в конце: дата тихих суток, ночной дежурный первой ночи (имя и телефон; лучше
служебный номер, репозиторий читают все, у кого есть доступ), дата учения ступеней 1 и 2. Двойная смена назначена на
вторник 06.10.2026 (`plans/double-shift-2026-10-06.md`): учение имеет смысл до неё.

## Шаг 7. Настройки Actions (2 минуты, браузер)

Settings → Actions → General: убедиться, что запуск workflow из форков требует одобрения (Fork pull request
workflows from outside collaborators: Require approval for all outside collaborators). Своего раннера больше нет
(ADR-139), поэтому это единственная настройка из пункта 9, которая ещё что-то защищает.

## Что я делаю сам, без вас

Слежу за PR #211 до слияния: конфликты с `main`, замечания ревью. Проверок GitHub на PR по ADR-139 нет, поэтому
доказательства лежат в журнале прогонов (`tests/runs/JOURNAL.md`) и в `README.md` §5.
