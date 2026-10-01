# Что делает владелец после разбора 01.10.2026: по шагам

Всё, что можно было сделать из репозитория, сделано в PR #211. Ниже только то, для чего нужны сервер, панели и
решения. Порядок важен: шаги 1, 2 и 7 первыми, они открывают дорогу слиянию; 3, 4 и 5 после слияния и выкладки,
потому что скрипты для них приезжают на сервер с этим PR.

Что прислать мне после каждого шага, написано в конце шага. Я по ответам доделываю свою часть.

---

## Шаг 0. Две вещи с сервера, замеченные 01.10 в 18:26 UTC

- **Диск заполнен на 95 %** (`/` 95,82 ГБ). Сборка образа и ночная копия на полном диске упадут. Безопасно сразу:
  `docker system df`, затем `docker image prune -f` (только висячие слои), `du -sh /root/backups /var/lib/docker
  /var/log`; образы отката `pms-lux:rollback-*` старше недели можно снять `docker rmi`. Журналы:
  `journalctl --vacuum-size=200M`.
- **«System restart required»** и 33 обновления: перезагрузка в тихий час, не перед живой сменой; после неё
  `docker compose ps` в `deploy/`, раннере и дежурном агенте.
- После `up -d --build` стойка ответила 502: `web` в этот момент был `health: starting`. Через полминуты повторить
  `curl -s https://app.wetop.ai/login -o /dev/null -w '%{http_code}\n'`; если снова 502:
  `docker compose -f compose.yml -f compose.hostinger.yml logs --tail 30 web` из `/root/wetop/deploy`.

## Шаг 1. Поднять раннер `wetop` (10 минут, сервер)

Он не берёт задачи с 14:50 UTC 01.10. Без него проверки `lint · typecheck · unit · главная`, `UI` и `pytest` не
завершатся, рулсет не пропустит слияние, а `promote-release.sh` не сдвинет `release`.

```bash
cd /root/wetop
docker compose -f scripts/ops/ci-runner/compose.yml ps
docker compose -f scripts/ops/ci-runner/compose.yml logs --tail 30 runner
```

- В логе есть `Listening for Jobs`, контейнер `Up`: раннер жив, задачи возьмёт сам.
- Контейнера нет или он `Restarting`: `docker compose -f scripts/ops/ci-runner/compose.yml up -d --build`.
- **В логе по кругу «Request headers must contain only ASCII characters» на шаге Authentication** (так было
  01.10 в 18:26 UTC): в `.env` раннера токен или адрес с не-ASCII символом. Чаще всего это многоточие «…»,
  оставшееся от примера `RUNNER_TOKEN=…`, или неразрывный пробел из буфера обмена. Найти строку:

  ```bash
  grep -nP '[^\x00-\x7F]' /root/wetop/scripts/ops/ci-runner/.env
  ```

  Дальше новая регистрация (токен живёт час, старый всё равно просрочен): GitHub → Settings → Actions → Runners →
  New self-hosted runner → Linux → скопировать только значение после `--token` → в `.env` строка
  `RUNNER_TOKEN=<значение>` без кавычек и пробелов, `RUNNER_REPO_URL=https://github.com/GAIVER007/wetop.ai` →

  ```bash
  cd /root/wetop
  docker compose -f scripts/ops/ci-runner/compose.yml down -v
  docker compose -f scripts/ops/ci-runner/compose.yml up -d --build
  docker compose -f scripts/ops/ci-runner/compose.yml logs --tail 20 runner     # ждём «Listening for Jobs»
  ```

  После PR #211 вход раннера сам отказывает словами на не-ASCII, вместо цикла.
- В логе `not configured`, `invalid token`, `runner version … deprecated`: та же новая регистрация, что выше.

Проверка: GitHub → Settings → Actions → Runners: `wetop` зелёный, `Idle` или `Active`; в PR #211 задачи своего
раннера перешли из «Queued» в работу.

**Прислать:** «раннер поднят» или последние строки лога, если не поднялся.

## Шаг 2. Настройки GitHub (10 минут, браузер)

1. Settings → Rules → Rulesets → New ruleset → **Import a ruleset** → файл `docs/ops/github-rulesets/main.json`
   из репозитория → Create. То же с `docs/ops/github-rulesets/release.json`.
   Проверка: в списке два активных рулсета; внизу PR #211 три проверки помечены `Required`.
2. Settings → General → Features: снять галочку **Allow forking**.
3. Settings → Actions → General: **Fork pull request workflows from outside collaborators** →
   «Require approval for all outside collaborators»; **Workflow permissions** → «Read repository contents and
   packages permissions»; Save.

**Прислать:** «рулсеты импортированы» (если импорт отказал, снимок ошибки: тогда настрою таблицей из
`docs/ops/github-protection.md` §1).

## Шаг 7 (делается до слияния). Что применено на рабочей базе (5 минут, Supabase)

Supabase → проект WETOP → SQL Editor:

```sql
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 6;
```

**Прислать:** шесть строк вывода. По ним я решу до слияния:

- есть `20260930000039_seller_profile_agent_key`: верну её из `migrations-held` в цепочку в этом же PR, применять
  ничего не нужно;
- нет `…038_rls_integration_grants` и `…040_reservation_creation_key`: их надо применить при первой выкладке (шаг 8),
  порядок уже описан в `docs/ops/rls.md` («стадия B») и `docs/deploy.md` §1д.

## Шаг 6. Откат при живой смене, Q-237 (5 минут решения, учения отдельно)

Ответить в чате четырьмя строками, я впишу в `CUTOVER.md` и закрою вопрос:

1. Четыре уровня отката из `CUTOVER.md` ROLLBACK (код, база, канал в ручной экстранет, всё в стоп-продажи):
   принимаете или меняете.
2. Время полного отката, минут: после учений на сервере, не оценка.
3. Дата тихих суток для учений: день с минимумом заездов.
4. Дежурный первой ночи: имя. Телефон в описание группы дежурных в Telegram, в репозиторий он не идёт.

## Решение по сквозным тестам (нужно до или сразу после слияния)

На `main` с 01.10 форма новой брони переставлена (коммиты codex `a7065b1`, `6c4d0f1`, `e8b3914`): «Источник» ушёл под
свёрнутый блок «Дополнительно», цена читается иначе. 13 живых сквозных спеков из 25 на это падают, и теперь это видно в
задаче `db` в CI (раньше её маскировали красные интеграционные). Один ответ в чат: **(а)** переписать спеки под новую
форму (сделаю отдельным PR) или **(б)** вернуть «Источник» на видное место формы. До ответа задача `db` красная на шаге
сквозных; слиянию PR #211 это не мешает, в обязательные проверки рулсета она не входит.

## Шаг 8. Слияние и первая выкладка (после шагов 1, 2 и 7)

1. Слияние PR #211: ваше слово «вливай», сливаю я или вы кнопкой.
2. На Mac, в клоне, с вошедшим `gh` (`gh auth status`):

   ```bash
   git fetch origin main
   scripts/ops/promote-release.sh origin/main
   ```

   Скрипт покажет проверки на вершине и спросит «да». Красная или незавершённая проверка: он откажет, и это
   правильно.
3. Сервер в течение двух минут откажет выкладывать один раз: либо «из цепочки сняты миграции (…039)», либо
   «в обновлении миграции (…038 …040)». В первом случае ничего не применять. Во втором: по `docs/deploy.md` §1д,
   сначала копия базы (`$BACKUP` из `docs/ops/backups.md`), потом `mig status`, `mig deploy`, `mig status`.
4. Затем на сервере: `/usr/local/sbin/wetop-auto-deploy --migrations-applied <вершина из сообщения>`. Через три
   минуты в Telegram придёт «выложен».
5. `cd /root/wetop && git pull`: скрипты шагов 3, 4 и 5 на сервере.

**Прислать:** сообщение автовыкладки «выложен за N с».

## Шаг 3. Ключ дежурного агента (15 минут, консоль Anthropic и сервер; после шага 8)

1. console.anthropic.com → Settings → Workspaces → Create workspace, имя `wetop-guard` (у отдельного workspace
   свой предел расхода и свой отзыв) → в нём Limits → Monthly spend limit, например 20 USD.
2. API keys → Create key в workspace `wetop-guard` → скопировать, больше он не показывается.
3. На сервере:

   ```bash
   cd /root/wetop
   nano scripts/ops/guard/.env     # удалить строку CLAUDE_CODE_OAUTH_TOKEN=…, добавить ANTHROPIC_API_KEY=…
   docker compose -f scripts/ops/guard/compose.yml up -d --build
   docker compose -f scripts/ops/guard/compose.yml logs --tail 20 guard-agent
   grep -c '^CLAUDE_CODE_OAUTH_TOKEN=' scripts/ops/guard/.env    # ждём 0
   ```

   В логе ждём «тихий час» или «есть что разобрать». Если там «в .env дежурного агента стоит
   CLAUDE_CODE_OAUTH_TOKEN», строка не удалена: скрипт нарочно не стартует.

**Прислать:** «агент на ключе».

## Шаг 4. Вторая копия базы вне сервера (20 минут, Cloudflare и сервер; после шага 8)

1. Cloudflare → R2 Object Storage → Create bucket: имя `wetop-backups`, location Automatic → Create.
   В ведре: Settings → Object lifecycle rules → Add rule → удалять объекты старше 30 дней → Save.
2. R2 → Manage R2 API Tokens → Create API token: имя `wetop-backups-write`, Permissions «Object Read & Write»,
   Specify bucket `wetop-backups`, TTL Forever → Create. Записать Access Key ID, Secret Access Key и endpoint вида
   `https://<account_id>.r2.cloudflarestorage.com` (показан на той же странице).
3. Пароль шифрования на Mac: `openssl rand -base64 24`. Положить в менеджер паролей. Если сервер пропадёт вместе с
   `.env`, копию без этого пароля не прочитать.
4. На сервере в `/root/wetop/.env` четыре строки (значения в чат не диктовать):

   ```
   BACKUP_OFFSITE_URL=https://<account_id>.r2.cloudflarestorage.com/wetop-backups
   BACKUP_OFFSITE_KEY_ID=…
   BACKUP_OFFSITE_SECRET=…
   BACKUP_OFFSITE_PASSPHRASE=…
   ```

5. Проба:

   ```bash
   cd /root/wetop && scripts/ops/db-backup-offsite.sh
   cat /root/backups/status/offsite.json
   ```

   Ждём строку `db-backup-offsite: wetop-…Z.dump.enc, N байт, в хранилище на <account_id>.r2.cloudflarestorage.com`;
   в панели R2 в ведре появился объект `.enc`.
6. В cron той же строкой, что ночная копия (переменная `$BACKUP` из `docs/ops/backups.md`, раздел «Установка»):

   ```bash
   BACKUP='docker run --rm -v /root/wetop/scripts/ops/db-backup.sh:/db-backup.sh:ro -v /root/wetop/.env:/wetop.env:ro -v /root/backups:/root/backups -e ENV_FILE=/wetop.env postgres:17 bash /db-backup.sh'
   ( crontab -l 2>/dev/null | grep -v 'db-backup'
     echo "30 23 * * * $BACKUP >> /var/log/wetop-db-backup.log 2>&1 && cd /root/wetop && scripts/ops/db-backup-offsite.sh >> /var/log/wetop-db-backup.log 2>&1" ) | crontab -
   crontab -l | grep db-backup
   ```

7. Раз в месяц на Mac: скачать свежий `.enc` из R2 и проверить, что он читается:

   ```bash
   read -s OFFSITE_PASS && export OFFSITE_PASS
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -pass env:OFFSITE_PASS -in wetop-….dump.enc -out wetop-….dump
   ```

   Дальше проба восстановления из `docs/ops/backups.md`.

**Прислать:** строку пробы из п. 5.

## Шаг 5. Channex, боевой объект (5 минут, сервер; после шага 8)

Скрипт живёт в образе API, ключ Channex уже в `.env` сервера. **Только после слияния PR #211 и выкладки:** на образе
`release` до него команда отвечает `Cannot find module …/cli-channex-property-settings.ts` (так было 01.10 в 18:27 UTC,
это ожидаемо, не поломка). Раньше выкладки можно с Mac из клона на ветке PR, ключ и адрес боевого Channex из `.env`
сервера, объект по id из панели Channex:

```bash
CHANNEX_API_BASE_URL=https://app.channex.io/api/v1 CHANNEX_API_KEY=<ключ> \
  npx tsx scripts/reconciliation/src/cli-channex-property-settings.ts --property=<id объекта>
```

На сервере после выкладки:

```bash
cd /root/wetop/deploy
docker compose -f compose.yml -f compose.hostinger.yml exec -w /app api node --import tsx scripts/reconciliation/src/cli-channex-property-settings.ts
```

Покажет три поля. Если «отличаются от рекомендации», повторить с `--apply`:

```bash
docker compose -f compose.yml -f compose.hostinger.yml exec -w /app api node --import tsx scripts/reconciliation/src/cli-channex-property-settings.ts --apply
```

Скрипт меняет только эти настройки, остатки и цены не трогает. Проверка в панели Channex: Properties → объект →
Settings: «Allow availability autoupdate on modification» и «… on cancellation» сняты, «… on confirmation» стоит.

**Прислать:** вывод «после записи».

---

## Что я делаю сам, без вас

- Слежу за PR #211: проверки, слияние `main`, ревью. Красное чиню и пушу.
- По ответу шага 7 возвращаю 039 в цепочку или оставляю отложенной.
- По ответу шага 6 вписываю откат в `CUTOVER.md` и закрываю Q-237.
- После зелёного прогона задачи `db` на `main` добавляю её в обязательные проверки рулсета и в
  `promote-release.sh`.
- После шага 1 проверяю, что `fast`, `UI` и `pytest` прошли, и говорю, можно ли сливать.
