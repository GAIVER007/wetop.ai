# SiteSpec v0: контракт содержимого управляемого сайта

Статус: **контракт v0, проверка в коде с MKT3 (06.10.2026)** (ADR-149; Q-272 решён владельцем). Проверка документа:
`packages/domain/src/marketing/site-spec.ts`; компонентов рантайма пока нет (MKT4).

Что MKT3 проверяет не полностью: §11 п. 6 только форма `AssetId` (UUID), наличие ассета `READY` того же Location с
MKT8, когда появится `SiteAsset`; §11 п. 8 (`categoryCode` объекта) при публикации, MKT7. Размер 256 КБ считается по
канонической записи документа в байтах UTF-8 (ключи по возрастанию кодовых единиц UTF-16, как RFC 8785, без пробелов).
Это единственный допустимый размер SiteSpec. В базе стоит CHECK `octet_length(spec::text) <= 393216` (384 КБ): это
грубая страховка базы, а не второй допустимый размер документа (384 KiB is a coarse database safety ceiling, not an
alternative allowed SiteSpec size). `jsonb::text` не каноническая запись, второй канонический сериализатор в PostgreSQL
не делается. Транспорт: тело `POST /marketing/site/versions` принимается до 300 КБ (SiteSpec плюс конверт запроса,
`apps/api/src/body-parsers.ts`), больше даёт 413; у остальных маршрутов API прежние 100 КБ. Итого три уровня: HTTP
300 КБ, SiteSpec 256 КБ (400 `too_large`), база 384 КБ.

Полный валидный пример: [`sitespec-v0.example.json`](sitespec-v0.example.json). Архитектура, рантайм и безопасность:
[`README.md`](README.md).

## 1. Что такое SiteSpec

`SiteSpec` это JSON-документ, который описывает сайт **данными**: какие страницы, в каком порядке секции, какие тексты,
какие картинки, какая тема. Он хранится в неизменяемой версии (`marketing_site_versions.spec`) и показывается общим
рантаймом `apps/sites` из компонентов WETOP. В нём нет кода, нет HTML, нет CSS, нет идентификаторов организации,
Business, Location и нет ключей. Кто владелец сайта, рантайм знает по хосту, а не по документу.

Один и тот же документ создают человек (редактор) и ИИ (генерация); правила проверки для обоих одни.

## 2. Верхний уровень

| Поле | Тип | Обязательно | Смысл |
|---|---|---|---|
| `schemaVersion` | `"site-spec/0"` | да | версия контракта; рантайм отказывает в показе версии, которую не знает |
| `site` | `Site` | да | имя, языки, бренд, контакты, юридическая строка, SEO сайта |
| `theme` | `Theme` | да | только выбранные значения из словарей, никакого CSS |
| `navigation` | `Navigation` | да | меню шапки и подвала, ссылки только на свои страницы и секции |
| `pages` | `Page[]` | да | от 1 до 20 страниц, ровно одна главная |
| `integrations` | `Integrations` | да | включены ли бронь WETOP и счётчик WETOP; ключей здесь нет |

Неизвестные поля на любом уровне отклоняются (строгая схема). Размер документа не больше 256 КБ.

## 3. Базовые типы

| Тип | Правило |
|---|---|
| `Locale` | `"ru"`, `"kk"`, `"en"`. Список расширяется версией схемы |
| `LocalizedText<N>` | объект `{ [Locale]: string }`. Ключ `site.defaultLocale` обязателен, остальные ключи только из `site.locales`. Строка после обрезки пробелов от 1 до N символов, только обычный текст: без управляющих символов, без разметки (последовательность `<` с буквой, `/`, `!` или `?` отклоняется), без шаблонов (`{{`, `${`). Рантайм всё равно экранирует текст при выводе |
| `Id` | `^[a-z0-9][a-z0-9-]{0,47}$`. Идентификаторы страниц и секций уникальны во всём документе |
| `Slug` | у главной пустая строка; у остальных `^[a-z0-9]+(?:-[a-z0-9]+)*$`, до 60 символов, уникален, не из зарезервированных: `api`, `w`, `a`, `_next`, `_preview`, `preview`, `assets`, `static`, `robots.txt`, `sitemap.xml`, `favicon.ico`, `.well-known`, а также коды языков (`ru`, `kk`, `en`) |
| `AssetId` | UUID ассета `SiteAsset` того же Location со статусом `READY` (проверяется при сохранении и при публикации) |
| `ImageRef` | `{ assetId: AssetId, alt: LocalizedText<150> }`. ALT обязателен у содержательной картинки |
| `Phone` | E.164: `^\+[1-9][0-9]{9,14}$` |
| `Email` | до 254 символов, один `@`, без пробелов и угловых скобок |
| `HttpsUrl` | только `https:`, без логина и пароля в адресе, без явного порта, хост не IP-адрес и не `localhost`, до 2048 символов |
| `Icon` | словарь: `CLOCK`, `PARKING`, `WIFI`, `BREAKFAST`, `LAUNDRY`, `LUGGAGE`, `KITCHEN`, `AIRCON`, `TRANSFER`, `PETS`, `ACCESSIBLE`, `FAMILY`, `QUIET`, `CENTER`, `STATION`, `STAR` |

### 3.1 Ссылки и действия

`Target` (куда ведёт пункт меню):

| `kind` | Поля | Проверка |
|---|---|---|
| `PAGE` | `pageId` | страница есть в документе |
| `SECTION` | `pageId`, `sectionId` | секция есть на этой странице |
| `EXTERNAL` | `url: HttpsUrl` | открывается с `rel="noopener noreferrer"`; в шапке не больше одной внешней ссылки |

`Cta` = `{ label: LocalizedText<30>, action: Action }`. `Action`:

| `kind` | Поля | Что делает рантайм | Событие счётчика |
|---|---|---|---|
| `BOOK` | | прокрутка к секции `booking` текущей страницы или переход на главную к ней | `booking_step` |
| `PAGE` | `pageId` | переход | |
| `SECTION` | `pageId`, `sectionId` | переход к секции | |
| `PHONE` | | `tel:` из `site.contacts.phone` | `phone_click` |
| `WHATSAPP` | | `https://wa.me/<номер>` из `site.contacts.whatsapp` | `whatsapp_click` |
| `EMAIL` | | `mailto:` из `site.contacts.email` | |
| `EXTERNAL` | `url: HttpsUrl` | переход на внешний адрес | |

Номера и почта в действиях не пишутся: они берутся из `site.contacts`, поэтому ИИ не может подставить чужой номер в
кнопку, а `javascript:` и `data:` невозможны по построению. События счётчика уже есть в allowlist
(`packages/domain/src/web-analytics/hit.ts:6-26`).

## 4. `site`

| Поле | Тип | Обязательно | Правило |
|---|---|---|---|
| `vertical` | `"HOSPITALITY"` | да | v0 знает только гостиницы; совпадает с `Business.vertical` филиала (проверка при сохранении) |
| `displayName` | `LocalizedText<80>` | да | имя на сайте; по умолчанию из `Property.name` или `Location.name` при генерации |
| `defaultLocale` | `Locale` | да | |
| `locales` | `Locale[]` | да | содержит `defaultLocale`, без повторов |
| `brand.tagline` | `LocalizedText<120>` | нет | |
| `brand.logo` | `ImageRef` | нет | ассет вида `LOGO` |
| `brand.faviconAssetId` | `AssetId` | нет | ассет вида `FAVICON` |
| `contacts.phone` | `Phone` | нет | снимок; см. §9 |
| `contacts.whatsapp` | `Phone` | нет | |
| `contacts.email` | `Email` | нет | |
| `contacts.address` | `LocalizedText<200>` | нет | |
| `contacts.geo` | `{ lat: -90..90, lng: -180..180 }` | нет | до 6 знаков после точки |
| `contacts.social` | `{ network, url }[]` | нет | до 6; `network`: `INSTAGRAM`, `FACEBOOK`, `TELEGRAM`, `TIKTOK`, `YOUTUBE`, `VK`; хост `url` обязан совпасть со списком сети (MKT3): `INSTAGRAM` `instagram.com`, `FACEBOOK` `facebook.com`, `TELEGRAM` `t.me`, `telegram.me`, `TIKTOK` `tiktok.com`, `YOUTUBE` `youtube.com`, `youtu.be`, `VK` `vk.com`; к каждому допустим префикс `www.` |
| `legal.operatorName` | `LocalizedText<200>` | нет | строка в подвале; БИН и ИИН сюда не попадают |
| `legal.privacyPageId` | `Id` | нет | страница с политикой; ссылка в подвале |
| `seo.robots` | `"INDEX"` или `"NOINDEX"` | да | `NOINDEX` закрывает весь сайт; превью закрыто всегда, независимо от поля |
| `seo.titleTemplate` | `LocalizedText<80>` | нет | ровно одно вхождение `%s` |
| `seo.structuredData.type` | `"HOTEL"`, `"HOSTEL"`, `"APARTMENT"`, `"LODGING"` | да | тип schema.org (`Hotel`, `Hostel`, `Apartment`, `LodgingBusiness`) |
| `seo.structuredData.includeAddress` | boolean | да | |
| `seo.structuredData.includeGeo` | boolean | да | |

**Языки.** Архитектура многоязычная с v0: каждый текст `LocalizedText`, у сайта список языков. Рантайм v0 публикует
только `defaultLocale`. Язык становится публикуемым, только когда у **каждого** текста документа есть значение на нём;
тогда страницы получают адреса `/<locale>/<slug>`, а `hreflang` и `sitemap` перечисляют варианты. Обещания перевести
сайт на все языки v0 не даёт.

## 5. `theme`

Только словари. Цвета, шрифты и отступы рантайм берёт из токенов пресета; документ выбирает пресет, а не значения.

| Поле | Значения |
|---|---|
| `preset` | `CALM`, `WARM`, `NIGHT`, `COAST` |
| `accent` | `TEAL`, `INDIGO`, `TERRACOTTA`, `FOREST`, `GRAPHITE`, `GOLD` |
| `typography` | `MODERN`, `CLASSIC`, `ROUNDED` |
| `radius` | `SHARP`, `SOFT`, `ROUND` |
| `density` | `COMPACT`, `COMFORTABLE` |
| `colorScheme` | `LIGHT` в v0; `DARK` и `AUTO` зарезервированы |

Каждое сочетание пресета и акцента проверяется на контраст WCAG AA один раз, при сборке библиотеки компонентов, а не на
каждом сайте. Произвольный CSS, цвет в hex и имя шрифта не принимаются.

## 6. `navigation`

| Поле | Тип | Правило |
|---|---|---|
| `header` | `{ label: LocalizedText<30>, target: Target }[]` | от 0 до 7 |
| `headerCta` | `Cta` | нет; обычно `BOOK` |
| `footer` | `{ label: LocalizedText<40>, target: Target }[]` | от 0 до 12 |

Подвал это не секция, а часть оболочки рантайма на каждой странице: пункты `footer`, контакты из `site.contacts`,
`legal.operatorName`, ссылка на политику и строка «Сайт сделан на WETOP». Поэтому в реестре секций его нет.

## 7. `pages[]`

| Поле | Тип | Правило |
|---|---|---|
| `id` | `Id` | |
| `slug` | `Slug` | |
| `isHome` | boolean | ровно одна страница `true`, и только у неё `slug = ""` |
| `title` | `LocalizedText<70>` | заголовок H1 страницы, если первой секцией не стоит `hero` |
| `seo` | `PageSeo` | |
| `sections` | `Section[]` | от 1 до 30 |

`PageSeo`:

| Поле | Тип | Правило |
|---|---|---|
| `title` | `LocalizedText<60>` | нет; иначе `title` страницы через `titleTemplate` |
| `description` | `LocalizedText<160>` | нет, но предупреждение редактора, если пусто у индексируемой страницы |
| `index` | boolean | `false` ставит `noindex` |
| `includeInSitemap` | boolean | при `index = false` обязан быть `false` |
| `canonical` | `"SELF"` | в v0 только на свой адрес на основном домене |
| `og.title` | `LocalizedText<70>` | нет |
| `og.description` | `LocalizedText<200>` | нет |
| `og.imageAssetId` | `AssetId` | нет; иначе картинка первой секции `hero` |

## 8. Реестр секций Hospitality v0

Общие поля любой секции: `id: Id`, `type` (дискриминатор), `variant` (словарь типа), `heading: LocalizedText<80>`
(у всех, кроме отмеченных). Неизвестный `type` или `variant` отклоняется. Раскладку на телефоне, планшете и компьютере
решает компонент, а не документ: в документе нет ширин, колонок и точек перелома. Каждый компонент обязан работать
от 360 px без горизонтальной прокрутки и давать цели нажатия от 44 px (`DESIGN.md`).

Динамические привязки (данные, которые читаются живыми, §9) и их источники:

| Привязка | Что | Откуда берётся | Кто читает |
|---|---|---|---|
| `B-BOOK` | доступность, расчёт и бронь | существующий публичный контракт `/w/config`, `/w/availability`, `/w/book` | браузер посетителя напрямую |
| `B-FROMPRICE` | цена «от» по категории | будущий узкий публичный контракт цены без дат (MKT4); сегодня его нет | браузер посетителя |
| `B-CATEGORY` | активность и вместимость категории | `publicFacts.categories` ответа `/sites-runtime/current` (`README.md` §4.4) | рантайм `apps/sites` при рендере |
| `B-CHECKINOUT` | время заезда и выезда объекта | `publicFacts.checkInTime/checkOutTime` того же ответа | рантайм `apps/sites` при рендере |

Объект для `publicFacts` берётся только из Location сайта; браузер его не выбирает. Все остальные данные секций это
снимок в версии.

| `type` | `variant` | Обязательные поля | Необязательные поля | Пределы | Ассеты | Действия | Привязки | SEO |
|---|---|---|---|---|---|---|---|---|
| `hero` | `IMAGE_FULL`, `IMAGE_SIDE`, `TEXT_ONLY` | `heading`, `primaryAction: Cta` | `subheading: LocalizedText<200>`, `image: ImageRef` (обязателен у `IMAGE_*`), `secondaryAction: Cta` | не больше одного `hero` на странице, только первой секцией | 1 | 1–2 | нет | `heading` становится H1 страницы; картинка загружается без отложенной загрузки |
| `about` | `TEXT_ONLY`, `TEXT_IMAGE` | `heading`, `paragraphs: LocalizedText<600>[]` (1–6) | `image: ImageRef` (обязателен у `TEXT_IMAGE`) | | 0–1 | нет | нет | H2; основной текст для поисковиков |
| `features` | `GRID`, `LIST` | `heading`, `items` (2–8): `{ icon: Icon, title: LocalizedText<60>, text: LocalizedText<200> }` | | | 0 | нет | нет | H2 и H3 пунктов |
| `accommodations` | `CARDS`, `ROWS` | `heading`, `items` (1–20): `{ categoryCode, title: LocalizedText<60>, description: LocalizedText<400> }` | `items[].images: ImageRef[]` (0–6), `items[].highlights: LocalizedText<40>[]` (0–6), `showLiveCapacity: boolean`, `showFromPrice: boolean`, `itemAction: Cta` (по умолчанию `BOOK`) | `categoryCode` уникален в секции | 0–6 на карточку | кнопка карточки ведёт в бронь этой категории | `B-CATEGORY` (неактивная или удалённая категория скрывает карточку), `B-FROMPRICE` при `showFromPrice` | H3 карточек; в JSON-LD не попадают в v0 |
| `amenities` | `LIST`, `ICONS` | `heading`, `items` (1–24): `{ icon: Icon, label: LocalizedText<60> }` | `items[].note: LocalizedText<120>` | | 0 | нет | нет | `amenityFeature` в JSON-LD при `structuredData` |
| `pricing` | `FROM_PRICES` | `heading`, `categoryCodes` (1–20) | `note: LocalizedText<300>` | | 0 | кнопка `BOOK` у строки | `B-FROMPRICE`, `B-CATEGORY`; цены в документе не пишутся никогда | живые цены не попадают в HTML для поисковиков в v0 и в JSON-LD |
| `gallery` | `GRID`, `CAROUSEL` | `heading`, `images: ImageRef[]` (3–24) | | | 3–24 | нет | нет | ALT обязателен; ленивая загрузка |
| `booking` | `INLINE` | `heading` | `note: LocalizedText<300>`, `showCheckInOut: boolean` | не больше одной на странице; требует `integrations.booking.mode = "WETOP_WIDGET"` | 0 | сама форма | `B-BOOK`, `B-CHECKINOUT` при `showCheckInOut` | содержимое формы не индексируется |
| `contacts` | `PLAIN`, `WITH_MAP` | `heading` | `showPhone`, `showWhatsapp`, `showEmail`, `showAddress` (boolean), `map: { provider: "OPENSTREETMAP_LINK" }` (только `WITH_MAP`, нужна `site.contacts.geo`), `directions: LocalizedText<400>` | | 0 | `PHONE`, `WHATSAPP`, `EMAIL` из контактов сайта | нет | адрес и телефон в JSON-LD по флагам `structuredData` |
| `faq` | `ACCORDION`, `LIST` | `heading`, `items` (1–30): `{ question: LocalizedText<200>, answer: LocalizedText<1000> }` | `emitStructuredData: boolean` | | 0 | нет | нет | `FAQPage` в JSON-LD при `emitStructuredData`; ответы видимы на странице (требование поисковиков) |
| `cta` | `BANNER`, `SPLIT` | `heading`, `action: Cta` | `text: LocalizedText<300>`, `image: ImageRef` (только `SPLIT`) | | 0–1 | 1 | нет | H2 |

Карта: в v0 только ссылка на OpenStreetMap по координатам, без встраиваемых iframe и без ключей карт. Встраивание
карты это отдельное решение (сторонние cookies и CSP).

## 9. Снимок или живые данные

Главный принцип: **опубликованный сайт не меняет маркетинговый текст сам по себе из-за правки в стойке.** Текст меняется
только понятным действием владельца: правкой, генерацией или кнопкой «Обновить данными из WETOP», которая создаёт новую
черновую версию и показывает разницу до публикации.

| Данные | Режим | Почему |
|---|---|---|
| Заголовки, тексты, порядок секций, FAQ, удобства, преимущества, тема | **снимок** | это маркетинговый выбор владельца |
| Выбранные картинки и ALT | **снимок** | |
| SEO страниц и сайта | **снимок** | |
| Название сайта | **снимок** | имя на сайте может отличаться от `Property.name` (юридическое, служебное) |
| Названия и описания категорий на карточках | **снимок**, привязанный к `categoryCode` | маркетинговое имя («Стандарт для двоих») не обязано совпадать со служебным; виджет брони показывает своё живое имя |
| Активность категории, вместимость | **живые** (`B-CATEGORY`, `publicFacts`) | архивная категория не должна продаваться с сайта, даже если про неё есть карточка; не загрузилось: живые поля карточки прячутся, текст снимка остаётся |
| Доступность, бронь, её статус | **живые** (`B-BOOK`) | правда только в PMS; это существующий `/w/*` |
| Цена «от» | **живые** (`B-FROMPRICE`) | устаревшая цена в тексте обманывает гостя; при сбое расчёта цена прячется, старое число не показывается. Публичного расчёта «от» без дат сегодня нет: `/w/availability` требует дат (`packages/domain/src/web-booking/request.ts:87-149`), это задача MKT4 |
| Время заезда и выезда | **живые** (`B-CHECKINOUT`, `publicFacts`) | это факт, а не текст; виджет уже показывает его живым (`apps/api/src/web-booking/web-booking.service.ts:72-73`), снимок противоречил бы форме брони рядом; `/w/availability` для первого рендера не годится (требует дат), поэтому факт приходит рантайму в `publicFacts`; не загрузился: строка скрывается, старое время не показывается |
| Адрес, телефон, WhatsApp, email | **снимок** | поля `Property.phone/email` ведутся для печатных форм (`schema.prisma:107-108`); правка в стойке не должна молча менять кнопку «Позвонить»; кнопка «Обновить данными из WETOP» предлагает новые значения |
| Услуги | **снимок** списком в `amenities` | цены услуг в v0 на сайте не показываются |

## 10. Интеграции

| Поле | Значения | Правило |
|---|---|---|
| `booking.mode` | `WETOP_WIDGET`, `NONE` | `WETOP_WIDGET` показывает форму брони существующим виджетом и контрактом `/w/*`. Будет ли бронь реально работать, решает связанный `TrackedSite` (`booking_enabled`, тариф): документ это не дублирует. Публичный ключ в документе не хранится, его подставляет рантайм |
| `analytics.mode` | `WETOP_TRACKER`, `NONE` | `WETOP_TRACKER` ставит существующий счётчик `/a/pms.js` с ключом связанного `TrackedSite` |
| `analytics.consent` | `NOT_REQUIRED`, `WAIT_FOR_CONSENT` | второе ставит `data-consent="wait"` и баннер согласия (`apps/api/src/analytics/tracker.js:173-177`) |

Сторонние счётчики, пиксели рекламы и чаты в v0 не подключаются: это чужой JavaScript.

## 11. Правила проверки

Документ принимается (сохранение, результат ИИ, публикация), только если выполнено всё:

1. `schemaVersion` известен валидатору; строгая схема, неизвестных полей нет; размер до 256 КБ.
2. Все `Id` уникальны; ровно одна страница `isHome`, у неё пустой `slug`; остальные `slug` уникальны и не зарезервированы.
3. Все `Target` и `Action` ссылаются на существующие страницы и секции; `PHONE`, `WHATSAPP`, `EMAIL` требуют
   соответствующего поля в `site.contacts`.
4. Каждый `LocalizedText` содержит `defaultLocale`, ключи только из `site.locales`, пределы длины соблюдены, разметки
   и шаблонов нет.
5. Все `HttpsUrl` проходят проверку §3; сети `social` совпадают со своими хостами.
6. Все `AssetId` это ассеты того же Location в статусе `READY` и нужного вида (`LOGO`, `FAVICON`, `IMAGE`).
7. `type` и `variant` каждой секции из реестра §8; обязательные поля есть; ограничения секции соблюдены (один `hero`
   первым, одна `booking`, `booking` при `integrations.booking.mode = "WETOP_WIDGET"`).
8. `categoryCode` при публикации существует у объекта Location; неактивная категория допустима (карточка скроется),
   незнакомая отклоняется.
9. `includeInSitemap = false`, если `index = false`; `titleTemplate` содержит ровно один `%s`.
10. `site.vertical` совпадает с вертикалью Business филиала.
11. В документе нет полей с идентификаторами организации, Business, Location, Property, `TrackedSite`, ключами и
    секретами (их нет в схеме, и строгая схема их отвергнет).

## 12. Будущие версии

Новая версия схемы получает новый `schemaVersion` и миграцию документа (версия `IMPORT`). Рантайм держит рендереры всех
версий, на которых есть опубликованные сайты. Секции других вертикалей добавляются отдельными реестрами
(`README.md` §8), без изменения правил выше.
