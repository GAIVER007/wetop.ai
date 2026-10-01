# GitHub: защита `main`, форки, свой раннер

Разбор 01.10.2026 (`reports/order-2026-10-01`, пункты 8 и 9). Всё ниже делается в настройках репозитория
`GAIVER007/wetop.ai` владельцем: у агента нет прав на настройки, и из кода их не поставить. Что уже стоит в коде:
задача `bot` (pytest) в `.github/workflows/checks.yml`, условие «только свои ветки» на задачах своего раннера,
`scripts/ops/promote-release.sh` для перемотки `release`.

## 1. Защита ветки `main` (Settings → Rules → Rulesets → New branch ruleset)

| Поле | Значение | Зачем |
|---|---|---|
| Target branches | `main` | |
| Restrict deletions | включить | |
| Block force pushes | включить | ключ развёртывания дежурного агента и любой токен с записью физически не перепишут историю (`scripts/ops/guard/README.md`, §«Права ключа») |
| Require a pull request before merging | включить, 0 обязательных ревью | изменения в `main` только через PR; ревью людьми при одном владельце не требуем |
| Require status checks to pass | включить, `Require branches to be up to date` выключить | обязательные: `lint · typecheck · unit · главная`, `стойка на синтетическом API (tests/ui)`, `ИИ-помощник и продавец · pytest (apps/ai-seller)`. Задачу `миграции · integration · e2e на чистом PostgreSQL 16` добавить в обязательные после первого зелёного прогона на `main`: минуты Actions с 01.10 снова есть, а её окружение приведено к локальному стенду (разбор 01.10, п. 8); до зелёного прогона она в обязательных заблокировала бы все PR |
| Bypass list | пусто | владелец тоже идёт через PR; в срочном случае правило выключается на минуту руками, и это видно в журнале |

Ruleset, а не классическая Branch protection: он показывает, кто и когда его обходил.

То же правило для `release`: **Block force pushes** и **Restrict deletions**. Перемотка назад на ней запрещена и
скриптом, откат делается руками по `docs/deploy.md` §4.

## 2. Форки выключены (Settings → General → Features)

Репозиторий приватный. Снять галочку **Allow forking**: тогда запросов на слияние из форков не бывает вовсе, и код
чужого форка на свой раннер попасть не может. Второй замок стоит в workflow: задачи своего раннера идут только при
`github.event.pull_request.head.repo.full_name == github.repository` или при пуше в этот репозиторий.

Там же, Settings → Actions → General:

- **Fork pull request workflows from outside collaborators**: «Require approval for all outside collaborators»;
- **Workflow permissions**: «Read repository contents and packages permissions»; галочку «Allow GitHub Actions to
  create and approve pull requests» не ставить.

## 3. Свой раннер: с боевого сервера на отдельную машину

Сейчас раннер (`scripts/ops/ci-runner`) стоит на сервере с боевой PMS и исполняет код из каждого PR. Сокета Docker
у него нет, потолки памяти и процессора стоят (`tests/unit/ci-runner.test.ts`), форки выключены, и всё же код из
любой ветки репозитория исполняется рядом с боевой базой и `.env`. Порядок переноса:

1. Отдельная машина: после переезда PMS на ps.kz (`plans/kz-move-2026-09-26.md`) раннер остаётся на Hostinger, где
   боевой PMS уже не будет, вместе со сторожем; до переезда подходит самый маленький VPS (2 ГБ памяти хватает на
   `fast`; UI-части и pytest удобнее на 4 ГБ).
2. На новой машине: `scripts/ops/ci-runner/README.md`, установка один раз с новым `RUNNER_TOKEN`.
3. На старой: `docker compose -f scripts/ops/ci-runner/compose.yml down -v`, в Settings → Actions → Runners удалить
   прежний раннер. Метки те же (`self-hosted, linux, x64, wetop`), workflow не меняется.

## 4. Как двигать `release`

Только скриптом, по зелёным проверкам и по «да» владельца (AGENTS.md §18):

```bash
scripts/ops/promote-release.sh <sha из main>            # покажет проверки и спросит «да»
scripts/ops/promote-release.sh <sha из main> --dry-run  # только проверить
```

Скрипту нужен вошедший `gh` (`gh auth status`) или `GITHUB_TOKEN` с правом чтения проверок в окружении. Красная или
незавершённая проверка, коммит не из `main`, перемотка назад: отказ, `release` не тронута.
