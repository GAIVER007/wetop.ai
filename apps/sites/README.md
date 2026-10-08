# apps/sites: публичный рантайм управляемых сайтов (MKT4, MKT7)

Cloudflare Worker, который сам является origin публичного сайта (Q-269, решение владельца 06.10.2026). По имени хоста он
спрашивает у API текущую опубликованную версию сайта (`GET /sites-runtime/current`) и рисует HTML из SiteSpec v0
своими компонентами. Своего JavaScript на странице нет. Из скриптов только два, и оба WETOP: счётчик `/a/pms.js` и
виджет брони `/w/widget.js`, с ключом связанного `TrackedSite`. Бронь браузер посетителя делает сам, напрямую через
`/w/*`; Worker её не проксирует.

План и решения: `plans/mkt4-public-site-runtime-2026-10-06.md`. Контракт: `docs/marketing/README.md` §4.

## Состав

| Файл | Что |
|---|---|
| `src/index.ts` | точка входа Worker |
| `src/worker.ts` | маршруты: страница, `robots.txt`, `sitemap.xml`, файл стилей, отказы 404 и 503 |
| `src/contract.ts` | клиент `/sites-runtime/current`: кэш 60 с, документ по `siteId + specHash`, старая копия до 10 минут только при сбое API |
| `src/render/*` | реестр секций, оболочка, темы, значки, экранирование |
| `src/seo.ts` | meta, canonical, Open Graph, JSON-LD, robots, sitemap |
| `src/headers.ts` | CSP и прочие заголовки безопасности, политика кэша |
| `src/dev-server.ts` | локальный просмотр на Node тем же кодом, режим `--fixture` без API |

## Окружения и секреты

| Переменная | Где | Значение |
|---|---|---|
| `SITES_ENV` | `wrangler.toml` | `dev`, `staging` или `production`. Индексация только в `production` и только при основном хосте сайта (MKT7) |
| `SITES_API_URL` | `wrangler.toml` или `--var` | адрес API; у staging пусто, пустой адрес даёт 503 |
| `SITES_RUNTIME_KEY` | **только секрет** | `npx wrangler@4.148.0 secret put SITES_RUNTIME_KEY --env staging`; то же значение в `.env` API |
| `SITES_BASE_DOMAIN` | `--var` при выкладке | MKT7, Q-271: отдельный домен сайтов клиентов, не `wetop.ai`; хост превью `preview.<домен>`; не задан: превью 404 |

На стороне API: `SITES_RUNTIME_KEY`, а для dev и test ещё `SITES_RUNTIME_DEV_RESOLVER=1` и
`SITES_RUNTIME_DEV_HOSTS="host=siteId,…"`. В `production` эта карта не действует: с MKT7 боевые хосты разрешает строка
`site_domains` в `ACTIVE`. Для превью API нужны ещё `SITES_BASE_DOMAIN` (то же значение, что у Worker) и
`SITE_PREVIEW_SECRET` (не короче 32 байт). Контракт: `docs/marketing/site-publication-v0.md`.

## Локально

```
# без API: контракт из docs/marketing/sitespec-v0.example.json
npx tsx apps/sites/src/dev-server.ts --fixture        # http://stepnoy.localhost:8788/

# в workerd (как в Cloudflare), против своего API
cd apps/sites && npx wrangler@4.148.0 dev --env dev --var SITES_RUNTIME_KEY:<ключ из своего .env>
```

## Проверки

```
npm run test:record -- unit apps/sites
npm run test:record -- e2e --config tests/sites/playwright.config.ts
cd apps/sites && npx wrangler@4.148.0 deploy --env staging --dry-run --outdir /tmp/wetop-sites-dry
```

## Выкладка (за владельцем; ни MKT4, ни MKT7 ничего не выкладывали)

Боевых доменов, маршрутов и DNS не заводилось. Q-271 закрыт 07.10.2026: зону отдельного домена, wildcard DNS и маршрут
`*.<SITES_BASE_DOMAIN>/*` на этот Worker заводит владелец. Порядок, только по отдельному «да»:
1. База: миграции 064 и 065 на рабочей базе (копия перед ними), затем выкладка API (`docs/deploy.md`).
2. API (`.env` сервера): `SITES_RUNTIME_KEY`, `SITES_BASE_DOMAIN` (тот же домен, что у Worker), `SITE_PREVIEW_SECRET`
   (не короче 32 байт). Вывод `/sites-runtime/*` наружу (туннель, ingress) решает владелец (SECURITY.md, правило Q-112).
3. Staging: `wrangler secret put SITES_RUNTIME_KEY --env staging`, затем
   `wrangler deploy --env staging --var SITES_API_URL:<адрес API> --var SITES_BASE_DOMAIN:<домен>`. Только workers.dev, `noindex`.
4. Production: зона Cloudflare отдельного домена, wildcard DNS `*.<домен>`, затем
   `wrangler secret put SITES_RUNTIME_KEY --env production` и
   `wrangler deploy --env production --var SITES_API_URL:<адрес API> --var SITES_BASE_DOMAIN:<домен>` с маршрутом
   `*.<домен>/*`. Проверка: `https://preview.<домен>/robots.txt` отдаёт `Disallow: /`, опубликованный сайт открывается на
   `<slug>.<домен>`.
