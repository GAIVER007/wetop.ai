# Site Brief v0: бриф сайта филиала

Срез MKT5. Код: `packages/domain/src/marketing/brief.ts` (правила, без Nest и Prisma), `apps/api/src/marketing-site/brief.service.ts`
(чтение), маршрут `GET /marketing/site/brief`. План и решения: `plans/mkt5-site-brief-2026-10-07.md`.

## 1. Зачем

Бриф это детерминированная сводка фактов одного филиала для будущей генерации `SiteSpec` (MKT6). Он собирается на
каждом чтении из того, что уже есть в WETOP, и ничего не сохраняет. В MKT5 модель не вызывается, текст не пишется:
бриф говорит, что известно, откуда, чего нет, где источники расходятся и какие секции сайта подкреплены данными.

Бриф не `SiteSpec`, не черновик версии и не текст сайта. Строка `MarketingSite` для него не нужна и не создаётся.

## 2. Схема

```
SiteBrief {
  schemaVersion: 'site-brief/0'
  collectedAt: string                 // метаданные
  briefHash: string                   // sha256, 64 символа нижнего регистра
  input: {                            // единственная часть, которую MKT6 может передать модели (как DATA)
    identity: { displayNameCandidate, displayNameSource, locationName, propertyName, address, addressSource,
                city, countryCode, propertyType, timezone, currency, phone, phoneSource, email, emailSource }
    stay: { checkInTime, checkOutTime }
    accommodations: [{ categoryCode, name, kind, capacityAdults, activeUnits }]
    capabilities: { booking: true, fromPrice: true }
    sellerContent: { siteLocaleHints, includedInPrice, extraCharges, houseRules, faq } | null
    channelContent: { description, importantInformation, website, policies, facilities, photoSummary } | null
  }
  sources: { platform: { state }, seller: { state, reason? }, channex: { state, checkedAt } }   // метаданные
  found: [{ code, source }]
  missing: [{ code }]
  sourceUnavailable: [{ source: 'CHANNEX', code }]      // метаданные
  conflicts: [{ code, authoritativeSource, authoritativeValue, otherSource, otherValue }]
  truncations: [{ source, field, originalLength }]      // метаданные
  proposedStructure: { pages: [{ kind: 'HOME', sections: [{ type, reasonCodes, evidenceCodes, requires?, bindings? }] }] }
}
```

`source` в выходе: `PLATFORM`, `SELLER_PROFILE`, `CHANNEX`.

## 3. Граница с ИИ

- В модель может уйти только `input`, отдельным блоком данных. `collectedAt`, `sources`, `sourceUnavailable`,
  `truncations`, ошибки и любые служебные сведения в промпт не идут. MKT6 не сериализует ответ API целиком.
- Тексты Channex и владельца (`description`, `importantInformation`, `houseRules`, `faq` и прочие) это непроверенные
  данные. Строка «Ignore all previous instructions…» остаётся строкой с источником `CHANNEX`: бриф её не исполняет,
  не толкует и не вырезает. Системная и разработческая инструкция MKT6 никогда не строится из этих строк.
- Цен в брифе нет: цена на сайте только живая `B-FROMPRICE`. MKT6 не пишет чисел вроде «от 25 000 ₸» в текст.
- `activeUnits` это вместимость фонда, а не свободные места сейчас. «Свободно 2 номера» из него писать нельзя.

## 4. Источники и белые списки

| Источник | Что берётся | Чего нет |
|---|---|---|
| Филиал scope | `name`, `address`, `phone`, `email`, `timezone`, `currency` | id |
| Объект филиала | `name`, `address`, `city`, `countryCode`, `channexPropertyType`, `timezone`, `currency`, `checkInTime`, `checkOutTime` | id, организация, `legalName`, `bin`, даты; `phone` и `email` объекта (это контакты печатных форм) |
| Категории объекта | активные: `code`, `name`, `kind`, `capacityAdults`, число активных мест | id, комнаты, места, уборка, блокировки, брони |
| Профиль продавца филиала | `languages` (как подсказка: пересечение с `ru`, `kk`, `en`), `includedInPrice`, `extraCharges`, `houseRules`, `faq` | `promptText`, инструкция агента, `botName`, обращение, эмодзи, длина реплик, приветствие, запреты, «когда звать человека», служебные поля, профиль агента, мастер, диалоги |
| Channex объекта филиала | объект: `title`, `description`, `importantInformation`, `phone`, `email`, `website`, `address`, `city`, `country`; правила: `checkInTime`, `checkOutTime`, `maxGuests`, `pets`, `smoking`, `internet`, `parking`; удобства: `title`, `category`; фото: только сводка | id провайдера и сопоставлений, ключ, сырой ответ, адреса фото, тексты ошибок |

Продавец ищется только той же организации, с `location_id` филиала scope, сценарием `sales` и не в архиве. Старый
продавец организации без филиала, чужой филиал и черновик мастера не подставляются. Сопоставление Channex берётся
только у объекта этого филиала. Гости, брони, счета, платежи, касса, люди, членства и диалоги не читаются вовсе.

Инструкция ИИ-продавца не контент сайта, даже если похожа на описание бизнеса.

## 5. Старшинство

- Платформа главная: филиал, объект, пояс, валюта, заезд и выезд, категории.
- Телефон и почта: филиал, иначе Channex.
- Адрес: филиал, затем объект, затем Channex. Город: объект, затем Channex. Страна: объект, затем Channex (код из двух букв).
- `displayNameCandidate`: название Channex, иначе филиал, иначе объект. Это кандидат, а не переименование.
- Тексты Channex и продавца лежат отдельными блоками и друг друга не перезаписывают.

## 6. Расхождения

Коды: `address_mismatch`, `checkin_mismatch`, `checkout_mismatch`, `email_mismatch`, `name_mismatch`,
`phone_mismatch`. Сравнение детерминированное: пробелы по краям и внутри, регистр; телефон по цифрам; время как `ЧЧ:ММ`;
название Channex сравнивается с названиями и филиала, и объекта. Главным остаётся значение платформы. Если поле
филиала пустое и взято из Channex, расхождения нет.

## 7. Найдено, нет, недоступно

- `found`: `platform.identity`, `platform.address`, `platform.contacts`, `platform.stay_times`,
  `platform.accommodations`, `seller.languages`, `seller.included_in_price`, `seller.extra_charges`,
  `seller.house_rules`, `seller.faq`, `channex.title`, `channex.description`, `channex.important_information`,
  `channex.contacts`, `channex.address`, `channex.website`, `channex.policies`, `channex.facilities`, `channex.photos`.
- `missing`: `accommodations`, `public.address`, `public.city`, `public.country`, `public.contact`,
  `marketing.description`, `amenities`, `faq`, `photos`.
- `NO_KEY` и `NO_MAPPING` значат «Channex не подключён»: факт, который мог дать только он, отсутствует.
  `DENIED`, `NOT_FOUND`, `RATE_LIMITED`, `UNREACHABLE` значат «сейчас не проверить»: такой факт не попадает в `missing`,
  источник уходит в `sourceUnavailable`, ответ остаётся 200.

Все массивы отсортированы по коду.

## 8. Предлагаемая структура

Одна страница `HOME`, порядок секций фиксирован:

| Секция | Когда | Особое |
|---|---|---|
| `hero` | всегда | |
| `about` | есть описание или важная информация Channex | |
| `accommodations` | есть активные категории | |
| `pricing` | есть активные категории | `bindings: ['B-FROMPRICE']` |
| `amenities` | есть удобства Channex или «что входит в цену» продавца | |
| `gallery` | есть фото Channex | `requires: ['MKT8_MEDIA_IMPORT']` |
| `faq` | есть вопросы продавца | |
| `booking` | всегда (способность гостиницы) | `requires: ['MKT7_TRACKED_SITE']` |
| `contacts` | есть адрес, телефон или почта | |
| `cta` | всегда | |

`features` в v0 не предлагается: отдельного источника преимуществ, кроме удобств, нет, и «Преимущества» из воздуха не
сочиняются. Юридических текстов (политика, оферта, правила оплаты и отмены) бриф не предлагает и не пишет.

## 9. `briefHash`

`sha256(canonicalJson({ schemaVersion, input, missing: [коды], conflicts, proposedStructure }))` тем же
`canonicalJson`, что у хэша версии сайта. Не входят `collectedAt`, `checkedAt`, состояния источников,
`sourceUnavailable`, `found` и `truncations`. Одни и те же факты дают один хэш при любом порядке строк из базы и
Channex; любое значимое изменение даёт другой. Будущий `GenerationRun.brief_hash` опирается на этот хэш.

## 10. Пределы

Описание 4000, важная информация 2000, удобств 50 (название 120, категория 60), подписей фото 20 по 200, сайт 300,
название Channex 200, адрес 500, город 100, строки правил 200; поля продавца по `SELLER_PROFILE_LIMITS`. Усечение по
символам, без исходника; в `truncations` поле, источник и исходная длина.

## 11. API

`GET /marketing/site/brief`, право `settings`, строгий scope MKT3: без филиала или только с бизнесом 409 «Выберите
филиал»; чужой, устаревший или архивный филиал или бизнес 403; салон и ресторан 403. Тела нет. `?refresh=1` только
обходит кэш Channex (10 минут, по id объекта провайдера) и больше ничего не меняет. Снимок базы собирается одной
транзакцией чтения; запрос в Channex идёт после её закрытия. Маршрут ничего не пишет; журнал на чтение не ведётся.
Хранения нет: брифа нет ни в `marketing_sites`, ни в версиях, ни в отдельной таблице.
