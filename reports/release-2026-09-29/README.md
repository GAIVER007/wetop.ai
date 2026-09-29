# Релиз 29.09.2026: что собрано, чем доказано, как выложить

Состав и причины исключений — [MANIFEST.md](MANIFEST.md). Здесь: слияние, стыки, регресс на итоговом дереве и
команды выкладки для владельца.

```
FREEZE SHA            44f401e043d94f476397b13d939868990d82caca   (origin/main, 07:58 UTC)
ВЕТКА ИНТЕГРАЦИИ      release-final-2026-09-29
RELEASE ДО            e0ac75fbf16a0a8720856318cdb47578d6411da9
```

## 1. Что влито поверх заморозки

| Порядок | Источник | Слияние | Конфликты |
|---|---|---|---|
| 1 | #142 Гости G8 (`d247c044`) | `04a934b7` | нет |
| 2 | #149 Шахматка PR6 «Брони без размещения» (`a6c2b748`) | `522296e5` | снимки и журнал: решены автоматически |
| 3 | `codex/site-hospitality-positioning` (`2cc98313`) | `5033b717` | `apps/site/src/i18n/ru.ts`, 5 участков, вручную |
| 4 | #150 документы (`c27abad6`) | `7fe6163b` | нет |

## 2. Стыки и что поправлено

**Тексты сайта (`ru.ts`).** Позиционирование взято из ветки сайта: «WETOP — операционная система для гостиничного
бизнеса», «Управляйте отелем из одного окна», шаги запуска. Из `main` ничего о регистрации не потеряно: окно
входа по-прежнему спрашивает у стойки `registrationEnabled` и при закрытой регистрации пишет «Регистрация временно
недоступна». Слова «Самостоятельная регистрация открыта» с первого экрана ушли: на рабочем сервере регистрация
закрыта (RLS-gate), так что прежняя фраза была неправдой.

**Срок пробного периода.** `main` после `e0ac75fb` писал на сайте «7 дней», ветка сайта — «14 дней». В коде
`TRIAL_DAYS = 14` (`packages/domain/src/accounts/trial.ts`), и это решение владельца по Q-144 (ADR-102). Сайт
теперь везде говорит «14 дней». Спеки `landing.spec.ts` и комментарии `site.ts`/`site.test.ts` поправлены под это.

**Опечатка ветки сайта.** «демонстрационные данны» → «демонстрационные данные» (четыре подписи чисел).

**Сторож дизайна сайта (DESIGN.md §19) после слияния был красным: unit 3/2307.** Новые блоки лендинга брали отступы
1/3/7/18/22 px вне лестницы §19.3 и радиусы литералами. Кроме того, 19 блоков не были описаны в реестре §19.5.
Что сделано (`41bbf27f`):
- волосяные разделители сеток перешли с зазора 1 px на тень 1 px;
- отступы поставлены на ступени лестницы;
- радиусы переведены на токены;
- в §19.5 добавлен раздел «Разделы гостиничного позиционирования».

Unit после этого: 2304/2307.

**Axe на главной ловил анимацию.** Новый первый экран отрисовывается быстрее прежнего, и axe успевал проверить
плашку «Booking.com» в макете в середине её появления: текст был полупрозрачным, контраст 1,57. В покое страница
проходит axe в обеих темах. Теперь спек ждёт конечные анимации перед проверкой (`landing.spec.ts`), бесконечные
не ждёт. Результат: сайт 18/18.

**Стойка для живых e2e собиралась заново.** Первый живой прогон дал 24/25: `desk-day` не нашёл очередь «Требуют
внимания». Причина была не в коде: `apps/web/.next` остался собранным в 07:27 от дерева без Главной A3, а стенд
поднимает `next start` без пересборки (TESTING.md §4). Сначала мешали и остатки ночного UI-прогона на :3100. После
`npm run build -w apps/web` результат 25/25. Прогоны на старой сборке записаны в журнал как есть.

## 3. Номера, мусор, миграции

- **ADR.** Двойные номера — только шесть известных (015, 049, 050, 052, 056, 100), новых нет.
- **Q.** Двойных номеров нет.
- **Дифф против `main`.** 157 файлов. Нет `next-env.d.ts`, `.next`, `.env`, секретов и миграций `…029_business_location` / `…029_phase2_location`.
- **Миграции.** Релиз новых не приносит. Цепочка кончается `…032_platform_p1_location_not_null`.
  `scripts/ops/check-migrations.sh` на чистом PostgreSQL 16 даёт **RESULT: OK**: в `main` уже есть сравнение
  колонок без учёта порядка (`f14be25b`), поэтому откат `…031` больше не даёт ложный FAIL.

## 4. Регресс на итоговом дереве

| Набор | Результат | Лог |
|---|---|---|
| check-migrations | RESULT: OK | локальный PostgreSQL 16, вся цепочка + откаты |
| typecheck | чисто | `2026-09-29T08-06-12Z-typecheck-462e.log` |
| lint | чисто | `2026-09-29T08-06-36Z-lint-8dbb.log` |
| unit | 2304/2307, 3 пропуска — только macOS (первый прогон 2304/2307 с 3 красными — сторож сайта, §2) | `2026-09-29T08-09-40Z-unit-314b.log` |
| integration | 123/123, свежий `db:local reset` | `2026-09-29T08-11-25Z-integration-c1c4.log` |
| живые e2e с базой | 25/25 на пересобранной стойке | журнал, 29.09 ~08:58 |
| e2e со входом, API ролью `wetop_app` | 26/26 | журнал, 29.09 ~09:00 |
| сайт (`tests/site`) | 18/18 | `2026-09-29T08-52-28Z-e2e-bcba.log` |
| полный UI, один поток | **612/612**, 53 мин | `2026-09-29T08-53-04Z-e2e-e28d.log` |
| сборка `apps/web` (`next build`) | успешно | — |
| сборка `apps/site` (`next build`, статическая) | успешно | — |
| API | сборки нет: `tsx src/main.ts`, как в `deploy/Dockerfile`; доказывают typecheck и запуск в e2e | — |

## 5. Рабочий сервер: что отсюда не проверить

Сеть облачной сессии не пускает к `wetop.ai` и `app.wetop.ai` (прокси отвечает 403), SSH и ключей нет. Поэтому
**версию на сервере, применённые миграции и smoke отсюда подтвердить нельзя.**

По записям в репозитории на рабочей базе применены `026_phase1`, `026_rls_roles`, `027`, `028`, `030` (27.09).
Не подтверждены: `029_manager_role`, `031_remove_legacy_pms_fields`, `032_platform_p1_location_not_null`. Сервер
на 28.09 — `release` = `e0ac75fb` или раньше.

## 6. Выкладка — команды владельцу

`V` — итоговый SHA `main` после перемотки (ниже, в сообщении интеграции). Все шаги — по `docs/deploy.md` §1д и
`reports/platform-p1-cleanup-2026-09-28.md` §4.

```bash
# 0. Перемотать release (с любой машины с доступом к репозиторию). Ожидается fast-forward: e0ac75fb — предок V.
git fetch origin && git push origin <V>:release
#    Через ≤2 мин автовыкладка ОТКАЖЕТ: «в обновлении новые миграции» и перечислит их. Это ожидаемо.

# 1. Бэкап рабочей базы (docs/ops/backups.md) и проверка, что копия читается.

# 2. До миграций — SQL Editor, scripts/ops/platform-p1-report.sql целиком.
#    Ждём: without_location = 0, broken_chain = 0 (объектов может не быть вовсе после ADR-118 — это тоже 0 и 0).

# 3. Сервер, веб-терминал:
cd /root/wetop && V=<вершина из отказа>
rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$V" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL \
    -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
mig status
#    Ждём в списке неприменённых только эти (любое подмножество, в этом порядке):
#      20260927000029_manager_role
#      20260928000031_remove_legacy_pms_fields
#      20260928000032_platform_p1_location_not_null
#    Любая другая — СТОП, прислать вывод.
mig deploy
#    Ошибка «platform_p1_location_not_null: …» — данные не прошли проверку, ничего не изменено; прислать текст.
mig status        # ждём: Database schema is up to date

# 4. После миграций — SQL Editor:
#    SELECT is_nullable FROM information_schema.columns
#     WHERE table_schema='public' AND table_name='properties' AND column_name='location_id';   → NO
#    platform-p1-report.sql ещё раз → broken_chain 0, without_location 0.

# 5. Выкладка кода:
/usr/local/sbin/wetop-auto-deploy --migrations-applied "$V"
#    Скрипт сверит V с origin/release, соберёт api/web, сам проверит /health, /login, /today, /chessboard,
#    /reservations, при неудаче вернёт прежний образ.

# 6. Состояние:
docker compose ps                         # api и web — running/healthy
tail -n 30 /var/log/wetop-deploy.log      # выкладка V без отката
git -C /root/wetop rev-parse HEAD         # = V

# 7. Smoke (с любой машины):
docker compose exec -T api wget -qO- http://127.0.0.1:3001/health   # на сервере: "status":"ok"
curl -s https://api.wetop.ai/health              # "status":"ok"
curl -s -o /dev/null -w '%{http_code}\n' https://app.wetop.ai/login     # 200
curl -s https://api.wetop.ai/auth/options        # "registrationEnabled":false
curl -si -X OPTIONS -H 'Origin: https://wetop.ai' https://app.wetop.ai/api/site-auth/login | head -5   # 204, allow-origin https://wetop.ai
#    Вход владельца: объект есть — /today, /chessboard, /reservations, /guests, /hotel-settings открываются;
#    объекта нет — стойка ведёт на /onboarding.

# 8. Суточная самопроверка и фонд, если в объекте есть брони (как 28.09): cli-day-selfcheck → OK,
#    cli-inventory → расхождение 0.

# 9. Главная wetop.ai (Cloudflare Pages, с Mac владельца):
CLOUDFLARE_ACCOUNT_ID=aa05d3443b086b6c6e6b3392ee17ab56 npm run site:deploy
curl -s https://wetop.ai/ | grep -c "Управляйте отелем из одного окна"   # 1 и больше
curl -s https://wetop.ai/ | grep -c "14 дней"                             # 1 и больше
```

Откат: код — `docs/deploy.md` §4 (образ `pms-lux:rollback-<коммит>`). Схему `032`, если нужно, откатывают через
`down.sql` этой миграции и строку в `_prisma_migrations`, как в отчёте cleanup §4 п. 9. Прежний код с NOT NULL
работает. `REGISTRATION_OPEN` в `.env` не трогать: там `0`, RLS-gate закрыт.
