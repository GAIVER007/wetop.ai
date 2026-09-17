# Выкладка: что и как обновляется

Один файл на все три части системы. Порядок проверен 17.09.2026; сборки и наборы тестов
перед выкладкой прогоняются в облачной сессии, сама выкладка идёт **только с машины стойки**
(Mac владельца): там `.env`, ключи Cloudflare и службы launchd.

---

## 1. Стойка `app.wetop.ai` и API `api.wetop.ai`

Живут на Mac под launchd (`scripts/ops/launchd/`), код берут из рабочей копии репозитория.

```bash
cd ~/путь/к/wetop.ai
git fetch origin && git checkout main && git pull        # или нужная ветка
npm install                                              # заодно перегенерирует клиент базы
npm run generate -w @pms/database                        # если ставили не через npm install

# API: перечитать код
launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.api

# Стойка: сначала сборка, потом перезапуск — next start держит манифест в памяти
npm run build -w apps/web
launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.web
```

Проверить, что встало:

```bash
bash scripts/ops/launchd/status.sh                       # все шесть служб
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/inventory/summary   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/today               # 200
npm run ui:walkthrough                                   # обход экранов и кнопок, сверка чисел с API
```

**Служб должно быть шесть, не две.** `api` и `web` держат сервер и стойку, но снаружи объект живёт
только с остальными: `domain` — именованный туннель Cloudflare (`app.wetop.ai`, `api.wetop.ai`, webhook
Channex), `exely-sync` — синхронизация с Exely раз в 15 минут (ADR-032), `awake` — Mac не засыпает.
Если `status.sh` пишет «не загружен», поднять:

```bash
bash scripts/ops/launchd/install.sh domain
bash scripts/ops/launchd/install.sh exely-sync
bash scripts/ops/launchd/install.sh awake
```

Без `domain` брони из каналов доходят только опросом ленты, а не webhook'ом; без `exely-sync` данные
в PMS устаревают. В день двойного ввода `exely-sync` снимают намеренно (`CUTOVER.md`, условие 2).

**Клиент базы обязан знать схему.** Он генерируется из `schema.prisma`, а не из самой базы: пока
`prisma generate` не выполнен, сервер обращается к полям, которых клиент не знает, и отвечает 500 —
17.09.2026 так падал журнал действий («Unknown field `user` for include statement on model `AuditLog`»),
хотя все миграции были применены. Теперь генерация идёт сама при `npm install` (`postinstall`), а
после ручной правки схемы — `npm run generate -w @pms/database` и перезапуск API.

**Миграции базы применяет владелец вручную** (`DATA_MODEL.md`, `CUTOVER.md`): агент production migration
не делает. Сначала миграция, потом перезапуск API.

---

## 2. Главная `wetop.ai`

Статическая сборка `apps/site`, выкладывается прямой загрузкой в Cloudflare Pages: приватный репозиторий
к Cloudflare не подключается (`SECURITY.md` §4).

```bash
npm run site:build     # собрать в apps/site/out
npm run site:check     # 6 проверок: страницы, доступность, телефон, карточка ссылки, sitemap
npm run site:deploy    # сборка + wrangler pages deploy на проект wetop-site
```

`site:deploy` спросит вход в Cloudflare при первом запуске. Ключей нет ни в репозитории, ни в облачной сессии.

---

## 3. Что прогнать перед выкладкой

С любой машины, включая облачную сессию (`TESTING.md`):

```bash
npm run test:status                        # что уже доказано на этом коде
npm run test:record -- typecheck
npm run test:record -- lint
npm run test:record -- unit
npm run test:record -- e2e --config tests/ui/playwright.config.ts   # стойка на синтетическом API
```

С базой (машина стойки или локальный PostgreSQL 16 с сидом):

```bash
npm run test:record -- integration
npm run build -w apps/web && npm run test:record -- e2e
```

---

## 4. Откат

- Стойка и API: `git checkout <прошлый коммит>`, затем сборка и `kickstart` по §1.
- База: `down.sql` рядом с миграцией (`scripts/ops/check-migrations.sh` проверяет их на чистом PostgreSQL).
- Каналы: `scripts/ops/ari.sh stop` останавливает отправку остатков в Channex, порядок — `CUTOVER.md` ROLLBACK.
- Главная: `npx wrangler@latest pages deployment list --project-name wetop-site` и откат на прошлую выкладку
  в панели Cloudflare.
