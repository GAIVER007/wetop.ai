# Сервер на ps.kz: шаги 1–3 плана переезда, по командам

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
(`tests/unit/server-bootstrap.test.ts`). Что доказывается только здесь: сборка образа, три службы живьём,
`ari.sh` под Docker, `migrate deploy` и права на `btree_gist`.

---

## 1. В панели ps.kz (владелец)

Нужны две вещи, **обе в одном регионе** (Алматы или Астана, но один и тот же для обеих):

1. **Управляемый PostgreSQL** (DBaaS), версия **16**. При создании или сразу после:
   - включить расширение **`btree_gist`**, если панель даёт такой переключатель. Миграция
     `20260909000003_rates_and_overbooking_guard` делает `CREATE EXTENSION IF NOT EXISTS btree_gist` сама, но на
     управляемой базе у пользователя приложения может не быть на это прав — тогда `migrate deploy` упадёт ровно
     на этой строке. Это защита от овербукинга, обойти её нельзя;
   - записать предел одновременных подключений (обычно виден в карточке базы). От него зависит §4;
   - включить ежедневные бэкапы, если они не включены по умолчанию. Это и есть ответ на Q-073.
2. **Виртуальный сервер**: Ubuntu 24.04 LTS, 2 vCPU, 4 ГБ памяти, диск от 40 ГБ. Нагрузка объекта такой
   машине мала (36 коек, ~1300 операций в месяц), запас нужен под сборку образа, а не под работу.

Вставить в чат, **без пароля базы**: хост и порт базы, имя базы, имя пользователя, предел подключений,
публичный IP сервера, регион. Пароль базы — только в `.env` на сервере.

---

## 2. Подготовка сервера (владелец, один раз)

Зайти по SSH под пользователем, которого выдал ps.kz (обычно `root` или `ubuntu`).

**Весь раздел — одна команда.** Скрипт `deploy/server-bootstrap.sh` делает §2.1–§2.3 сам и повторный запуск
переживает без вреда: Docker из официального репозитория, пользователь `pms` в группе `docker`, ключ доступа
к репозиторию только на чтение, клон нужной ветки, папка под туннель. Скрипта в клоне ещё нет, поэтому
первый раз он скачивается отдельно:

```bash
curl -fsSLo /tmp/bootstrap.sh https://raw.githubusercontent.com/GAIVER007/wetop.ai/claude/trusting-ramanujan-gi6uzl/deploy/server-bootstrap.sh
sudo bash /tmp/bootstrap.sh --branch claude/trusting-ramanujan-gi6uzl
```

Репозиторий приватный, и без ключа `curl` вернёт 404. Тогда файл копируется с Mac:
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

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git postgresql-client-16
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker compose version          # ждём 2.24 или новее
psql --version                  # ждём 16.x
```

Если `postgresql-client-16` не находится, добавить репозиторий PGDG:
`sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'`
и ключ `https://www.postgresql.org/media/keys/ACCC4CF8.asc`.

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
git checkout claude/trusting-ramanujan-gi6uzl     # или main, когда ветка влита
```

### 2.4 `.env` — один, в корне клона

**Одно место.** Оттуда его читают и compose (`../.env`), и `main.ts`, и `cli-check-env.ts`, и
`prisma migrate deploy`, и все скрипты сверки. Ни в `deploy/`, ни где-либо ещё: два файла разъезжаются.

```bash
scp ~/.env pms@<IP-сервера>:~/wetop/.env              # выполняется НА MAC
chmod 600 ~/wetop/.env                                 # на сервере
```

Что в нём правится на месте (значения вписывает владелец):

- `DATABASE_URL` — строка подключения к базе ps.kz;
- `DATABASE_SCHEMA` — **не задавать**: рабочие данные живут в `public`;
- `PII_STORAGE` — пока **не трогать**: включается на шаге 6 плана, после сверки двух баз (§5, Q-151);
- `DATABASE_POOL_MAX` — см. §4;
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

Ждём: PostgreSQL 16, таблиц 0. Затем:

```bash
npm ci                                            # тут же сгенерируется клиент Prisma (postinstall)
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npx prisma migrate status --schema packages/database/prisma/schema.prisma
psql "$DATABASE_URL" -c "select extname from pg_extension where extname='btree_gist'"
```

Ждём: все миграции применены, `btree_gist` в списке. Вставить оба вывода в чат.

Откат схемы (`down.sql` у каждой миграции) здесь заново не гоняется: он доказан на чистом PostgreSQL 16
15.09.2026, а `check-migrations.sh` на чужой сервер не пойдёт по построению — он создаёт и удаляет базы.

---

## 4. Пул соединений — считать до запуска

У управляемой базы есть предел одновременных подключений (записан в §1). Сумма пулов всех служб обязана
быть **меньше** него с запасом на `psql` и разовые скрипты. 15.09.2026 переполнение пулера давало 500 на
стойке и «connection timeout» в журнале API. По умолчанию: API — 5, `exely-sync` — 1, итого 6.

- предел базы 20 и больше — ничего не менять;
- предел меньше — вписать в `.env` `DATABASE_POOL_MAX=3`;
- разовые скрипты запускать с `DATABASE_POOL_MAX=1` (`TESTING.md`).

---

## 5. Данные: чем наполнять новую базу (владелец, Q-151)

**Развилка, которую решает владелец.** База в Supabase анонимизирована (ADR-018): `PII_STORAGE` там пуст,
гости каналов записаны псевдонимами. Копия даст новой базе те же псевдонимы, и полный импорт из Exely с
`PII_STORAGE=real` всё равно понадобится.

- **Вариант А — копия, потом импорт.** Быстро получить рабочую базу для сверки двух баз, ПД подтянуть позже.
- **Вариант Б — только импорт.** Пустая база, наполненная из Exely сразу с настоящими ПД.

Рекомендация ТЗ: А для запуска и сверки, затем Б перед включением ПД — так сверка и включение ПД разведены.

Вариант А (выполняет владелец: в выгрузке данные гостей, пусть и псевдонимы). Старая база **не выключается**
и не меняется; это чтение:

```bash
# SRC — строка подключения к Supabase (dev-БД), DST — к ps.kz
pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
  --exclude-table='_prisma_migrations' -Fc -f ~/luxx-data.dump
pg_restore --dbname="$DST" --data-only --no-owner --no-privileges --disable-triggers ~/luxx-data.dump
rm ~/luxx-data.dump
psql "$DST" -c "select conname from pg_constraint where convalidated = false"    # ждём пусто
```

Схему ставим миграциями (§3), а не дампом: так новая база гарантированно та, что описана в
`DATA_MODEL.md`, а не снимок чужого состояния. `--disable-triggers` нужен, потому что данные ложатся не в
порядке внешних ключей. Последовательности чинить не надо: в схеме нет ни одного `autoincrement`.

---

## 6. Первый запуск без туннеля (владелец запускает, агент читает)

```bash
cd ~/wetop && docker compose -f deploy/compose.yml up -d --build api web exely-sync
docker compose -f deploy/compose.yml ps
```

Портов наружу нет — проверять изнутри сети compose:

```bash
docker compose -f deploy/compose.yml exec -T api node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.text()).then(console.log)"
docker compose -f deploy/compose.yml exec -T api node -e "fetch('http://127.0.0.1:3001/inventory/summary').then(r=>r.text()).then(t=>console.log(t.slice(0,400)))"
docker compose -f deploy/compose.yml exec -T web node -e "fetch('http://127.0.0.1:3000/login').then(r=>console.log('стойка:',r.status))"
bash scripts/ops/ari.sh status
```

Ждём: три контейнера `healthy`; `/health` → `{"status":"ok","database":"up",…}`; сводка фонда — 88 единиц;
стойка 200; `ari.sh status` → `машина: docker`, `API сейчас: CHANNEX_ARI=on`. Это же — доказательство
сборки образа и `ari.sh` под Docker.

Туннель (`cloudflared`) здесь **намеренно не поднимается** — это шаг 4 плана, отдельно и только после сверки
двух баз. Пока он не поднят, `api.wetop.ai` и `app.wetop.ai` по-прежнему смотрят туда, где туннель работает
сейчас, и ничего не ломается.

Вставить в чат вывод `ps`, `/health`, начало сводки фонда и `ari.sh status`. По ним агент запускает
сквозную сверку `cli-system-trace.ts` против новой базы.

---

## 7. Что может пойти не так, и что это значит

| Симптом | Причина | Что делать |
|---|---|---|
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

Туннель на новой машине, перевод `app.wetop.ai` и `api.wetop.ai`, `PII_STORAGE=real`, снятие служб с Mac,
переезд сторожа (его починка стойки класса А завязана на launchd) — следующие этапы ТЗ, каждый со своей
сверкой. Старая машина до конца сверки не выключается.
