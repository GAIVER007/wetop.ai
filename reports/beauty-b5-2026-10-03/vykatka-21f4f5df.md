# Выкладка вершины `21f4f5df`: что осталось сделать руками

Составлено 03.10.2026 в сессии Beauty B1–B5 после вливания PR #227. Порядок взят из
`docs/deploy.md` §1д, числа подставлены по факту: состояние рабочей базы проверено запросами,
а не по памяти.

## Где что стоит сейчас

| что | коммит | смысл |
|---|---|---|
| `release` | `74f3bc82` | что выложено на `app.wetop.ai` прямо сейчас |
| `main` и `release-candidate` | `21f4f5df` | срез Beauty B1–B5 плюс вечерние правки тестов |

Между ними, кроме Beauty, лежат «Загрузка конкурентов», «Эффективность каналов» и правки
соседних сессий за день.

## Шаг 0. Дождаться зелёного прогона

`release` перематывается только на коммит с зелёной проверкой GitHub `release-checks`
(ADR-139, `AGENTS.md` §18). Прогон на `21f4f5df` запущен пушем в `release-candidate`:
Actions → release-checks → прогон с заголовком «Beauty B1-B5…». Семь задач, около 45 минут.

## Шаг 1. Копия базы

Перед миграцией свежая копия по `docs/ops/backups.md`. Это не формальность: миграция создаёт
две таблицы, и откат у неё есть (`down.sql`), но копия нужна до, а не после.

## Шаг 2. Миграция конкурентов

**Неприменённая миграция на рабочей базе ровно одна:** `20261003000044_competitor_occupancy`
(проверено: таблиц `competitors` и `competitor_occupancy` в схеме `public` нет совсем).
Миграции Beauty уже применены 03.10 (`…044_beauty_domain` в 14:15 UTC,
`…045_beauty_function_search_path` в 14:25 UTC), повторно их `deploy` не возьмёт.

**Что увидите в `mig status` и чего не надо бояться:** в журнале миграций есть строка
`20260912000009_web_analytics` с отметкой отката от 12.09.2026, а сразу за ней, через десять
секунд, успешная попытка той же миграции. Prisma видит успешную и миграцию пропускает;
на `deploy` эта строка не влияет.

Порядок ровно как в `docs/deploy.md` §1д, с подставленной вершиной:

```bash
cd /root/wetop && V=21f4f5df
git fetch origin && git push origin "$V:release"     # перемотка release на проверенный коммит
/usr/local/sbin/wetop-auto-deploy                     # откажет и назовёт миграцию competitor_occupancy

rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$V" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL \
    -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
mig status     # ждём: не применена одна, 20261003000044_competitor_occupancy
mig deploy     # только после свежей копии
mig status     # ждём: Database schema is up to date
/usr/local/sbin/wetop-auto-deploy --migrations-applied "$V"
```

## Шаг 3. Проверка после выкладки

Автовыкладка сама проверяет `/health`, `/login`, `/today`, `/chessboard`, `/reservations` и
откатывается, если не сошлось (§1д, пункты 5 и 6). Сверх этого стоит посмотреть глазами:

- `/beauty` открывается и показывает журнал дня, `/beauty/services`, `/beauty/masters`,
  `/beauty/schedule` отвечают;
- `/market` («Загрузка конкурентов») открывается без ошибки, это и есть проверка, что миграция
  шага 2 доехала;
- контрольные числа не поехали: фонд 88 и `daily_rates` 8 640 (на 03.10 21:05 UTC именно столько).

## Шаг 4. Если что-то не так

Откат по `docs/deploy.md` §4; точка отката у автовыкладки своя: прежний образ
`pms-lux:rollback-<коммит>` и прежний коммит в `/var/lib/wetop-deploy/previous`.
У миграции конкурентов есть `down.sql`.

## Чего в этой выкладке нет

- **Главная `wetop.ai` не выкладывается этим путём** (`docs/deploy.md` §2). В `main` против
  `release` лежит невыложенный блок главной про загрузку конкурентов. Из облачной сессии её
  выложить нельзя: ключей Cloudflare в окружении нет, а политика сети режет и `wetop.ai`, и
  `app.wetop.ai`.
- **Образ бота** (`apps/ai-seller`) автовыкладкой не обновляется и в этом срезе не менялся.
- **Живой смоук изоляции под `wetop_app`** (`docs/ops/rls.md`) из облака снять нельзя:
  подключению MCP не выдано право `SET ROLE`.
