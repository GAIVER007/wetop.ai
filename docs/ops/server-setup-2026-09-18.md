# Сервер на ps.kz: шаги 1–3 плана переезда, по командам

> **Обновлено 22.09.2026 по сверке с репозиторием.** Лист писался 18.09 под переезд «Mac → ps.kz». С тех пор PMS
> работает на сервере Hostinger под Docker (19.09, `187.77.145.152`), Exely больше не источник и база обнулена
> (ADR-052; Q-151 закрыт: «пустая база без Exely»), вход — пароль приложения, Cloudflare Access снят (ADR-053).
> Переезд теперь «Hostinger → ps.kz». Поправлено: версия базы и клиент PostgreSQL — источник Supabase работает на
> PostgreSQL 17.6, и `pg_dump` 16 его не снимет (§1, §2.1, §5); ветка `main` вместо удалённой рабочей (§2, §2.3);
> `.env` — с действующего сервера, а не с Mac (§2.4); пулы без `exely-sync` (§4); наполнение базы после ADR-052 и
> сверка строк (§5); первый запуск как «вторая копия» рядом с боевой, без `exely-sync` и без фоновых работ с Channex
> (§6); серверное наложение `compose.hostinger.yml` (§6а); переключение и сторож (§8). Решения владельца здесь не
> принимаются: версия базы на ps.kz (§1), кто платит (Q-070а), как брони попадут в PMS до переключения каналов (Q-167).

Дата: 18.09.2026. Продолжение `plans/server-kz-2026-09-17.md`; общее ТЗ — `plans/server-kz-tz-2026-09-18.md`;
выбор площадки — `docs/ops/server-kz-2026-09-16.md`. Слито 18.09 из двух листов команд (этой сессии и
параллельной, `plans/server-kz-2026-09-18.md`): один файл, ничего не выброшено.

Кто что делает: панель ps.kz, ключи и `.env` — только владелец (`SECURITY.md` §3); все команды на сервере
выполняет владелец по SSH, агент разбирает вывод, который владелец вставляет в чат (агент до ps.kz не
достаёт ни с одной стороны — проверено 18.09). Ни одна команда ниже не трогает на запись Mac, Exely,
Channex и старую базу. Ключи и пароли в чат не диктуются.

Что уже доказано без сервера: миграции ложатся на чистый PostgreSQL 16 и откатываются снимок в снимок
(`reports/migrations-clean-postgres-2026-09-15.md`); образ и службы описаны и проверены тестами
(`tests/unit/deploy-server.test.ts`); скрипт первичной настройки прогнан от root на Linux
(`tests/unit/server-bootstrap.test.ts`). Что доказывается только здесь: сборка образа, службы `api` и `web` живьём,
`ari.sh` под Docker, `migrate deploy` и права на `btree_gist`.

---

## 1. В панели ps.kz (владелец)

Нужны две вещи, **обе в одном регионе** (Алматы или Астана, но один и тот же для обеих):

1. **Управляемый PostgreSQL** (DBaaS), версия **17, если ps.kz её даёт, иначе 16** (поправка 22.09.2026: здесь
   стояло «16»). Боевая база сейчас — Supabase на PostgreSQL 17.6, тесты проекта гоняются на 16
   (`npm run db:local`), миграции ложатся на обе. С 17 копия переносится без понижения версии, с 16 — см.
   оговорку в §5. При создании или сразу после:
   - включить расширение **`btree_gist`**, если панель даёт такой переключатель. Миграция
     `20260909000003_rates_and_overbooking_guard` делает `CREATE EXTENSION IF NOT EXISTS btree_gist` сама, но на
     управляемой базе у пользователя приложения может не быть на это прав — тогда `migrate deploy` упадёт ровно
     на этой строке. Это защита от овербукинга, обойти её нельзя;
   - записать предел одновременных подключений (обычно виден в карточке базы). От него зависит §4;
   - включить ежедневные бэкапы, если они не включены по умолчанию. Это и есть ответ на Q-073.
2. **Виртуальный сервер**: Ubuntu 24.04 LTS, 2 vCPU, 4 ГБ памяти, диск от 40 ГБ. Нагрузка объекта такой
   машине мала (36 коек, ~1300 операций в месяц), запас нужен под сборку образа, а не под работу.

Вставить в чат, **без пароля базы**: хост и порт базы, имя базы, имя пользователя, версию PostgreSQL, предел подключений,
публичный IP сервера, регион. Пароль базы — только в `.env` на сервере.

---

## 2. Подготовка сервера (владелец, один раз)

Зайти по SSH под пользователем, которого выдал ps.kz (обычно `root` или `ubuntu`).

**Весь раздел — одна команда.** Скрипт `deploy/server-bootstrap.sh` делает §2.1–§2.3 сам и повторный запуск
переживает без вреда: Docker из официального репозитория, пользователь `pms` в группе `docker`, ключ доступа
к репозиторию только на чтение, клон нужной ветки, папка под туннель. Скрипта в клоне ещё нет, поэтому
первый раз он скачивается отдельно:

```bash
curl -fsSLo /tmp/bootstrap.sh https://raw.githubusercontent.com/GAIVER007/wetop.ai/main/deploy/server-bootstrap.sh
sudo bash /tmp/bootstrap.sh --branch main          # прежняя рабочая ветка влита и удалена 22.09
```

Репозиторий приватный, и без ключа `curl` вернёт 404. Тогда файл копируется с Mac или с сервера Hostinger, где
клон уже есть (`/root/wetop/deploy/server-bootstrap.sh`):
`scp deploy/server-bootstrap.sh <пользователь>@<IP-сервера>:/tmp/bootstrap.sh`.

Первый запуск остановится с кодом 3 и напечатает публичный ключ: добавить его в GitHub (репозиторий →
Settings → Deploy keys → Add, **без** «Allow write access») и запустить ту же команду второй раз — она
докачает репозиторий и скажет, что дальше. Вставить в чат вывод второго запуска.

Механика скрипта (пользователь, ключ, клон, повторный запуск) доказана тестом от root на Linux —
`tests/unit/server-bootstrap.test.ts`; установка Docker доказывается только на сервере. Ниже — те же шаги
руками, на случай если скрипт где-то споткнётся, плюс клиент PostgreSQL, который скрипт не ставит.

### 2.1 Docker и клиент PostgreSQL

Compose нужен не старше **2.24**: `deploy/compose.yml` использует `env_file` с `required: false`
(выключатель ARI). Клиент PostgreSQL нужен не ниже версии сервера, иначе `pg_dump` откажется работать.
**Источник копии — Supabase на PostgreSQL 17.6, поэтому клиент — 17** (поправка 22.09.2026: здесь стоял 16, и
`pg_dump` упал бы в §5). В репозитории Ubuntu 24.04 клиента 17 нет — сначала репозиторий PGDG, как на
postgresql.org:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSLo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
sudo apt-get update && sudo apt-get install -y postgresql-client-17
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker compose version          # ждём 2.24 или новее
psql --version                  # ждём 17.x (клиент 17 работает и с базой 16)
```

Клиент 16 отсюда не ставить: `pg_dump` 16 откажется снимать базу 17 (§7).

### 2.2 Отдельный пользователь для системы

Не запускать от `root`: у контейнеров и так `USER node`, но и хозяин файлов пусть будет обычным.

```bash
sudo adduser --disabled-password --gecos '' pms
sudo usermod -aG docker pms
sudo su - pms
```

### 2.3 Доступ к репозиторию только на чтение

Репозиторий приватный (`SECURITY.md` §4). Серверу нужен **deploy key** только на чтение, а не ваш личный ключ.

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/wetop-deploy -C 'wetop server'
cat ~/.ssh/wetop-deploy.pub
```

Публичный ключ добавить в GitHub: репозиторий → Settings → Deploy keys → Add, **без** галочки «Allow write
access». Затем:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/wetop-deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
git clone git@github.com:GAIVER007/wetop.ai.git ~/wetop && cd ~/wetop
git checkout main                                  # прежняя рабочая ветка влита и удалена 22.09
```

### 2.4 `.env` — один, в корне клона

**Одно место.** Оттуда его читают и compose (`../.env`), и `main.ts`, и `cli-check-env.ts`, и
`prisma migrate deploy`, и все скрипты сверки. Ни в `deploy/`, ни где-либо ещё: два файла разъезжаются.

Источник — `.env` **действующего сервера Hostinger** (`/root/wetop/.env`): с 19.09 рабочие ключи там, а `.env` на
Mac — для локальной разработки и может отличаться (поправка 22.09.2026). Переносит владелец своим путём
(веб-терминал панели Hostinger, `scp` между серверами), не печатая значения в чат и журнал. На новом сервере:

```bash
chmod 600 ~/wetop/.env                                 # на сервере ps.kz
```

Что в нём правится на месте (значения вписывает владелец):

- `DATABASE_URL` — строка подключения к базе ps.kz;
- `DATABASE_SCHEMA` — **не задавать**: рабочие данные живут в `public`;
- `PII_STORAGE` — пока **не трогать**: включается после наполнения базы и сверки строк (§5) и только на этой
  базе (условие допуска `CUTOVER.md`);
- `DATABASE_POOL_MAX` — см. §4;
- `REGISTRATION_OPEN` — перенести `0` **явно**: с 22.09 вечера на Hostinger регистрация закрыта
  (`reports/deploy-2026-09-22.md`; ADR-060, ADR-061 — пока нет Row Level Security), а пустое или отсутствующее
  значение её открывает (ADR-055). Открыть — только отдельным решением владельца (Q-157);
- фоновые работы с Channex и сторож — **выключить до переключения туннеля** (§6, `docs/deploy.md` §1б);
- `API_HOST` — **не задавать**: его задаёт compose внутри контейнера, на хосте умолчание `127.0.0.1`.

Проверка без печати значений (`--ignore-scripts` — чтобы не генерировать клиент базы дважды, он сгенерируется в §3):

```bash
mkdir -p ~/wetop/deploy/cloudflared                    # ключ и конфиг туннеля — шаг 4 плана, не сейчас
cd ~/wetop && npm ci --ignore-scripts && npx tsx scripts/imports/src/cli-check-env.ts
```

---

## 3. Схема на пустой базе (владелец, агент читает вывод)

Боевую миграцию делает владелец (`AGENTS.md` §15). `DATABASE_URL` живёт в `.env` и сам в оболочку не
попадает — его надо поднять явно. Сначала — что база та и пустая:

```bash
cd ~/wetop && set -a && . ./.env && set +a
psql "$DATABASE_URL" -c "select version(), current_setting('TimeZone'), (select count(*) from pg_tables where schemaname='public') as tables"
```

Ждём: PostgreSQL той версии, что выбрана в §1, таблиц 0. Затем:

```bash
npm ci                                            # тут же сгенерируется клиент Prisma (postinstall)
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npx prisma migrate status --schema packages/database/prisma/schema.prisma
psql "$DATABASE_URL" -c "select extname from pg_extension where extname='btree_gist'"
```

Ждём: все миграции применены, `btree_gist` в списке. Вставить оба вывода в чат.

Откат схемы (`down.sql` у каждой миграции) здесь заново не гоняется: он доказан на чистом PostgreSQL 16
15.09.2026 и повторно 22.09.2026 (18 миграций, `RESULT: OK`), а `check-migrations.sh` на чужой сервер не пойдёт по построению — он создаёт и удаляет базы.

---

## 4. Пул соединений — считать до запуска

У управляемой базы есть предел одновременных подключений (записан в §1). Сумма пулов всех служб обязана
быть **меньше** него с запасом на `psql` и разовые скрипты. 15.09.2026 переполнение пулера давало 500 на
стойке и «connection timeout» в журнале API. По умолчанию: API — 5 (служба `exely-sync` снята ADR-052), плюс разовые скрипты.

- предел базы 20 и больше — ничего не менять;
- предел меньше — вписать в `.env` `DATABASE_POOL_MAX=3`;
- разовые скрипты запускать с `DATABASE_POOL_MAX=1` (`TESTING.md`).

---

## 5. Данные: чем наполнять новую базу (владелец; Q-151 закрыт ADR-052)

**Решено 19.09.2026 (ADR-052, Q-151): пустая база без Exely.** Поправка 22.09.2026: раньше здесь стояла развилка
«копия или импорт». Броней, гостей, оплат и счетов в источнике нет — их стёрли при очистке 19.09. Копией переносятся
объект, фонд (88 единиц, 5 категорий), тарифы и цены по дням, политики штрафа тарифов, сопоставление с Channex,
счётчик сайта, организации и учётные записи. Импорт из Exely здесь не делается, дамп до очистки
(`/root/backups/luxx-before-reset-2026-09-19.dump` на сервере Hostinger) не восстанавливается. Как брони попадут в
PMS до переключения каналов — Q-167.

Выполняет владелец: в выгрузке почты и хеши паролей учётных записей. Источник только читается — не выключается и не
меняется.

```bash
# SRC — строка подключения к Supabase (действующая база), DST — к ps.kz
pg_dump --version                                    # ждём 17.x: 16 откажется снимать базу 17 (§2.1)
pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
  --exclude-table='_prisma_migrations' -Fc -f ~/luxx-data.dump
pg_restore --dbname="$DST" --data-only --no-owner --no-privileges --disable-triggers ~/luxx-data.dump
rm ~/luxx-data.dump
psql "$DST" -c "select conname from pg_constraint where convalidated = false"    # ждём пусто
```

Если база на ps.kz — 16, а копия снята клиентом 17, `pg_restore` может ругнуться на параметры, которых в 16 нет
(например, `transaction_timeout`); данные при этом ложатся. Любую другую ошибку — в чат, дальше не идти.

Сверка «источник = новая база» — точное число строк в каждой таблице:

```bash
cat > /tmp/counts.sql <<'SQL'
select format('select %L, count(*) from public.%I', tablename, tablename)
  from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations' order by tablename \gexec
SQL
psql "$SRC" -Atf /tmp/counts.sql > /tmp/src.txt
psql "$DST" -Atf /tmp/counts.sql > /tmp/dst.txt
diff /tmp/src.txt /tmp/dst.txt && echo 'строки сошлись'
```

Ждём «строки сошлись». Таблицу, которая есть в источнике, но не в новой базе, `diff` тоже покажет — это таблица
вне миграций, вывод вставить в чат.

Копия устаревает с первой же записью на Hostinger (живой день, брони staging через webhook). Поэтому перед
переключением туннеля её снимают **заново**, остановив запись на Hostinger (§8), а этот прогон — проверка процедуры.

Схему ставим миграциями (§3), а не дампом: так новая база гарантированно та, что описана в
`DATA_MODEL.md`, а не снимок чужого состояния. `--disable-triggers` нужен, потому что данные ложатся не в
порядке внешних ключей. Последовательности чинить не надо: в схеме нет ни одного `autoincrement`.

Политики штрафа тарифов живут в данных и едут этой копией. Если базу когда-нибудь собирают заново без копии, их
ставит только `scripts/imports/src/cli-set-cancellation-policies.ts` (находка 22.09.2026 на ветке
`claude/laughing-maxwell-z7yke5`, в `main` ещё не влита).

---

## 6. Первый запуск без туннеля (владелец запускает, агент читает)

```bash
cd ~/wetop && printf 'CHANNEX_ARI=off\n' > deploy/ari.env    # до первого up: боевая копия пока на Hostinger
docker compose -f deploy/compose.yml up -d --build api web       # exely-sync снят ADR-052
docker compose -f deploy/compose.yml ps
```

Портов наружу нет — проверять изнутри сети compose:

```bash
docker compose -f deploy/compose.yml exec -T api node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.text()).then(console.log)"
docker compose -f deploy/compose.yml exec -T api node -e "fetch('http://127.0.0.1:3001/inventory/summary').then(r=>r.text()).then(t=>console.log(t.slice(0,400)))"
docker compose -f deploy/compose.yml exec -T web node -e "fetch('http://127.0.0.1:3000/login').then(r=>console.log('стойка:',r.status))"
bash scripts/ops/ari.sh status
```

Ждём: два контейнера (`api`, `web`) `healthy`; `/health` → `{"status":"ok","database":"up",…}`; сводка фонда — 88 единиц;
стойка 200; `ari.sh status` → `машина: docker`, `API сейчас: CHANNEX_ARI=off`. Это же — доказательство
сборки образа и `ari.sh` под Docker.

**Пока боевая копия работает на Hostinger, новая — «вторая копия» по `docs/deploy.md` §1б** (поправка 22.09.2026:
лист ждал `CHANNEX_ARI=on`, и две машины отправляли бы остатки в один объект Channex). До переключения туннеля в
`.env` на ps.kz: `GUARD=off`, `CHANNEX_PULL=off`, `CHANNEX_OUTBOX_WORKER=off`, `CHANNEX_FULL_SYNC=off`,
`CHANNEX_WEBHOOK_HEALTH=off`, плюс `deploy/ari.env` выше. Включаются в момент переключения (§8).

Туннель (`cloudflared`) здесь **намеренно не поднимается** — это шаг 4 плана, отдельно и только после сверки
двух баз. Пока он не поднят, `api.wetop.ai` и `app.wetop.ai` по-прежнему смотрят туда, где туннель работает
сейчас, и ничего не ломается.

Вставить в чат вывод `ps`, `/health`, начало сводки фонда и `ari.sh status`. Сквозная сверка с Exely
(`cli-system-trace.ts`) после ADR-052 не годится: новую базу проверяют сверка строк из §5 и
`npm run reconcile:selfcheck -- <дата>`, запущенный в контейнере API так же, как разовые скрипты в
`docs/deploy.md` §1а.

---

## 6а. Серверное наложение `compose.hostinger.yml` (владелец, до переезда)

На Hostinger compose запускают с серверным наложением: `docker compose -f compose.yml -f compose.hostinger.yml …`
(`docs/deploy.md` §1а, `reports/deploy-2026-09-20.md`). Файл лежит только на сервере
(`/root/wetop/deploy/compose.hostinger.yml`); в git его нет ни в одной ветке, и что в нём, в репозитории не
записано (проверено 22.09.2026). Переносить вслепую нельзя, поэтому до переезда:

1. на Hostinger: `cat /root/wetop/deploy/compose.hostinger.yml` — проверить, нет ли в нём ключей, паролей, токенов
   (их место — `.env`);
2. текст без секретов — в чат или в репозиторий образцом рядом с `deploy/compose.yml`; агент разберёт, что из него
   нужно на ps.kz, а что относится только к Hostinger;
3. на ps.kz запускать с тем набором файлов compose, который получится после разбора, иначе новая машина поднимет
   не ту конфигурацию, что проверена в работе.

---

## 7. Что может пойти не так, и что это значит

| Симптом | Причина | Что делать |
|---|---|---|
| `pg_dump: error: aborting because of server version mismatch` | клиент старше источника: Supabase — PostgreSQL 17 | поставить `postgresql-client-17` (§2.1) |
| `migrate deploy` падает на `CREATE EXTENSION` | у пользователя нет прав на расширения | включить `btree_gist` в панели ps.kz или попросить поддержку |
| `docker compose version` меньше 2.24 | старый Docker из репозитория Ubuntu | ставить из репозитория Docker (§2.1) |
| `up --build` падает на `npm ci` внутри образа | манифест рабочего пакета не скопирован | это ловит `tests/unit/deploy-server.test.ts`; сообщить агенту |
| `up --build` падает на `npm run build -w apps/web` по памяти | 4 ГБ и сборка Next | `NODE_OPTIONS=--max-old-space-size=3072`, либо временно добавить swap |
| `cli-check-env.ts` пишет «НЕ ЗАДАН» по всем ключам | `.env` не в корне клона | §2.4: файл только в `~/wetop/.env` |
| `/health` → `degraded`, `database: down` | пул не достаёт базу: адрес, пароль, предел подключений | `docker compose -f deploy/compose.yml logs --tail=50 api`, §4 |
| 500 на стойке, в журнале «connection timeout» | сумма пулов больше предела базы | §4 |
| `pg_restore` ругается на права | `--no-owner --no-privileges` пропущены | повторить с ними |
| `ari.sh stop` пишет «ARI НЕ остановлен» | контейнер пересоздан, но переменную не увидел | проверить `env_file` в `deploy/compose.yml` и что `deploy/ari.env` записан |

---

## 8. Чего этот лист не делает

Переключение — следующие этапы ТЗ, каждый со своей сверкой (поправка 22.09.2026: здесь были снятие служб с Mac и
launchd, их больше нет). Порядок, который из фактов следует:

1. остановить запись на Hostinger (API и стойка) и снять копию базы **заново** по §5 — первая копия к этому
   моменту устарела;
2. туннель — ровно один коннектор: сейчас он на Hostinger (`187.77.145.152`), там его остановить, здесь поднять
   (`deploy/cloudflared.example.yml`, с 22.09 без блока Cloudflare Access — его снял ADR-053; иначе стойка не
   откроется без токена Access);
3. на ps.kz включить то, что выключено по §6, и проверить webhook Channex на `api.wetop.ai`;
4. `PII_STORAGE=real` — только здесь (условие допуска `CUTOVER.md`);
5. сторож и дежурный агент — на новой машине (ADR-067, проект `pms-lux-guard`); внешний сторож `pms-lux-watch`
   должен жить **не** на той машине, где PMS: 22.09 оба на `187.77.145.152`, и при падении сервера сообщения
   в Telegram не будет. После переезда он остаётся на Hostinger — это и есть другая машина: `GUARD_HEARTBEAT_URL`
   и `GUARD_HEARTBEAT_SECRET` в `.env` на ps.kz указывают на него, сигнал идёт, когда в шаге 3 включён `GUARD`.

Старая машина до конца сверки не выключается.
