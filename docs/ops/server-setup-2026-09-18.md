# Сервер на ps.kz: шаги 1–3 плана переезда, по командам

Дата: 18.09.2026. Продолжение `plans/server-kz-2026-09-17.md` после того, как владелец завёл аккаунт
ps.kz и назвал его провайдером (Q-070а). Выбор площадки — `docs/ops/server-kz-2026-09-16.md`.

Кто что делает: панель ps.kz, ключи и `.env` — только владелец (`SECURITY.md` §3); проверки и сверки —
агент по выводам, которые владелец вставляет в чат. Ни одна команда ниже не трогает Mac, Exely, Channex и
старую базу на запись.

Что уже доказано без сервера: миграции ложатся на чистый PostgreSQL 16 и откатываются снимок в снимок
(`reports/migrations-clean-postgres-2026-09-15.md`); образ и службы описаны (`deploy/`, шаг 0). Что
доказывается только здесь: сборка образа на настоящем сервере, `ari.sh` под Docker, сверка двух баз.

---

## 1. В панели ps.kz (владелец)

Нужны две вещи, обе в одном регионе (Алматы или Астана, но один и тот же для обеих):

1. **Управляемый PostgreSQL** (DBaaS), версия **16**. При создании или сразу после:
   - включить расширение **`btree_gist`**, если панель даёт такой переключатель. Миграция
     `20260909000003` делает `CREATE EXTENSION IF NOT EXISTS btree_gist` сама, но на управляемой базе у
     пользователя приложения может не быть на это прав — тогда `migrate deploy` упадёт ровно на этой строке;
   - записать предел одновременных подключений (обычно виден в карточке базы). От него зависит §4;
   - включить ежедневные бэкапы, если они не включены по умолчанию. Это и есть ответ на Q-073.
2. **Виртуальный сервер**: Ubuntu 24.04 LTS, 2 vCPU, 4 ГБ памяти, диск от 40 ГБ. Нагрузка объекта такой
   машине мала (36 коек, ~1300 операций в месяц), запас нужен под сборку образа, а не под работу.

Вставить в чат, **без пароля базы**: хост и порт базы, имя базы, имя пользователя, предел подключений,
публичный IP сервера. Пароль базы — только в `.env` на сервере.

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
руками, на случай если скрипт где-то споткнётся.

### 2.1 Docker из официального репозитория

Compose нужен не старше **2.24**: `deploy/compose.yml` использует необязательный `env_file`
(`required: false`) для выключателя ARI.

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker compose version          # ждём 2.24 или новее
```

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

### 2.4 `.env` и папка туннеля

`.env` копируется с Mac (`scp`) и правится на месте; значения вписывает владелец. Что меняется:

- `DATABASE_URL` — строка подключения к управляемой базе ps.kz;
- `DATABASE_SCHEMA` не задавать: рабочие данные живут в `public`;
- `PII_STORAGE` пока **не трогать** — включается на шаге 6 плана, когда база уже в РК и сверена;
- `DATABASE_POOL_MAX` — см. §4.

```bash
scp ~/.env pms@<IP-сервера>:~/wetop/.env              # с Mac; один файл в корне клона
chmod 600 ~/wetop/.env                                 # на сервере; compose читает его как ../.env
mkdir -p ~/wetop/deploy/cloudflared                    # ключ и конфиг туннеля — шаг 4 плана, не сейчас
cd ~/wetop && npx tsx scripts/imports/src/cli-check-env.ts   # секреты на месте, значений не печатает
```

---

## 3. Схема на пустой базе (владелец, агент читает вывод)

Боевую миграцию делает владелец (`AGENTS.md` §15). Сначала — что база та и пустая:

```bash
cd ~/wetop && npm ci
psql "$DATABASE_URL" -c "select version(), current_setting('TimeZone'), (select count(*) from pg_tables where schemaname='public') as tables"
```

Ждём: PostgreSQL 16, таблиц 0. Затем:

```bash
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
быть меньше него с запасом на `psql` и разовые скрипты. 15.09.2026 переполнение пулера давало 500 на
стойке. По умолчанию в `deploy/compose.yml`: API — 5, `exely-sync` — 1. Если предел базы 20 и больше,
ничего не менять. Если меньше — вписать в `.env` `DATABASE_POOL_MAX=3`.

---

## 5. Данные: старая база → новая (владелец)

Только после §3 и только владелец: в выгрузке настоящие ПД гостей. Старая база **не выключается** и не
меняется; это чтение.

```bash
# на сервере; SRC — строка подключения к Supabase (dev-БД), DST — к ps.kz
pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
  --exclude-table='_prisma_migrations' -Fc -f ~/luxx-data.dump
pg_restore --dbname="$DST" --data-only --no-owner --no-privileges --disable-triggers ~/luxx-data.dump
rm ~/luxx-data.dump
```

Схему переносим миграциями (§3), а не дампом: так новая база гарантированно та, что описана в
`DATA_MODEL.md`, а не снимок чужого состояния. `--disable-triggers` нужен, потому что данные ложатся не в
порядке внешних ключей; после восстановления ограничения проверяются заново:

```bash
psql "$DST" -c "select conname from pg_constraint where convalidated = false"    # ждём пусто
```

---

## 6. Первый запуск и что вставить в чат

```bash
cd ~/wetop && docker compose -f deploy/compose.yml up -d --build api web exely-sync
docker compose -f deploy/compose.yml ps
curl -s http://127.0.0.1:3001/health                  # изнутри сети compose порты не публикуются:
docker compose -f deploy/compose.yml exec api wget -qO- http://127.0.0.1:3001/health
docker compose -f deploy/compose.yml exec api wget -qO- http://127.0.0.1:3001/inventory/summary | head -c 400
bash scripts/ops/ari.sh status
```

Туннель (`cloudflared`) в этой команде **намеренно не поднимается** — это шаг 4 плана, отдельно и только
после сверки двух баз (шаг 3). Вставить в чат вывод `ps`, `/health`, начало `/inventory/summary` и
`ari.sh status`. По ним агент запускает сверку `cli-system-trace.ts` против новой базы.

---

## 7. Что может пойти не так, и что это значит

| Симптом | Причина | Что делать |
|---|---|---|
| `migrate deploy` падает на `CREATE EXTENSION` | у пользователя нет прав на расширения | включить `btree_gist` в панели ps.kz или попросить поддержку |
| `docker compose version` меньше 2.24 | старый Docker из репозитория Ubuntu | ставить из репозитория Docker (§2.1) |
| `up --build` падает на `npm ci` | манифест рабочего пакета не скопирован в образ | это ловит `tests/unit/deploy-server.test.ts`; сообщить агенту |
| `/health` 503 при живой базе | пул не достаёт базу: адрес, пароль, предел подключений | `docker compose logs api`, §4 |
| 500 на стойке, в журнале «connection timeout» | сумма пулов больше предела базы | §4 |
| `pg_restore` ругается на права | `--no-owner --no-privileges` пропущены | повторить с ними |
