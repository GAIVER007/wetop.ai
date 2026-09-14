# WETOP на wetop.ai — подключение домена (14.09.2026)

**Статус: предложен владельцу; область подтверждена 14.09.2026 («этот чат — подключение»). Код и службы не меняются
до «да» на этот план (AGENTS.md §1).**

Поручение владельца 14.09.2026: «посади проект на домен, он куплен на spaceship.com». Общий план домена —
`plans/wetop-domain-2026-09-14.md` (другой чат). Решение владельца 14.09: **подключение ведёт этот чат** — там §2
(адреса `app` и `api`), §3 (вход в стойку), §6 (туннель и службы), §8 шаги 1–3, 5–7, §9 первые два пункта. Главная
`wetop.ai`, блог, регистрация и правки экранов остаются в том плане.

---

## 1. Что есть (проверено 14.09.2026, `dig` и `launchctl`)

| Что | Состояние |
|---|---|
| NS `wetop.ai` в реестре `.ai` | `launch1/launch2.spaceship.net`, TTL 3600 |
| **DNSSEC** | **включён**: в реестре DS `3187 13 2 …`, TTL 3600; 1.1.1.1 отвечает с флагом `ad`. Смена NS без снятия DS — домен не резолвится у проверяющих резолверов |
| Записи у Spaceship | A `wetop.ai` → 34.216.117.25, 54.149.79.189 (заглушка); MX, TXT, AAAA, CAA, `www` — нет |
| Туннель сейчас | launchd `kz.luxx.pms.tunnel` → `channex-tunnel.sh` → `cloudflared tunnel --url http://localhost:3001` (весь порт API наружу, адрес меняется). Скрипт раз в ~2 мин сверяет адрес webhook в Channex со своим и перерегистрирует при расхождении |
| Cloudflare на Mac | `cloudflared` 2026.9.0; входа нет (`~/.cloudflared/` отсутствует) |
| Стойка → API | только на сервере: `APP_API_URL`, по умолчанию 127.0.0.1:3001; из браузера — только `/api/freshness` той же стойки. Стойке снаружи API не нужен |

## 2. Что получится

| Адрес | Куда | Кто видит |
|---|---|---|
| `app.wetop.ai` | Mac → именованный туннель → стойка 127.0.0.1:3000 | только после входа Cloudflare Access (код на почту из списка владельца); `cloudflared` дополнительно проверяет токен Access (`originRequest.access`) |
| `api.wetop.ai` | Mac → тот же туннель → API 127.0.0.1:3001 | только `GET /a/pms.js`, `POST /a/hit`, `GET /a/demo`, `GET /w/widget.js`, `GET /w/availability`, `POST /w/book`, `GET /w/demo`, `POST /channels/channex/webhook`; остальное — 404 от `cloudflared` |

Проверено 14.09 до подключения: `cloudflared tunnel ingress validate` — OK; `ingress rule` — публичные пути уходят в API,
`/reservations`, `/guard/status`, `/channels/channex/webhook/register`, `/a/../reservations`, корень `api` и чужой
поддомен — в 404, `app` — в стойку с проверкой Access.

## 3. Шаги владельца (пароли, карта и вход — только владелец)

1. **Spaceship** → Advanced DNS → `wetop.ai` → DNSSEC → выключить.
2. **Cloudflare**: аккаунт (Free) → Onboard a domain → `wetop.ai` → Free → прислать два NS.
3. **Spaceship** → Advanced DNS → `wetop.ai` → Custom nameservers → оба NS → Save — **только после «можно»**:
   агент проверяет, что DS исчез из реестра `.ai`, и ждёт его TTL (1 ч).
4. **Cloudflare Zero Trust**: имя команды (например, `wetop`), план Free (Cloudflare может попросить карту для плана
   $0). Прислать имя команды и почты, кого пускать в стойку.
5. **На этом Mac** по команде агента: `cloudflared tunnel login` → в браузере выбрать `wetop.ai` → Authorize.
6. **`.env`**: `PUBLIC_API_URL=https://api.wetop.ai` (`SECURITY.md` §3).
7. Mac — на зарядке (задача `awake` не даёт уснуть только от сети).

## 4. Шаги агента

1. `cloudflared tunnel create wetop`; `tunnel route dns` для `app.wetop.ai` и `api.wetop.ai`; `~/.cloudflared/config.yml`
   по §2; `ingress validate` и `ingress rule` на настоящем файле.
2. Приложение Access для `app.wetop.ai` (политика «почты из списка», вход одноразовым кодом) — в панели Zero Trust
   с владельцем или в Chrome владельца после его «да»; тег AUD — в `config.yml`.
3. `scripts/ops/launchd/install.sh`: задача `tunnel` запускает именованный туннель
   (`cloudflared tunnel --config ~/.cloudflared/config.yml run`), если есть `config.yml` и он проходит проверку;
   иначе — прежний быстрый туннель с явным сообщением. `occupied_by` и `status.sh` узнают оба вида.
   Переключение — одной операцией: снять быстрый туннель → поднять именованный → перерегистрировать webhook, чтобы
   старый скрипт не вернул адрес на `trycloudflare.com`.
4. Перезапуск API (`launchctl kickstart -k`) после шага владельца 6; «Зарегистрировать webhook» (Channex **staging**) →
   пробный вызов Channex → PMS 200.
5. Тексты сторожа, указывающие на `channex-tunnel.sh`, — на проверку туннеля через `status.sh`.

## 5. Риски

| Риск | Что делаем |
|---|---|
| DNSSEC | шаги 1 → 3 владельца с проверкой DS и паузой TTL |
| Защита Cloudflare от ботов режет POST Channex (запрос не из браузера) | пробный вызов после регистрации; при отказе — правило WAF «пропустить» только для `/channels/channex/webhook` |
| Next.js Server Actions за прокси (сверка Origin с Host) | действие формы через `app.wetop.ai` в проверке §6 |
| Mac спит или без сети — на адресах страница ошибки Cloudflare 530 | зарядка и `awake`; постоянно — сервер (условие 1 `CUTOVER.md`), адреса при переезде не меняются |
| Брони, пришедшие, пока webhook переключается | опрос ленты Channex раз в 5 минут (как при смерти туннеля) |

## 6. Доказательства

- Снаружи, с сервера Hostinger (`curl`): `app.wetop.ai` без входа → страница входа Access; `api.wetop.ai/a/pms.js` и
  `/w/widget.js` → 200; `/reservations`, `/guard/status` → 404; `POST /channels/channex/webhook` без секрета → 401.
- Вход почтой из списка → стойка открывается, действие формы проходит; чужая почта → отказ.
- Channex staging: `GET /channels/channex/webhook/status` → адрес `https://api.wetop.ai/channels/channex/webhook`;
  пробный вызов 200; бронь на staging приходит webhook'ом (`received_via`), отмена — тоже.
- Сторож: webhook не «под подозрением» после перезапуска туннеля (`launchctl kickstart -k …tunnel`).
- Отчёт `reports/wetop-connect-2026-09-14.md`; ADR (адреса, именованный туннель, Access); `SECURITY.md` §11;
  Q-112 — ответ; `scripts/ops/cloudflared-named.example.yml` под `wetop.ai`.

## 7. Что не входит

Главная `wetop.ai` и `www` (записи-заглушки Spaceship, импортированные Cloudflare, не трогаем до главной); блог и
регистрация; учётные записи и роли в PMS; «кто сделал» в журнале по почте Access (правка модели — вопрос владельцу);
сервер в Казахстане; счётчик и виджет на настоящем сайте (Q-111).
