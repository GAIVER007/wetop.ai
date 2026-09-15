# Посадка проекта на домен wetop.ai — что нажимать и в каком порядке

15.09.2026. Основание — ADR-045 и `plans/wetop-domain-2026-09-14.md` §6 и §8 (план принят владельцем 14.09).
Здесь то же самое, но по шагам и с точными командами: чего ждать от Spaceship, что делает Cloudflare,
что запускается на Mac.

## 0. Вкладка Spaceship

Открыть её вместо тебя я не могу: сессия идёт в контейнере, у меня нет ни твоего браузера, ни входа в
твой аккаунт Spaceship. Ссылка вида `cart/order/<id>/summary` — страница заказа, к настройке домена она
отношения не имеет.

От Spaceship проекту нужна ровно одна вещь — **серверы имён (nameservers)**. Ни DNS-хостинг, ни почту,
ни «веб-хостинг», ни переадресацию домена там покупать не надо: всё это дальше делает Cloudflare на
бесплатном плане. Если в корзине лежит что-то, кроме продления самого домена, — это мимо задачи.

## 1. Куда что садится

| Адрес | Что отвечает | Где физически | Кого пускает |
|---|---|---|---|
| `wetop.ai`, `www.wetop.ai` | главная платформы и блог (`apps/site`) | Cloudflare Pages — статика, от Mac не зависит | всех |
| `app.wetop.ai` | стойка WETOP (`apps/web`, порт 3000) | Mac → именованный туннель | только вход по почте (Cloudflare Access) |
| `api.wetop.ai` | счётчик `/a/*`, виджет брони `/w/*`, webhook Channex | Mac → тот же туннель, порт 3001 | публично, но только эти пути; остальное — 404 |

Корень домена отделён от Mac намеренно: главная остаётся живой, когда Mac спит или перезагружается
(в ночь на 14.09 он уснул на батарее и утянул с собой всё сразу).

## 2. Что в коде уже готово (проверено 15.09.2026)

- главная собирается статикой: `npm run site:build` → `apps/site/out`, 7 страниц, 1,4 МБ, сборка без ошибок;
- данные владельца для главной — один файл `apps/site/src/site.config.ts` (пока пуст: название, город,
  контакты и ссылка «Попробовать бесплатно» ждут ответа на Q-129; пустое поле просто скрывает блок);
- образец конфига туннеля — `scripts/ops/cloudflared-wetop.example.yml`, служба launchd `domain`
  (`scripts/ops/launchd/install.sh domain`), быстрый туннель с ней одновременно не ставится;
- API готов к постоянному адресу: наружу только шесть путей, IP посетителя берётся из `CF-Connecting-IP`
  от loopback, регистрация webhook на чужой адрес отбивается 409;
- `/login` в стойке показывает почту из заголовка Access и кнопку «Выйти».

## 3. Шаги

### Шаг 1. Cloudflare: завести домен (5 минут)

Аккаунт на cloudflare.com (бесплатный) → **Add a domain** → `wetop.ai` → план **Free**. Cloudflare
покажет два адреса серверов имён вида `xxx.ns.cloudflare.com`. Записать их.

### Шаг 2. Spaceship: подменить серверы имён

Личный кабинет → **Domains** → `wetop.ai` → раздел **Nameservers** → переключить со «Spaceship
nameservers» на **Custom / Use custom nameservers** → вписать оба адреса из шага 1 → сохранить.

Дальше ждать письма Cloudflare «is now active». Обычно от нескольких минут до пары часов, по правилам
реестра — до суток. До активации остальные шаги делать бесполезно: Cloudflare не выдаст сертификаты.

### Шаг 3. Главная на Cloudflare Pages

Собрать и выложить **с Mac**, не подключая GitHub к Cloudflare:

```
npm run site:build      # apps/site/out
npx wrangler@latest login
npx wrangler@latest pages project create wetop-site --production-branch main
npm run site:deploy     # пересобирает и заливает apps/site/out
```

Почему не Git-интеграция Pages: репозиторий приватный, и в его истории финансы объекта и рабочие
контакты (`SECURITY.md` §4) — отдавать его целиком стороннему сборщику не за чем. Плюс Pages пришлось бы
ставить весь монорепозиторий (Prisma, Nest, Playwright) ради страницы на 1,4 МБ. При прямой выкладке
наружу уходит только собранная папка.

Затем в проекте Pages → **Custom domains** → добавить `wetop.ai` и `www.wetop.ai`. DNS-записи Cloudflare
поставит сам, потому что домен уже в этом же аккаунте.

Первая выкладка — только после того, как ты посмотришь страницу локально: `npm run dev -w apps/site`
(127.0.0.1:3002). Это публикация во внешний сервис, сам я её не делаю.

### Шаг 4. Туннель: `app.wetop.ai` и `api.wetop.ai`

На Mac, по шагам из шапки `scripts/ops/cloudflared-wetop.example.yml`:

```
cloudflared tunnel login                      # браузер: выбрать wetop.ai
cloudflared tunnel create wetop               # напечатает TUNNEL-ID и путь к ключу
cloudflared tunnel route dns wetop app.wetop.ai
cloudflared tunnel route dns wetop api.wetop.ai
cp scripts/ops/cloudflared-wetop.example.yml ~/.cloudflared/wetop.yml   # подставить TUNNEL-ID, ключ, имя команды, AUD-тег
scripts/ops/launchd/uninstall.sh tunnel && scripts/ops/launchd/install.sh domain
```

### Шаг 5. Вход в стойку (Cloudflare Access)

Zero Trust → имя команды (например, `wetop`), план Free → **Access → Applications → Self-hosted** →
домен `app.wetop.ai` → политика **Allow** по списку почт. Из карточки приложения взять **AUD-тег**, имя
команды — из Zero Trust → Settings; оба значения вписать в `~/.cloudflared/wetop.yml`. Пароли и учётные
записи в PMS для этого не нужны — вход по одноразовому коду на почту.

При выборе бесплатного плана Zero Trust Cloudflare может попросить привязать карту; сам план $0.

### Шаг 6. Постоянный адрес API

1. `.env`: `PUBLIC_API_URL=https://api.wetop.ai` (вписывает владелец — `SECURITY.md` §3);
2. перезапуск API: `launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.api`;
3. `/channels` → «Зарегистрировать webhook». После этого API отвечает 409 на любую попытку
   зарегистрировать webhook на другой адрес — быстрый туннель больше не перебьёт настройку;
4. `/analytics/setup` → взять новый код счётчика и виджета; в `docs/site/snippet-luxx-aparts.html`
   сейчас стоит мёртвый адрес быстрого туннеля (`profit-offered-rotary-titanium.trycloudflare.com`) —
   заменить на `https://api.wetop.ai`.

## 4. Когда считаем, что домен посажен

- `https://wetop.ai` и `https://www.wetop.ai` открывают главную; блог и `sitemap.xml` на месте;
- `https://app.wetop.ai` без входа → страница Cloudflare Access; почта из списка → стойка; чужая → отказ;
- `https://api.wetop.ai/a/pms.js` и `/w/widget.js` → 200; `/w/demo` и `/reservations` → 404;
  webhook без секрета → 401;
- в Channex зарегистрирован `https://api.wetop.ai/channels/channex/webhook`, живая бронь на staging
  доходит до PMS, T6 — 0 расхождений;
- `scripts/ops/launchd/status.sh` показывает службу `domain`, а не `tunnel`.

## 5. Что этим шагом не решается

- сервер в Казахстане (условие 1 `CUTOVER.md`, Q-070): адреса `app` и `api` при переезде не меняются,
  меняется только машина, на которой крутится туннель. До сервера в РК на домене живут те же
  анонимизированные данные, что и сейчас;
- собственные учётные записи и роли в PMS (ADR-023) и регистрация с пробным периодом (Q-129);
- тексты «о компании» и канал заявок — пока их нет, эти блоки на главной скрыты.
