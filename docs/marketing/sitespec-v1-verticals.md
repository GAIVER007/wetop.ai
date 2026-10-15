# SiteSpec, секции салона и ресторана (SITE-2)

Статус: **контракт в коде с 15.10.2026, ветка `wt/site-domain`** (план `plans/site-seo-flow-2026-10-15.md`, срез SITE-2;
ADR-149, ADR-184, ADR-185 п. 3). Дополняет [`sitespec-v0.md`](sitespec-v0.md), ничего в нём не отменяя: `schemaVersion`
остаётся `site-spec/0`, все прежние документы гостиниц валидны как были (тесты `site-spec.test.ts`, пример
`sitespec-v0.example.json`). Проверка: `packages/domain/src/marketing/site-spec.ts`. Миграций база не требует: документ
живёт в `marketing_site_versions.spec` (JSON).

Что включается отдельно, не этим срезом: доступ салона и ресторана к конструктору (`apps/api/src/marketing-site/scope.ts`,
`apps/web/src/app/marketing/site/editor/page.tsx`) и публикация (`tracked_sites.property_id`, триггер лицензии) ждут
миграций SITE-3; приём заявок `/w/beauty/book`, `/w/food/reserve`, `/w/lead` вводят SITE-4 и SITE-5.

## 1. Направления

| Поле | Было | Стало |
|---|---|---|
| `site.vertical` | `HOSPITALITY` | `HOSPITALITY`, `BEAUTY`, `FOOD_SERVICE`; совпадает с `Business.vertical` филиала |
| `site.seo.structuredData.type` | `HOTEL`, `HOSTEL`, `APARTMENT`, `LODGING` | по направлению: гостиница прежние четыре; салон `BEAUTY_SALON`; ресторан `RESTAURANT`, `CAFE` |

Секции по направлению (`SITE_SPEC_SECTIONS_BY_VERTICAL`), чужая секция отклоняется кодом `section_not_for_vertical`:

| Направление | Секции |
|---|---|
| все | `hero`, `about`, `features`, `amenities`, `gallery`, `contacts`, `faq`, `cta`, `hours`, `leadForm` |
| гостиница | плюс `accommodations`, `pricing`, `booking` |
| салон | плюс `services`, `staff` |
| ресторан | плюс `menu` |

## 2. Новые базовые типы

| Тип | Правило |
|---|---|
| `Money` | `{ minor: string, currency: string }`: целое число минимальных единиц **строкой** (`^(0\|[1-9][0-9]{0,14})$`, ADR-008, без float), валюта ISO 4217. `"250000"` KZT это 2 500,00 ₸ |
| `CatalogCode` | код записи WETOP (id услуги, id блюда): `^[A-Za-z0-9_-]{1,64}$` |
| `Clock` | `ЧЧ:ММ`, 00:00–23:59, время филиала |
| `Weekday` | целое 0–6, 0 воскресенье (как `Date.getDay()` и `working_hours.weekday`) |

Цена, длительность, выход блюда и часы работы это **снимок данных WETOP**, а не текст ИИ: их ставит заготовка из фактов
филиала (`starterSpecFromFacts`) и платформа поверх ответа модели (`bindCatalogFacts`); проверки генерации и правки
(`catalogFactErrors`) отклоняют число, которого нет в брифе (`invented_price`, `invented_fact`, `invented_hours`),
незнакомую услугу, блюдо или мастера (`unknown_service`, `unknown_menu_item`, `unknown_employee`).

## 3. Реестр новых секций

Общие поля любой секции как в v0 §8: `id`, `type`, `variant`, `heading: LocalizedText<80>`.

| `type` | `variant` | Обязательные поля | Необязательные поля | Пределы | Ассеты | SEO |
|---|---|---|---|---|---|---|
| `services` | `LIST`, `CARDS` | `items` (1–60): `{ serviceCode: CatalogCode, title: LocalizedText<80> }` | `items[].description: LocalizedText<300>`, `items[].category: LocalizedText<60>`, `items[].durationMin: 1–1440`, `items[].price: Money`, `items[].priceFrom: boolean`; `showPrices`, `showDuration`, `groupByCategory: boolean`; `itemAction: Cta` (по умолчанию `BOOK`) | `serviceCode` не повторяется | 0 | `hasOfferCatalog` у `BeautySalon` (услуга и `Offer` с ценой) |
| `staff` | `CARDS`, `LIST` | `items` (1–30): `{ employeeId: UUID, name: LocalizedText<80> }` | `items[].specialization: LocalizedText<120>`, `items[].image: ImageRef` | `employeeId` не повторяется (без учёта регистра нет: id в нижнем регистре) | 0–1 на мастера | нет |
| `menu` | `LIST`, `CARDS` | `categories` (1–30): `{ title: LocalizedText<80>, items (1–80) }`; блюдо `{ itemCode: CatalogCode, title: LocalizedText<120> }` | `items[].description: LocalizedText<300>`, `items[].weightGrams: 1–100000`, `items[].price: Money`, `items[].image: ImageRef`; `showPhotos: boolean` | всего блюд до 300; `itemCode` один на всё меню | 0–1 на блюдо | `hasMenu` у `Restaurant` (`Menu` → `MenuSection` → `MenuItem` с `Offer`) |
| `hours` | `TABLE`, `COMPACT` | `days` (1–7): `{ weekday: Weekday, open: Clock, close: Clock }` | `note: LocalizedText<300>` | день не повторяется; `open ≠ close`; `close < open` значит «после полуночи» | 0 | `openingHoursSpecification` у бизнеса (салон, ресторан) |
| `leadForm` | `INLINE`, `CARD` | `mode` | `note: LocalizedText<300>`, `showComment: boolean`, `submitLabel: LocalizedText<30>` | одна на странице и не рядом с `booking`; `mode` по направлению (§4); `HOTEL_BOOKING` требует `integrations.booking.mode = WETOP_WIDGET`; `BEAUTY_APPOINTMENT` требует хотя бы одну секцию `services` в документе | 0 | содержимое формы не индексируется |

Кнопка `BOOK` ведёт к секции `booking` или `leadForm` текущей страницы, иначе главной.

## 4. Форма заявки и закреплённая кнопка

| `leadForm.mode` | Направления | Что выбирает посетитель | Куда отправляет | Срез приёма |
|---|---|---|---|---|
| `HOTEL_BOOKING` | гостиница | даты, категория, гости (виджет брони) | `/w/book` | есть |
| `BEAUTY_APPOINTMENT` | салон | услуга из секции `services`, мастер из `staff` или «любой», дата и время | `/w/beauty/book` | SITE-4 |
| `TABLE_RESERVATION` | ресторан | дата, время, число гостей | `/w/food/reserve` | SITE-4 |
| `CALLBACK` | все | только имя и телефон | `/w/lead` | SITE-5 |

Тело запроса и его разбор: [`site-leads-v0.md`](site-leads-v0.md), `packages/domain/src/marketing/site-lead.ts`.

`navigation.mobileBar: { book: boolean, whatsapp: boolean }` (необязательно): на телефоне закреплённая внизу кнопка
заявки и WhatsApp. `whatsapp: true` требует `site.contacts.whatsapp` (`missing_contact`). На широком экране скрыта
стилем. Только ссылки, без скрипта.

## 5. Рантайм `apps/sites`

- Рендереры всех пяти секций в `render/sections.ts`; тест сверяет реестр с валидатором.
- Цены `Money` выводятся из строки minor units без float (`render/price-format.ts`, `formatMoney`, `moneyDecimal`).
- Форма заявки салона, ресторана и «перезвоните» работает без JS-фреймворка и без встроенного скрипта: свой файл
  `/_wetop/lead-<хэш>.js` с того же хоста, как скрипт цен (CSP `script-src 'self' <API> challenges.cloudflare.com`,
  `connect-src <API> challenges.cloudflare.com`, `frame-src challenges.cloudflare.com`). В HTML форма скрыта, видна
  запасная строка «Позвоните нам» и WhatsApp; скрипт показывает форму. Ловушка для ботов (`website`), Turnstile по
  `GET /w/config` тем же порядком, что виджет брони, ключ запроса один на попытку. Без ключа сайта (превью, черновик в
  стойке) поля формы выключены (`<fieldset disabled>`), скрипта нет.
- Гостиничная форма `HOTEL_BOOKING` это тот же виджет `/w/widget.js`, что у секции `booking`.
- JSON-LD: тип бизнеса по направлению, `openingHoursSpecification`, `hasMenu`, `hasOfferCatalog`, `FAQPage` как в v0.

## 6. Редактор

Реестр редактора (`SITE_EDITOR_SECTIONS`) знает все 16 секций; новые виды полей: `int`, `clock`, `weekday`, `dataRef`
(код услуги или блюда, id мастера) и `money`. Ссылки на данные и цены в форме блока только для чтения. Правка текста
прямо на сайте (`inlineTextTargets`) берёт названия и описания, но не коды, цены, длительность и мастеров. Ссылки на
фото мастера и блюда входят в `siteSpecAssetRefs` и в разницу версий (`section:<id>:items`, `section:<id>:categories`).
