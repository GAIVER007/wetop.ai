# Сервер в Казахстане: порядок команд

Дата: 18.09.2026. План — `plans/server-kz-2026-09-18.md`, выбор площадки — `docs/ops/server-kz-2026-09-16.md`.
Заменяет черновик «шаги 1–3, по командам» от 17.09: тот опирался на `deploy/`, которого тогда ещё не было,
и звал адреса, которых нет в API (разбор — `reports/server-kz-readiness-2026-09-18.md`).

**Кто что делает.** Все команды ниже выполняет владелец: агент до ps.kz не достаёт ни с одной стороны
(на машине владельца у оболочки агента нет сети, из облачной среды прокси не пускает даже на `ps.kz:443`).
Владелец вставляет вывод в чат, агент разбирает. Ключи и пароли — только в `.env` руками, в чат не диктуются
(`SECURITY.md` §3). Боевую миграцию делает владелец (`AGENTS.md` §15).

Ни одна команда здесь не трогает на запись Mac, Exely, Channex и старую базу.

---

## 1. В панели ps.kz

Две вещи, **обе в одном регионе** (Алматы или Астана — но один и тот же):

1. **Управляемый PostgreSQL 16** (DBaaS).
   - Включить расширение **`btree_gist`**, если панель это позволяет. Миграция
     `20260909000003_rates_and_overbooking_guard` делает `CREATE EXTENSION IF NOT EXISTS btree_gist`
     сама, но на управляемой базе у пользователя приложения может не быть прав — тогда `migrate deploy`
     упадёт ровно на этой строке. Это защита от овербукинга, обойти её нельзя.
   - Записать **предел одновременных подключений** (см. §4).
   - Включить ежедневные бэкапы (это и есть ответ на Q-073).
2. **Виртуальный сервер**: Ubuntu 24.04 LTS, 2 vCPU, 4 ГБ памяти, диск от 40 ГБ.
   Запас нужен под сборку образа, а не под нагрузку: 36 коек и ~1300 операций в месяц.

Вставить в чат, **без пароля базы**: хост и порт базы, имя базы, имя пользователя, предел подключений,
публичный IP сервера, регион.

---

## 2. Подготовка сервера (один раз)

Зайти по SSH под пользователем, которого выдал ps.kz.

### 2.1 Docker и клиент PostgreSQL

Compose нужен не старше **2.24**: `deploy/compose.yml` использует `env_file` с `required: false`.
Клиент PostgreSQL нужен не ниже версии сервера, иначе `pg_dump` откажется работать.

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

### 2.2 Отдельный пользователь

```bash
sudo adduser --disabled-password --gecos '' pms
sudo usermod -aG docker pms
sudo su - pms
```

### 2.3 Репозиторий: ключ только на чтение

Репозиторий приватный (`SECURITY.md` §4). Серверу нужен **deploy key** без права записи, а не личный ключ.

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/wetop-deploy -C 'wetop server'
cat ~/.ssh/wetop-deploy.pub
```

Публичный ключ — в GitHub: репозиторий → Settings → Deploy keys → Add, **без** «Allow write access». Затем:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/wetop-deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
git clone git@github.com:GAIVER007/wetop.ai.git ~/wetop && cd ~/wetop
git checkout claude/trusting-ramanujan-gi6uzl     # или main, когда ветка влита
```

### 2.4 `.env` — в корне репозитория

**Одно место.** Оттуда его читают и compose, и `cli-check-env.ts`, и `prisma migrate deploy`, и все
скрипты сверки. Ни в `deploy/`, ни где-либо ещё.

```bash
scp ~/.env pms@<IP-сервера>:~/wetop/.env        # выполняется НА MAC
chmod 600 ~/wetop/.env                           # на сервере
```

Что в нём правится на месте (значения вписывает владелец):

- `DATABASE_URL` — строка подключения к базе ps.kz;
- `DATABASE_SCHEMA` — **не задавать**: рабочие данные живут в `public`;
- `PII_STORAGE` — пока **не трогать**: включается после сверки двух баз (см. §5);
- `DATABASE_POOL_MAX` — см. §4;
- `API_HOST` — **не задавать**: его задаёт compose внутри контейнера.

Проверка без печати значений:

```bash
cd ~/wetop && npm ci --ignore-scripts && npx tsx scripts/imports/src/cli-check-env.ts
```

---

## 3. Схема на пустой базе

Сначала убедиться, что база та и пустая. `DATABASE_URL` живёт в `.env` и сам в оболочку не попадает —
его надо поднять явно:

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

Ждём: применены все 15 миграций, `btree_gist` в списке. Вставить оба вывода в чат.

Откат схемы (`down.sql` у каждой миграции) здесь заново не гоняется: доказан на чистом
PostgreSQL 16 15.09.2026 (`reports/migrations-clean-postgres-2026-09-15.md`), а `check-migrations.sh`
на чужой сервер не пойдёт по построению — он создаёт и удаляет базы.

---

## 4. Пул соединений — посчитать до запуска

Сумма пулов всех служб обязана быть **меньше** предела базы, с запасом на `psql` и разовые скрипты.
15.09.2026 переполнение пулера давало 500 на стойке и «connection timeout» в журнале API.

По умолчанию: API — 5, `exely-sync` — 1. Итого 6.

- предел базы 20 и больше — ничего не менять;
- предел меньше — вписать в `.env` `DATABASE_POOL_MAX=3`;
- разовые скрипты запускать с `DATABASE_POOL_MAX=1` (`TESTING.md`).

---

## 5. Данные: чем наполнять новую базу

**Развилка, которую решает владелец, а не команда.** База в Supabase анонимизирована (ADR-018):
`PII_STORAGE` там пуст, гости каналов записаны псевдонимами. Значит копия даст новой базе те же
псевдонимы, и полный импорт из Exely с `PII_STORAGE=real` всё равно понадобится.

- **Вариант А — копия, потом импорт.** Быстро получить рабочую базу для сверки, ПД подтянуть позже.
- **Вариант Б — только импорт.** Пустая база, наполненная из Exely сразу с настоящими ПД.

Вариант А, если выбран (выполняет владелец: в выгрузке данные гостей, пусть и псевдонимы):

```bash
# SRC — строка подключения к Supabase, DST — к ps.kz
pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
  --exclude-table='_prisma_migrations' -Fc -f ~/luxx-data.dump
pg_restore --dbname="$DST" --data-only --no-owner --no-privileges --disable-triggers ~/luxx-data.dump
rm ~/luxx-data.dump
psql "$DST" -c "select conname from pg_constraint where convalidated = false"    # ждём пусто
```

Схема ставится миграциями (§3), а не дампом: так новая база гарантированно та, что описана в
`DATA_MODEL.md`, а не снимок чужого состояния. `--disable-triggers` нужен, потому что данные ложатся
не в порядке внешних ключей. Последовательности чинить не надо: в схеме нет ни одного `autoincrement`.

---

## 6. Первый запуск

```bash
cd ~/wetop && docker compose -f deploy/compose.yml up -d --build api web exely-sync
docker compose -f deploy/compose.yml ps
```

Портов наружу нет — проверять изнутри сети compose:

```bash
docker compose -f deploy/compose.yml exec -T api node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.text()).then(console.log)"
docker compose -f deploy/compose.yml exec -T api node -e "fetch('http://127.0.0.1:3001/inventory/summary').then(r=>r.text()).then(t=>console.log(t.slice(0,400)))"
docker compose -f deploy/compose.yml exec -T web node -e "fetch('http://127.0.0.1:3000/login').then(r=>console.log('стойка:',r.status))"
bash scripts/ops/ari-server.sh status
```

Ждём: `/health` → `{"status":"ok","database":"up",…}`; сводка фонда — 88 единиц; стойка 200;
`ari-server.sh status` → `CHANNEX_ARI=on`.

Туннель (`cloudflared`) здесь **намеренно не поднимается** — это следующий шаг, и только после сверки
двух баз. Пока он не поднят, `api.wetop.ai` и `app.wetop.ai` по-прежнему смотрят на Mac, и ничего
не ломается.

Вставить в чат вывод `ps`, `/health`, начало сводки фонда и `ari-server.sh status`. По ним агент
запускает сквозную сверку `cli-system-trace.ts` против новой базы.

---

## 7. Что может пойти не так

| Симптом | Причина | Что делать |
|---|---|---|
| `migrate deploy` падает на `CREATE EXTENSION` | у пользователя нет прав на расширения | включить `btree_gist` в панели ps.kz или через поддержку |
| `docker compose version` меньше 2.24 | Docker из репозитория Ubuntu | ставить из репозитория Docker (§2.1) |
| `up --build` падает на `npm ci` внутри образа | не скопирован манифест рабочего пакета | это ловит `tests/unit/deploy-server.test.ts` — прислать вывод агенту |
| `up --build` падает на `npm run build -w apps/web` по памяти | 4 ГБ и сборка Next | `NODE_OPTIONS=--max-old-space-size=3072`, либо временно добавить swap |
| `cli-check-env.ts` пишет «НЕ ЗАДАН» по всем ключам | `.env` не в корне репозитория | §2.4: файл только в `~/wetop/.env` |
| `/health` отвечает `degraded`, `database: down` | пул не достаёт базу: адрес, пароль, предел подключений | `docker compose -f deploy/compose.yml logs --tail=50 api`, §4 |
| 500 на стойке, в журнале «connection timeout» | сумма пулов больше предела базы | §4 |
| `pg_restore` ругается на права | пропущены `--no-owner --no-privileges` | повторить с ними |
| `ari-server.sh stop` пишет «ARI НЕ остановлен» | служба пересоздана, но переменную не увидела | проверить `env_file` в `deploy/compose.yml` и что файл `deploy/ari.env` записан |

---

## 8. Чего этот лист не делает

Туннель на новой машине, перевод `app.wetop.ai` и `api.wetop.ai`, перерегистрация webhook,
`PII_STORAGE=real`, переезд сторожа (его починки класса А завязаны на launchd) — следующими шагами,
каждый со своим планом и сверкой. Старая машина до конца сверки не выключается.
