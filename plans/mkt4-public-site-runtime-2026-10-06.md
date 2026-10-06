# MKT4: публичный рантайм сайта (план и итог)

Статус: **06.10.2026, DONE in branch / awaits owner review** (облачная сессия, ветка `claude/sharp-dirac-6s46fw` от `main` `6a6a46bd`, после
слияния MKT3 PR #258). Основание: поручение владельца MKT4, ADR-149, `docs/marketing/README.md` §4,
`docs/marketing/sitespec-v0.md`. **Q-269 RESOLVED владельцем 06.10.2026:** рантайм это Cloudflare Worker, отдельное
приложение `apps/sites`, Worker сам является origin сайта; не на сервере Hostinger, не в `apps/web` и `apps/api`, не
через Cloudflare Tunnel. Q-271 (домены) открыт, MKT4 от него не зависит.

## 1. Что входит

| # | Что | Где |
|---|---|---|
| 1 | Служебный путь `GET /sites-runtime/current?host=&knownSpecHash=` | `apps/api/src/sites-runtime/` |
| 2 | Узкий ключ `SITES_RUNTIME_KEY`: только этот путь и только GET, сравнение за постоянное время | `apps/api/src/auth/auth.guard.ts` |
| 3 | Разрешение хоста только для dev и test, боевое выключено до MKT7 | `apps/api/src/sites-runtime/host-resolver.ts` |
| 4 | `publicFacts` по белому списку | там же |
| 5 | Worker: рендер HTML по SiteSpec v0, явный реестр 11 секций Hospitality, оболочка, темы | `apps/sites/src/` |
| 6 | SEO: `lang`, `title`, `description`, canonical, Open Graph, `viewport`, JSON-LD, `robots.txt`, `sitemap.xml` | `apps/sites/src/seo.ts` |
| 7 | Заголовки безопасности и кэш | `apps/sites/src/headers.ts`, `apps/sites/src/contract.ts` |
| 8 | Конфигурация Worker: окружения `dev` и `staging`, секрет и адрес API, без боевых доменов | `apps/sites/wrangler.toml` |

## 2. Чего нет (поручение)

Публикации, `SiteDomain`, своих доменов, превью, генерации, загрузки ассетов, редактора, отката, боевых доменов. Нет
выкладки Worker, DNS, слияния, перемотки `release`, миграций. **Модель данных и миграции не меняются.**

## 3. Модель доверия

- У Worker нет сессии, куки `wetop_scope`, `X-Wetop-Scope`, организации из браузера. Полномочие одно: `hostname`.
- Worker ходит в API только на `/sites-runtime/current` своим ключом. Управление (`/marketing/site*`) ключ рантайма не
  открывает: замок пускает ключ только на этот путь и только GET, остальное 403. Чтения версии по `id` у ключа нет
  (маршрута `version/:id` в API нет, проверка по реестру маршрутов в тесте).
- Общий служебный ключ `SERVICE_API_KEY` на путь рантайма не пускается: контроллер требует именно `SITES_RUNTIME_KEY`.

## 4. Разрешение хоста до MKT7

Таблицы `SiteDomain` нет и временная не заводится. Резолвер:
- **боевой путь выключен**: без dev-режима любой хост даёт «нет такого сайта», то есть 404;
- **dev и test**: включается только при `SITES_RUNTIME_DEV_RESOLVER=1` **и** `NODE_ENV` не `production`; карта
  `SITES_RUNTIME_DEV_HOSTS="host=siteId,host2=siteId2"`; хост нормализуется (нижний регистр, без порта, без точки в
  конце), неверная запись карты пропускается;
- хранилища боевых имён хостов нет; `primaryHost` в ответе `null` до MKT7.

## 5. Главный инвариант

Рантайм читает **только** `published_version_id` и **только** при `state = 'PUBLISHED'`, одним запросом вместе с
сайтом и цепочкой (филиал `ACTIVE` → Business `ACTIVE` `HOSPITALITY` → объект этого филиала той же организации).
`latest_version_id`, история, черновики и чтение по `id` недоступны. `DRAFT`, `PAUSED`, `ARCHIVED`, нет опубликованной
версии, архивная цепочка, неизвестный хост: 404 без имени сайта. Отката к `latest` нет.

Документ перед выдачей проверяет `validateSiteSpec`; неверный или незнакомая `schemaVersion` дают 503 и запись в лог.
Worker вторым рубежом держит свой реестр секций и вариантов: незнакомое тоже 503 и лог.

## 6. Ответ API

`siteId`, `state`, `primaryHost` (`null`), `defaultLocale`, `versionId`, `schemaVersion`, `specHash`, `spec`
(отсутствует, если `knownSpecHash` совпал), `publicKey` (ключ связанного `TrackedSite` в `ACTIVE` или `null`),
`bookingEnabled` (бронь включена и тариф задан), `publicApiUrl` (`PUBLIC_API_URL`), `assets` (`{}`: `SiteAsset` нет),
`publicFacts`. Заголовок `Cache-Control: no-store`: кэширует Worker.

`publicFacts = { loadedAt, checkInTime, checkOutTime, categories: [{ code, active, capacityAdults }] }`: объект из
`MarketingSite.location_id`, только коды из секций `accommodations` и `pricing` опубликованной версии, неизвестный код
`{ code, active: false }`. Без id базы, заметок, цен, тарифов, гостей и ПД.

## 7. Цена «от» (Q-276 RESOLVED OWNER 07.10.2026)

06.10 правила не было, и цена стояла на STOP. 07.10 владелец решил Q-276. **B-FROMPRICE is a tariff hint, not
availability guarantee.**

| Пункт | Правило |
|---|---|
| Тариф | только `tracked_sites.booking_rate_plan_id` сайта: по нему же считает `/w/availability` и создаётся бронь; другого тарифа нет даже как запасного |
| Окно | сегодня по дате объекта и ещё 29 ночей, всего 30 (`fromPriceWindow`) |
| Цена | минимум цены одной ночи при `capacity_adults` категории (`priceStay` на одну ночь) |
| Производный тариф брони | цены родителя со своей скидкой (`nightRates`, как у брони); окно продаж применяется к ночи как к дате заезда (`assertDerivedRuleAllows` без минимума ночей) |
| Ограничения | ночь со `stop_sell` не участвует; закрытие на заезд или выезд и пределы проживания не применяются, их проверяет `/w/availability` по датам |
| Места | не проверяются |
| Нет цены | бронь сайта выключена, тарифа нет, тариф неактивен, категория не связана, нет цены или все ночи под стоп-продажей: цены нет, категории в ответе нет |

Контракт: `GET /w/from-prices?k=<ключ сайта>`, тот же `bookingSite` (ключ, домен сайта, действующая цепочка объекта),
CORS виджета, лимит 30 запросов с адреса в минуту, `Cache-Control: public, max-age=60`. Ответ
`{ currency, window: { from, to }, categories: [{ code, fromMinor }] }`, без идентификаторов базы, тарифа и объекта.

Рендер: в HTML только скрытые места `data-from-price`; секция `pricing` и её строки скрыты. Внешний скрипт WETOP
`/_wetop/prices-<хэш>.js` с того же хоста (`script-src 'self'`, без `unsafe-inline`) спрашивает цену и показывает её
подписью «от N ₸ / ночь». Секцию цен он открывает, когда видна хотя бы одна строка. Ошибка или нет ответа: число не
показывается, старое не берётся.

## 8. Рендер

`SiteSpec + publicFacts + контекст рантайма → HTML`, чистая функция. Явный реестр `SECTION_RENDERERS` по типу и
варианту; ни `eval`, ни импорта по строке. Тест сверяет реестр рантайма с реестром валидатора (`SITE_SPEC_SECTIONS`
из `@pms/domain`). Весь текст экранируется; адреса только из `site.contacts` или проверенные `https:`.

| Данные | Поведение в MKT4 |
|---|---|
| Картинки (`assetId`) | `SiteAsset` нет, карта ассетов пуста: картинка не выводится. `hero IMAGE_*` выглядит как текстовый, `gallery` скрыта целиком, логотип заменяет имя сайта |
| `B-CATEGORY` | неактивная или незнакомая категория скрывает карточку; `publicFacts` нет: живые поля прячутся, текст снимка остаётся |
| `B-CHECKINOUT` | строка заезда и выезда только из `publicFacts`, иначе скрыта |
| `B-BOOK` | точка монтирования `#pms-booking` и `/w/widget.js` с `data-site`, только при `WETOP_WIDGET`, `bookingEnabled` и ключе; иначе строка «онлайн-бронирование сейчас недоступно» и телефон, если есть |
| Счётчик | `/a/pms.js` с `data-site`, только при `WETOP_TRACKER` и ключе; `WAIT_FOR_CONSENT` даёт `data-consent="wait"` |
| Ссылки меню на скрытую секцию | пункт не выводится |

Клиентского фреймворка нет: аккордеон на `<details>`, карусель на прокрутке CSS. Собственных скриптов нет.

## 9. SEO и индексация

- `lang` = `defaultLocale` (рантайм v0 публикует только его); `title` из `page.seo.title` или `titleTemplate`;
  `description`; Open Graph; `viewport`; H1 один на странице.
- canonical только на основной хост, а он `null` до MKT7: тега нет. Dev и staging боевой canonical не выдумывают.
- Индексация разрешена только в окружении `production` **и** при основном хосте; в MKT4 окружения `production` нет,
  поэтому везде `noindex` (`<meta name="robots">`, `X-Robots-Tag`) и `robots.txt` `Disallow: /`.
- `sitemap.xml`: индексируемые страницы с `includeInSitemap`, адреса от основного хоста. В dev и staging индексации нет,
  поэтому карта пустая; боевой адрес не выдумывается.
- JSON-LD `application/ld+json`: тип из `structuredData.type`, имя, описание, адрес и телефон при `includeAddress`, гео
  при `includeGeo`, удобства, время заезда и выезда из `publicFacts`; `FAQPage` при `emitStructuredData`. Знак `<`
  экранируется как `<`.

## 10. Заголовки и кэш

CSP: `default-src 'none'`; `script-src` только `'self'` (файл цен, если на странице есть цена), адрес API (виджет, счётчик) и `https://challenges.cloudflare.com` при
включённой брони, без `unsafe-inline` и `unsafe-eval`; `style-src 'self' 'unsafe-inline'` (виджет вставляет свой
`<style>`); `connect-src` API и Turnstile; `frame-src` Turnstile; `img-src 'self' data:`; `base-uri 'none'`;
`form-action 'self'`; `frame-ancestors 'none'`; `object-src 'none'`. Плюс `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, минимальный `Permissions-Policy`.

| Что | Политика |
|---|---|
| Ответ контракта | память изолята, 60 с по хосту |
| Документ | память изолята по `siteId + specHash`, Worker шлёт `knownSpecHash` |
| HTML, `robots.txt`, `sitemap.xml` | `Cache-Control: public, max-age=60` |
| CSS рантайма | путь с хэшем содержимого, `public, max-age=31536000, immutable` |
| API недоступен (сеть, 5xx кроме `spec_invalid`) | последняя подтверждённая копия контракта не старше 10 минут, лог `stale_served`; старше или нет копии: 503 |
| 404 от API | копия хоста сразу забывается, отдаётся 404 (снятый сайт не держится в кэше) |

## 11. Тесты (red → green)

- unit API: ключ (нет, чужой, общий служебный, ключ рантайма на другой путь и метод), резолвер, ответ;
- integration на изолированной базе, опубликованный указатель засевается прямо в базе: только `published_version_id`,
  черновик `latest` не утекает, `PAUSED`/`ARCHIVED`/`DRAFT`, архивная цепочка, неизвестный хост, `knownSpecHash`,
  белый список `publicFacts`, неверный документ 503;
- unit Worker: каждая секция, экранирование, SEO, canonical, JSON-LD, robots, sitemap, кэш, заголовки, неизвестная
  секция, контраст тем;
- снимки 390 и 1440 и axe (тёмной темы в v0 нет: `colorScheme` только `LIGHT`), Lighthouse, если среда позволит;
- реестр маршрутов: у ключа рантайма нет `version/:id`.

## 12. Документы

Q-269 RESOLVED, Q-276 RESOLVED OWNER 07.10.2026; `DATA_MODEL.md` §29 (рантайм читает только указатель, таблиц не прибавилось);
`docs/marketing/README.md` §4; дорожная карта; `apps/sites/README.md` (выкладка); `SECURITY.md` (новый секрет).

## 13. Итог (06.10.2026)

**Сделано.** API `GET /sites-runtime/current` (`apps/api/src/sites-runtime/`), ключ `SITES_RUNTIME_KEY` в замке входа
(только этот путь и только GET), резолвер dev и test, `publicFacts` по белому списку, проверка документа валидатором и
хэшем (503 `spec_invalid` и лог). Worker `apps/sites`: реестр 11 секций по всем вариантам, оболочка, четыре светлые темы
с проверкой контраста AA, SEO, JSON-LD, `robots.txt`, `sitemap.xml`, CSP и заголовки, кэш контракта и документа, старая
копия до 10 минут только при сбое API. Домен: `normalizeSiteHost`, `parseDevSiteHosts`, `siteSpecCategoryCodes`,
`SITE_SPEC_SECTIONS`. Модель данных и миграции не менялись.

**Red → green.**
- домен: помощников нет, 20 из 20 красных, затем 57 из 57;
- API: модуля нет, затем 17 из 17. Мутация «ключ рантайма пускается всюду» дала 1 красный;
- таблица прав без строки маршрута: 1 из 3, затем 3 из 3. Там же проверка «у рантайма один путь, чтения версии по id
  нет»;
- integration: мутация «читать `latest_version_id`, не смотреть на состояние» дала 6 из 13, код дал 13 из 13;
- Worker: 133 теста. Записанный прогон с пятью мутациями (экранирование, CSP, реестр, canonical, кэш 404) дал 10
  красных;
- UI `tests/sites` 9 из 9: 390 и 1440, axe, без прокрутки вбок, цели 44 px. Снимки
  `reports/mkt4-sites-runtime-2026-10-06/`.

**Проверки.**
- typecheck и lint чисто;
- unit 3647 из 3650 (3 пропуска);
- integration 820 из 820;
- `wrangler deploy --dry-run` собирает Worker, 47,7 КиБ;
- `wrangler dev` поднял Worker в `workerd` и отдал страницу против подставного API.

**Lighthouse** на локальном просмотре: производительность 1, доступность 1, лучшие практики 0,96, SEO 0,54.
- SEO ниже по замыслу: в dev стоит `noindex`.
- Пункт `robots-txt` Lighthouse качает `fetch` из страницы, а CSP без `'self'` в `connect-src` такой запрос не пускает.
  Поисковик берёт файл напрямую.
- Ошибки консоли дают адреса подставного API режима `--fixture`.

**Попутно найдено и исправлено.** Подготовка интеграционных тестов падала после смены даты: сид устарел, путь копирования
данных упорядочивает таблицы по внешним ключам, а у `marketing_sites` ↔ `marketing_site_versions` (MKT3) ссылки идут по
кругу. `copyPlan` разрывает только рёбра колонок с NULL. Копия тогда идёт с `session_replication_role = replica` в той же
транзакции; цикл через обязательные ссылки остаётся ошибкой. Red → green: 3 из 8, затем 8 из 8, полный integration 820
из 820. Новый рабочий пакет `apps/sites` вписан в `package-lock.json` вручную (`npm` снова снимал чужие поля `libc`) и в
`deploy/Dockerfile` (сторож `deploy-server`: 1 красный, затем 40 из 40).

**Не сделано и почему.**
- Картинки: SiteAsset нет, MKT8.
- Боевые хосты, canonical, индексация: MKT7, Q-271.
- Выход `/sites-runtime/*` наружу: решается с MKT7, SECURITY.md.
- Казахские подписи оболочки ждут проверки носителем языка.

**За владельцем.** Ревью и слияние PR. Выкладка Worker, секрет, DNS и `release` только по отдельному
«да».

## 14. Итог Q-276 (07.10.2026)

- **Домен** `packages/domain/src/web-booking/from-price.ts`: `fromPriceWindow`, `fromPriceMinor`. Повторно использует
  `priceStay` и `assertDerivedRuleAllows`, новой формулы скидки нет.
- **API**: `WebBookingService.fromPrices` и `GET /w/from-prices`, строка в таблице прав (`public`).
- **Worker**: места под цену, секция `pricing` с живыми строками, подписи ru, kk, en (`price-format.ts`), скрипт цен,
  CSP с `'self'` только на страницах с ценой.
- **Red → green**:
  - домен: модуля нет → 7 тестов зелёные;
  - integration `from-prices`: метода нет, 9 из 9 красных → 9 из 9 зелёных. Проверено: только тариф брони, 30 ночей,
    ночь 31 не влияет, полная вместимость, стоп-продажа, производный тариф, соседний объект, выключенный тариф, 404,
    403 по домену, 429, нет внутренних идентификаторов;
  - таблица прав без строки → зелёная;
  - Worker 4 красных → 160 из 160;
  - UI `tests/sites` 11 из 11: цена на карточках и в секции цен, ошибка цены прячет число, axe на 390 и 1440.
- `/w/availability` не менялся, его тесты зелёные.
- Модель данных и миграции не менялись.
- **Production QA до MKT12 и публичного запуска:** казахские подписи рантайма (`render/text.ts`, `PRICE_LABEL.kk`) проверяет
  носитель языка; наугад не переписываются.

