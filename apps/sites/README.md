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
| `SITES_ENV` | `wrangler.toml` | `dev` или `staging`. Окружения `production` нет до MKT7, поэтому индексация закрыта везде |
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

## Выкладка (за владельцем, в MKT4 не делается)

Боевых доменов, маршрутов и DNS в MKT4 и MKT7 не заводилось. Q-271 закрыт 07.10.2026: зона отдельного домена, wildcard
DNS и маршрут `*.<SITES_BASE_DOMAIN>/*` на этот Worker заводит владелец. Порядок, только по отдельному «да»:
1. В API на сервере появляется `SITES_RUNTIME_KEY`. Путь `/sites-runtime/*` наружу пока не выводится (SECURITY.md,
   правило Q-112). Выход наружу решается вместе с MKT7.
2. Секрет Worker: `wrangler secret put SITES_RUNTIME_KEY --env staging`.
3. `wrangler deploy --env staging --var SITES_API_URL:<адрес API>`. Сайт откроется только на workers.dev и с `noindex`.
