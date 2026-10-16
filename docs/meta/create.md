# Meta Marketing API: выжимка для запуска рекламы (ИИ-таргетолог)

**Источник:** официальная документация Meta for Developers, снято 16.10.2026. Большая часть страниц прочитана в
текстовом виде (адрес страницы плюс `.md`, так Meta отдаёт разметку без скриптов), остальные через справочник `/docs/...`:

- https://developers.facebook.com/documentation/ads-commerce/llms.txt (оглавление документации по рекламе);
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad-campaign
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad-set
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad-creative
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/manage-campaigns
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/campaigns
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group (кампания, сверка цели)
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adsets
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign (группа объявлений, ограничения ODAX)
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adcreatives
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-creative
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/ads
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup (объявление)
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adimages
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-image
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/advideos
- https://developers.facebook.com/docs/marketing-api/advideo
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/videoads
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/videoads/fbvideoads
- https://developers.facebook.com/docs/graph-api/reference/video/ и https://developers.facebook.com/docs/graph-api/reference/video/thumbnails/
- https://developers.facebook.com/docs/graph-api/video-uploads
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/overview/budgets
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/adset-budget-sharing
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/advantage-campaign-budget
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/currencies
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/basic-targeting
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/advanced-targeting
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/placement-targeting
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-search
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/special-ad-category
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-messenger
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-instagram
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/advantage-catalog-ads/standard-enhancements
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/creative/advantage-creative/get-started
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version22.0
- https://developers.facebook.com/docs/marketing-api/reference/ad-creative-object-story-spec/
- https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/
- https://developers.facebook.com/docs/marketing-api/reference/ad-creative-video-data/
- https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data-call-to-action/
- https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data-call-to-action-value/
- https://developers.facebook.com/docs/marketing-api/reference/ad-promoted-object/
- https://developers.facebook.com/docs/marketing-api/reference/adgroup-review-feedback/
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/best-practices/manage-your-ad-object-status
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/rate-limiting
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/error-reference
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/troubleshooting
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/instagramads/get-started
- https://developers.facebook.com/documentation/ads-commerce/instagram/ads-api/guides/pages-ig-account
- https://developers.facebook.com/documentation/ads-commerce/instagram/ads-api/guides/use-posts-as-ads
- https://developers.facebook.com/documentation/ads-commerce/instagram/ads-api/guides/call-to-action
- https://developers.facebook.com/documentation/ads-commerce/instagram/ads-api/reference/media-requirements
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/instagram_accounts
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/connected_instagram_accounts
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/business/instagram_business_accounts
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adspixels
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/system-user/assigned_pages
- https://developers.facebook.com/docs/graph-api/reference/page/
- https://developers.facebook.com/docs/graph-api/reference/page/leadgen_forms/
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/create
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/testing-troubleshooting
- https://developers.facebook.com/docs/marketing-api/reference/adgroup/leads/
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/
- https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/
- https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business

Пересказ своими словами. Примеры в документации на версии Graph API `v25.0` (часть старых примеров на `v23.0`,
`v24.0`, `v11.0`, `LATEST-API-VERSION`). Чего документация не говорит, помечено «не сказано»; где страницы Meta
противоречат друг другу, это сказано прямо (раздел 14). По таким местам код не гадает, а записывает вопрос
(`QUESTIONS.md`) или проверяет вызовом с `execution_options=["validate_only"]`.

Общие правила запроса, страниц и ошибок Graph API описаны в [README.md](README.md) и здесь не повторяются.

---

## 0. Порядок запуска и общие приёмы

Цепочка: загрузить медиа (картинка → `hash`, видео → `id`) → кампания → группа объявлений (ad set) → креатив →
объявление. Каждое создание отвечает `id` нового объекта (в справочнике ответ описан как `{id, success}`, в
руководствах показан только `{"id": "..."}`).

- Все примеры Meta создают объекты со `status=PAUSED` и включают их отдельным `POST /{id}` со `status=ACTIVE`.
  После включения объявление уходит на проверку (`PENDING_REVIEW`), после одобрения становится `ACTIVE`.
- **Проверка без создания:** у `campaigns`, `adsets`, `ads`, `adcreatives` есть параметр
  `execution_options` со значением `validate_only`: запрос проходит все проверки, но ничего не создаёт; успех
  отвечает `{"success": true}`, иначе ошибка с подробностями. У `ads` дополнительно `synchronous_ad_review`
  (только вместе с `validate_only`): прогоняет ещё и проверку правил рекламы.
- **Какое поле виновато:** при ошибке проверки в `error.error_data.blame_field_specs` лежит список путей к полям
  (например `["daily_budget"]`). Удобно для ответа человеку.
- Meta просит обрабатывать ошибки только по кодам: текст сообщения может меняться без предупреждения.
- Ошибка с `"is_transient": true` временная: подождать и повторить.

## 1. Картинки: `POST /act_{ad_account_id}/adimages`

| Параметр | Тип | Что значит |
|---|---|---|
| `bytes` | строка Base64 | содержимое файла |
| `copy_from` | объект `{source_account_id, hash}` | скопировать картинку из другого кабинета (номер без `act_`); нужен доступ на чтение креативов исходного кабинета |

- Можно загрузить картинку или zip-архив. Имя файла обязано иметь расширение (`sample.jpg`, а не `sample` или
  `sample.tmp`). В справочнике обязательных параметров нет; есть пример загрузки файла частью multipart прямо при
  создании объявления (`image_file` в креативе плюс одноимённая часть формы).
- **Ответ:** словарь `images` → (ключ-строка) → объект с полями `hash`, `url`, `url_128`, `url_256`,
  `url_256_height`, `url_256_width`, `height`, `width`, `name`. Что именно служит внутренним ключом (имя файла),
  не сказано; код берёт первый (единственный) элемент.
- `url` временный, Meta прямо запрещает подставлять его в креатив; в креатив идёт `hash`.
- Ошибки: `100`, `200`, `190`, `368` (действие сочтено злоупотреблением), `613`, `80004` (много вызовов на кабинет).
- Пределы размера и форматов на странице не сказаны (отсылка к Ads Guide). Из требований Instagram: ширина не меньше
  600 px для любого размещения; рекомендовано 1080×1080 для Facebook и от 640 px для Instagram; соотношение сторон
  в ленте Instagram от 1.91:1 до 4:5, рекомендовано 1:1. Ошибка `100`, подкод `3858258`: Meta не смогла скачать
  картинку по ссылке (недоступна или закрыта robots.txt).
- Вместо `image_hash` в `link_data` можно дать `picture` (ссылка; Meta сама положит картинку в библиотеку). Одно
  из двух, не оба.

## 2. Видео

### 2.1. `POST /act_{ad_account_id}/advideos` (библиотека видео кабинета)

| Параметр | Тип | Что значит |
|---|---|---|
| `source` | файл формой (multipart) | само видео |
| `file_url` | строка | ссылка, откуда Meta скачает видео (ошибка `389`, если не смогла) |
| `name` | строка | имя в библиотеке |
| `title` | строка | название, меньше 255 знаков |
| `description` | строка | описание |
| `upload_phase` | `start`, `transfer`, `finish`, `cancel` | фаза загрузки частями |
| `file_size` | int64 | полный размер файла в байтах (загрузка частями) |
| `upload_session_id` | число | номер сессии загрузки частями |
| `start_offset`, `end_offset` | int64 | границы части в байтах (`start_offset` включительно) |
| `video_file_chunk` | строка | сама часть между смещениями |
| `source_instagram_media_id` | число | взять видео из поста Instagram; нельзя вместе с `upload_phase` |

- Обязательных параметров справочник не помечает. Ответ: структура с `id`, `video_id`, `upload_session_id`,
  `start_offset`, `end_offset`, `success` и служебными полями кодирования.
- **Порядок вызовов загрузки частями** (что передавать в каждой фазе и как продолжать по `start_offset`/`end_offset`
  из ответа) на доступных страницах **не сказан**: справочник ссылается на раздел «chunked», которого в выдаче нет.
  Простая загрузка `source` или `file_url` описана.
- Ошибки: `100`, `200`, `190`, `222` (видео не видно), `351` (проблема с файлом), `352` (формат не поддержан),
  `382` (файл слишком мал), `389` (не удалось скачать по ссылке), `6000`, `6001` (сбой загрузки, повторить).
- Максимальный размер и длительность в справочнике не сказаны.

### 2.2. Новый путь Meta: `POST /act_{id}/video_ads` (возобновляемая загрузка)

Руководство «FB Video Ads» описывает другой поток: `upload_phase=start` на `/act_{id}/video_ads` → ответ
`video_id` и `upload_url` (`https://rupload.facebook.com/video-ads-upload/v25.0/{video_id}`) → загрузка на
`upload_url` с заголовками `Authorization: OAuth <ключ>`, `offset`, `file_size` (или заголовком `file_url` для
файла по ссылке) → `upload_phase=finish` с `video_id`.

**Важно:** там же сказано, что при запросах от **системного пользователя бизнеса** загрузка видео в бизнес-аккаунты
пока не поддержана, загружать можно только в рекламные кабинеты; права `ads_read`, `ads_management` и задача
`CREATE_CONTENT` на кабинете. Подойдёт ли наш ключ SUAT (README) для этого потока, не сказано: проверять до кода.

Требования к файлу из того же руководства: MP4 рекомендован; соотношение от 16:9 до 9:16; рекомендовано до 10 ГБ;
ширина от 1200 px, рекомендовано 1280×720; 24–60 кадров в секунду; H.264/H.265 (VP9, AV1 тоже); звук AAC, стерео,
48 кГц, от 128 кбит/с. Для Instagram: длительность 3–60 секунд, файл не больше 2,3 ГБ; годность для Instagram
проверяется полем `is_instagram_eligible` у видео.

### 2.3. Готовность видео

`GET /{video_id}?fields=status` → объект `status`:

- `video_status`: `ready`, `processing`, `expired`, `error`;
- `uploading_phase.status` (`not_started`, `in_progress`, `complete`, `error`) и `bytes_transferred` (с какого байта
  продолжать прерванную загрузку);
- `processing_phase.status` (кодирование, генерация превью);
- `publishing_phase` (`status`, `publish_status`, `publish_time`).

Описано в руководстве «FB Video Ads»; общий справочник узла Video поле `status` не описывает. Креатив с видео
создавать только после `video_status = ready` (логика наша; сама Meta этого правила словами не формулирует, но
обработка «генерирует превью и кодировки»).

### 2.4. Превью видео

- Поле `picture` у видео: адрес картинки-превью.
- `GET /{video_id}/thumbnails` → `data[]` с `id`, `uri`, `is_preferred`, `width`, `height`, `scale`. Ключ
  страницы или приложения, права `pages_read_engagement`, `pages_show_list`. Применимо ли к видео из библиотеки
  кабинета (а не страницы), не сказано.
- В `video_data` креатива превью обязательно по требованиям Instagram (то же соотношение сторон, ширина от 600 px);
  справочник `video_data` обязательность не помечает. Даётся `image_url` (ссылка, Meta сохранит в библиотеку; Meta
  советует держать картинку на своём сервере, а не на CDN Facebook) или `image_hash`.

## 3. Кампания: `POST /act_{ad_account_id}/campaigns`

| Параметр | Тип | Обязателен | Что значит |
|---|---|---|---|
| `name` | строка | по руководству да | имя |
| `objective` | перечисление | по руководству да | цель (ниже) |
| `status` | `ACTIVE`, `PAUSED` | по руководству да | при создании только эти два |
| `special_ad_categories` | массив перечисления | **да** (справочник) | `[]` или `["NONE"]`, если категория не особая |
| `is_adset_budget_sharing_enabled` | bool | **да, если бюджет не на кампании** (с v24.0) | см. 3.2 |
| `buying_type` | строка | нет | `AUCTION` по умолчанию; `RESERVED` для охвата и частоты |
| `daily_budget`, `lifetime_budget` | int64 | нет | бюджет кампании (Advantage campaign budget) |
| `bid_strategy` | перечисление | нет | `LOWEST_COST_WITHOUT_CAP`, `LOWEST_COST_WITH_BID_CAP`, `COST_CAP`, `LOWEST_COST_WITH_MIN_ROAS` |
| `spend_cap` | int64 | нет | потолок расхода кампании в дробных единицах валюты, минимум около 100 USD; `922337203685478` снимает потолок |
| `special_ad_category_country` | массив кодов стран | при особой категории | страна особой категории |
| `execution_options` | список | нет | `validate_only`, `include_recommendations` |

- **Цели (ODAX):** `OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`,
  `OUTCOME_SALES`, `OUTCOME_APP_PROMOTION`. Старые (`LINK_CLICKS`, `MESSAGES`, `LEAD_GENERATION`, `CONVERSIONS`
  и др.) объявлены устаревшими с v17.0, но ещё стоят в перечислении. Пример в руководстве «Create an ad campaign»
  всё ещё использует `LINK_CLICKS`; код берёт только `OUTCOME_*`.
- Цель задаёт проверку: все объявления кампании обязаны ей соответствовать.
- Категории: `NONE`, `EMPLOYMENT`, `HOUSING`, `CREDIT`, `ISSUES_ELECTIONS_POLITICS`,
  `ONLINE_GAMBLING_AND_GAMING`, `FINANCIAL_PRODUCTS_SERVICES` (последняя заменяет `CREDIT` с 14.01.2025, требуется
  для США). При выборе любой категории нужна `special_ad_category_country`. При изменении кампании поле называется в
  единственном числе: `special_ad_category`.
- `start_time`/`stop_time` у кампании для чтения; сроки задаются на группе объявлений.
- Если `bid_strategy` не задана, по умолчанию при создании берётся `LOWEST_COST_WITH_BID_CAP`, и тогда каждой группе
  нужен `bid_amount`. Без бюджета кампании Meta советует задавать стратегию на уровне группы.
- Ответ: `{id, success}`. Ошибки: `100`, `190`, `200`, `300` (сбой правки), `613`, `2635` (устаревшая версия API),
  `80004`.
- Пределы: не больше 200 групп в кампании; при бюджете кампании и больше 70 группах нельзя менять стратегию и
  выключать бюджет кампании.

### 3.1. Бюджет на кампании или на группе

Бюджет ставится либо на кампании (делится между группами), либо на каждой группе, не на обоих уровнях сразу
(ошибка `1885621`). Переключение уровня у готовой кампании требует `adset_budgets` (а смена стратегии
`adset_bid_amounts`).

### 3.2. `is_adset_budget_sharing_enabled` (новое обязательное поле)

- С **v24.0** при бюджете на уровне группы (кампания создаётся без `daily_budget`/`lifetime_budget`) поле обязано
  быть передано явно: `true` или `false`. Без него ошибка `4834011`. При бюджете кампании поле не нужно.
- `true` включает «общий бюджет групп»: до 20 % дневного бюджета группы может перетекать в соседние группы той же
  кампании. Работает только с дневным бюджетом; стратегия ставок у всех групп одна.
- Выключить у работающей кампании можно (`false`), включить посреди показа нельзя (`3858418`).
- Ошибки: `4834005` (включено без стратегии ставок), `4834002` (вместе с бюджетом кампании), `4834009` (группы
  кампании должны быть однородными), `4834006` (нельзя менять стратегию при включённом поле).
- Пример в справочнике передаёт `is_adset_budget_sharing_enabled=0`; для простого запуска с одной группой
  разумно `false`.

## 4. Группа объявлений: `POST /act_{ad_account_id}/adsets`

| Параметр | Тип | Обязателен | Что значит |
|---|---|---|---|
| `name` | строка до 400 знаков | **да** | имя |
| `campaign_id` | число | да (по руководству) | кампания |
| `daily_budget` | int64 | один из двух бюджетов | дневной бюджет; только если группа длится больше 24 часов |
| `lifetime_budget` | int64 | один из двух бюджетов | бюджет на весь срок; тогда обязателен `end_time` |
| `billing_event` | перечисление | на практике да | за что платим (ниже) |
| `optimization_goal` | перечисление | на практике да | что оптимизируем (ниже) |
| `bid_strategy` | перечисление | нет | как у кампании |
| `bid_amount` | целое | при `LOWEST_COST_WITH_BID_CAP` или `COST_CAP` | ставка в дробных единицах валюты |
| `destination_type` | перечисление | для переписок и форм да | куда ведёт реклама (ниже) |
| `promoted_object` | объект | по цели | что продвигаем (ниже) |
| `targeting` | объект | **да** | аудитория (раздел 4.4) |
| `start_time` | дата-время | нет | по умолчанию сейчас |
| `end_time` | дата-время | при `lifetime_budget` | `0` или пусто при дневном бюджете: без окончания |
| `status` | `ACTIVE`, `PAUSED` | нет | по умолчанию `ACTIVE` (руководство WhatsApp) |
| `dsa_payor`, `dsa_beneficiary` | строки до 512 | для ЕС | кто платит и в чьих интересах (Закон о цифровых услугах ЕС); ошибки `3858079`, `3858081` |
| `execution_options` | список | нет | `validate_only` |

- `time_start`/`time_stop` взаимозаменяемы с `start_time`/`end_time`. Формат даты в примерах ISO 8601 со смещением
  (`2026-05-12T10:45:09-0700`), в описании написано «UTC UNIX timestamp»; что именно принимается, сказано
  неоднозначно, примеры используют ISO 8601.
- Ответ: `{id, success}`. Ошибки: `100`, `190`, `200`, `368`, `900`, `2500`, `2635`, `2641` (запрещённые
  места в таргетинге), `2695` (предел групп в кампании), `80004`, а также подкоды `246003`/`246004` (помеченная
  аудитория или конверсия).
- Пределы: 5 000 неудалённых групп на обычный кабинет; 50 неархивных объявлений в группе.

### 4.1. Единицы бюджета (важно для тенге)

- Руководство «Budgets»: суммы бюджета и ставки задаются **в наименьшей единице валюты кабинета** (для USD это
  центы). Пример: `daily_budget=2000` это 20 долларов. Руководство «Create an ad set»: дневной бюджет «в центах».
- Справочник: бюджеты «в валюте кабинета», ставка в центах для валют вроде USD/EUR и в целых единицах для JPY/KRW.
- Страница «Currencies» задаёт каждой валюте **смещение (offset)**: 100 (USD, EUR, RUB и большинство) или 1 (JPY,
  KRW, CLP, COP, HUF, IDR, TWD, VND и др.). При смещении 100 единица API это 1/100 основной единицы. Сказано это
  для ставок; для бюджетов прямо не сказано, но руководство по бюджетам говорит о той же «наименьшей единице».
- **KZT (тенге) в таблице смещений нет.** Какое смещение у кабинета в тенге (1 или 100), **не сказано**. Код не
  гадает: вопрос в `QUESTIONS.md`, проверка на реальном кабинете чтением бюджета, созданного вручную в Ads Manager,
  или `validate_only` с заведомо малой суммой.
- В README: `spend` в отчёте приходит десятичной строкой в основных единицах. Бюджет на запись и расход на чтение,
  значит, в разных единицах.

### 4.2. Минимальный дневной бюджет

Справочник даёт **примерные** суммы в USD и предупреждает, что они могут меняться; другие валюты пересчитываются при
создании; минимум считается от дневного бюджета, но действует и на бюджет на срок (5 дней по 5 USD → от 25 USD).

| Стратегия | За что платим | Минимум в день |
|---|---|---|
| `LOWEST_COST_WITHOUT_CAP` | показы | 0,50 USD |
| `LOWEST_COST_WITHOUT_CAP` | клики, отметки «нравится», просмотры видео | 2,50 USD |
| `LOWEST_COST_WITHOUT_CAP` | редкие действия (установки и т.п.) | 40 USD, во всех странах |
| `LOWEST_COST_WITH_BID_CAP` | показы | не меньше `bid_amount` |
| `LOWEST_COST_WITH_BID_CAP` | клики и действия | 5 × `bid_amount` |

Для кабинетов из списка стран (США, Канада, Великобритания, Германия, Япония и др.; Казахстана в списке нет) минимумы
вдвое выше. Ошибки малого бюджета: `1885272` («бюджет слишком мал»), `1885650` (запас на время обновления бюджета, до
15 минут), в примере `blame_field_specs` код `1487901`. Точного минимума для KZT **не сказано**.

### 4.3. `promoted_object`

Поля: `page_id`, `pixel_id` (требует `custom_event_type`), `custom_event_type`, `whatsapp_phone_number`,
`whats_app_business_phone_number_id`, `application_id`, `object_store_url`, `custom_conversion_id`,
`pixel_rule` и другие. Значения `custom_event_type`: `LEAD`, `CONTACT`, `SCHEDULE`, `SUBMIT_APPLICATION`,
`COMPLETE_REGISTRATION`, `PURCHASE`, `SERVICE_BOOKING_REQUEST`, `MESSAGING_CONVERSATION_STARTED_7D`,
`ADD_TO_CART`, `INITIATED_CHECKOUT`, `CONTENT_VIEW`, `SEARCH`, `START_TRIAL`, `SUBSCRIBE`, `OTHER` и др.

**`promoted_object` после создания не меняется** (кроме смены `pixel_id`/`pixel_rule`/`custom_event_type` у
целей конверсий и добавления `application_id`/`product_catalog_id`, если их не было). Ошибка выбрать заново = новая
группа. Ошибка `1487929`: указано больше одного продвигаемого объекта.

### 4.4. Таргетинг (`targeting`)

| Поле | Что значит |
|---|---|
| `geo_locations.countries` | коды стран, `["KZ"]` |
| `geo_locations.regions` | `[{"key": "..."}]`, до 200 |
| `geo_locations.cities` | `[{"key": "...", "radius": 17, "distance_unit": "kilometer"}]`; радиус 10–50 миль или 17–80 км; до 250 |
| `geo_locations.custom_locations` | точка (`latitude`, `longitude` или `address_string`) с радиусом 1–80 км (0,63–50 миль), `distance_unit` по умолчанию мили; до 200 |
| `geo_locations.location_types` | единственный допустимый вариант `["home","recent"]` (он же по умолчанию); ошибка `1870199` просит вообще убрать это поле |
| `excluded_geo_locations` | исключения того же вида |
| `age_min` | по умолчанию 18, не меньше 13 |
| `age_max` | не больше 65 |
| `genders` | `[1]` мужчины, `[2]` женщины; по умолчанию все |
| `locales` | номера языков из поиска `type=adlocale` (например 6 это English (US)), до 50 |
| `publisher_platforms`, `facebook_positions`, `instagram_positions`, `device_platforms` | размещения |
| `targeting_automation.advantage_audience` | `1` или `0`, см. ниже |

- Справочник: «`countries` обязательно»; руководство по таргетингу: нужна хотя бы одна страна, если нет пользовательской
  аудитории. При этом пример с почтовыми индексами страну не передаёт. Безопасно: всегда давать `countries` или
  города (город уже привязан к стране); проверять `validate_only`.
- `radius` при нескольких местах может дать ошибку `100`, подкод `1815946`; Meta советует отдельную группу на каждое
  место или без радиуса.
- **Advantage+ audience.** С v23.0 при создании группы `targeting_automation.advantage_audience` либо по умолчанию
  `1`, либо должно быть задано явно. Если возраст, пол, пользовательские аудитории или интересы заданы **не по
  умолчанию** и поле не передано, создание падает (код ошибки не сказан). При `1`: `age_min` только 18–25, `age_max`
  задать нельзя (фиксировано 65), можно `age_range: [25, 35]` как подсказку. Ограничения по месту, минимальному
  возрасту, языку и исключённым аудиториям Meta не расширяет. Для таргетолога, которому важны возраст и пол строго,
  ставить `0`.
- Размещения: если `instagram_positions` не задан, реклама идёт во все места Instagram. Для лид-форм нельзя
  `device_platforms: desktop` вместе с `publisher_platforms: instagram`.

### 4.5. Сочетания цели, оптимизации и места назначения

По таблицам «Outcome-Driven Ads Experiences» (справочник кампании и группы) и руководствам по переписке и
лид-формам. «нет» в колонке `destination_type` значит, что таблица Meta его не указывает.

| Сценарий | `objective` | `destination_type` | `optimization_goal` | `billing_event` | `promoted_object` | CTA креатива |
|---|---|---|---|---|---|---|
| Лид-форма (мгновенная форма) | `OUTCOME_LEADS` | `ON_AD` | `LEAD_GENERATION` или `QUALITY_LEAD` | `IMPRESSIONS` | `{page_id}` | `SIGN_UP`, `LEARN_MORE`, `APPLY_NOW`, `GET_QUOTE`, `SUBSCRIBE`, `DOWNLOAD` с `value.lead_gen_form_id` |
| Переписка в WhatsApp | `OUTCOME_ENGAGEMENT` (также `OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_TRAFFIC`) | `WHATSAPP` | `CONVERSATIONS` (у ENGAGEMENT ещё `LINK_CLICKS`; у LEADS только `CONVERSATIONS`) | `IMPRESSIONS` | `{page_id}`, по желанию `whatsapp_phone_number` | `WHATSAPP_MESSAGE`, `value.app_destination = WHATSAPP` |
| Переписка в Messenger | `OUTCOME_ENGAGEMENT` (также `OUTCOME_SALES`, `OUTCOME_TRAFFIC`) | `MESSENGER` | `CONVERSATIONS` (у ENGAGEMENT ещё `LINK_CLICKS`) | `IMPRESSIONS` | `{page_id}` | `MESSAGE_PAGE` или `LEARN_MORE`, `value.app_destination = MESSENGER` |
| Заявка внутри Messenger | `OUTCOME_LEADS` | `MESSENGER` (в таблице ODAX `LEAD_FROM_MESSENGER`) | `LEAD_GENERATION` или `QUALITY_LEAD` | `IMPRESSIONS` | `{page_id}` | как Messenger; в креативе нужен `privacy_url` |
| Переписка в Instagram Direct | `OUTCOME_ENGAGEMENT` (также `OUTCOME_SALES`, `OUTCOME_TRAFFIC`; **не** `OUTCOME_LEADS`) | `INSTAGRAM_DIRECT` | `CONVERSATIONS` (у ENGAGEMENT ещё `LINK_CLICKS`) | `IMPRESSIONS` | `{page_id}` | `INSTAGRAM_MESSAGE`, `value.app_destination = INSTAGRAM_DIRECT` |
| Трафик на сайт | `OUTCOME_TRAFFIC` | нет (в перечислении есть `WEBSITE`) | `LANDING_PAGE_VIEWS`, `LINK_CLICKS`, `IMPRESSIONS`, `REACH` | `IMPRESSIONS` или `LINK_CLICKS` | не нужен | `LEARN_MORE` и др. с `link`; при `LINK_CLICKS` и в оптимизации, и в оплате `call_to_action` обязателен |
| Конверсии на сайте (заявка) | `OUTCOME_LEADS` | нет | `OFFSITE_CONVERSIONS` (также `LANDING_PAGE_VIEWS`, `LINK_CLICKS`, `IMPRESSIONS`, `REACH`) | не сказано | `{pixel_id, custom_event_type}`, например `LEAD` | с `link`; в объявлении нужен `conversion_domain` |
| Конверсии на сайте (продажа) | `OUTCOME_SALES` | нет | `OFFSITE_CONVERSIONS` или `VALUE` | не сказано | `{pixel_id, custom_event_type}`, например `PURCHASE` | с `link`; `conversion_domain` |

- По переписке Meta приводит пример группы WhatsApp с `optimization_goal=IMPRESSIONS`, хотя в списке допустимых
  целей для `OUTCOME_ENGAGEMENT` стоят только `CONVERSATIONS` и `LINK_CLICKS`; держимся списка.
- Для WhatsApp у страницы должен быть привязан номер WhatsApp (вручную или API проверки номера страницы). Ошибка
  `2446880`: номер, привязанный к странице или профилю Instagram, отключён.
- Цель «Звонки» (`PHONE_CALL` / `QUALITY_CALL`) и мульти-назначение (Messenger + Instagram + WhatsApp сразу,
  `MESSAGING_*`) в этой выжимке не разобраны.

## 5. Креатив: `POST /act_{ad_account_id}/adcreatives`

Обязательны (руководство): `name` (до 100 знаков) и `object_story_spec`. Ответ `{id, success}`.

### 5.1. `object_story_spec`

| Поле | Что значит |
|---|---|
| `page_id` | страница, от имени которой создаётся скрытый пост; у пользователя роль Admin или Editor на странице |
| `instagram_user_id` | аккаунт Instagram, от имени которого показ в Instagram |
| `link_data` | пост со ссылкой или карусель |
| `video_data` | пост с видео |
| `photo_data`, `text_data`, `template_data` | фото, текст, шаблон каталога |

**`instagram_actor_id` устарело** (журнал изменений v22.0, для всех версий с 09.09.2025): вместо него
`instagram_user_id`. Передать оба поля нельзя (ошибки `2238055`, `2446149`). Руководство «Click to Instagram» всё ещё
показывает `instagram_actor_id`; код его не использует. Если `instagram_user_id` это аккаунт, привязанный к странице,
`page_id` обязан быть той самой страницей. Ошибка `1815199`: у кабинета нет доступа к этому аккаунту Instagram.

### 5.2. `link_data` (картинка)

| Поле | Что значит |
|---|---|
| `image_hash` или `picture` | картинка из библиотеки или по ссылке, одно из двух |
| `link` | адрес; обязан совпадать со ссылкой в CTA. Для лид-формы только `https://fb.me/`; для WhatsApp в примере `https://api.whatsapp.com/send` |
| `message` | основной текст |
| `name` | заголовок |
| `description` | описание под заголовком (в Instagram не показывается) |
| `caption` | подпись-адрес (в Instagram не показывается) |
| `call_to_action` | `{type, value}` |
| `page_welcome_message` | приветствие в переписке (5.5) |
| `child_attachments` | карточки карусели: 2–5 (до 10 при `multi_share_optimized`) |

Рекомендации по тексту из справочника креатива: заголовок рекомендовано до 25 знаков, тело до 90, адрес до 1 000;
подпись в Instagram не длиннее 2 200 знаков (при показе только в Instagram ошибка, при смешанных местах в Instagram
просто не покажется). Если CTA не задан, в Instagram по умолчанию `LEARN_MORE`.

### 5.3. `video_data` (видео)

`video_id` (из библиотеки кабинета), `image_url` или `image_hash` (превью, см. 2.4), `title`, `message`,
`link_description` (требует CTA), `call_to_action`, `page_welcome_message`.

### 5.4. `call_to_action`

- `type`: в перечислении креатива есть `LEARN_MORE`, `SIGN_UP`, `WHATSAPP_MESSAGE`, `MESSAGE_PAGE`,
  `INSTAGRAM_MESSAGE`, `BOOK_NOW`, `CONTACT_US`, `APPLY_NOW`, `GET_QUOTE`, `SUBSCRIBE`, `DOWNLOAD`,
  `WHATSAPP_LINK` и ещё около сотни. **`SEND_MESSAGE` в перечислении нет**, для Messenger служит `MESSAGE_PAGE`.
  Какие типы допустимы при какой цели, Meta не сводит в таблицу («не все типы подходят ко всем объявлениям»).
  Ошибка `1373054`: тип CTA не распознан.
- `value`: `link`, `lead_gen_form_id`, `app_destination` (`MESSENGER`, `WHATSAPP`, `INSTAGRAM_DIRECT` и др.),
  `whatsapp_number`, `page`, `link_caption`, `link_format` и др. В отдельной справочной странице объекта `value`
  нет `whatsapp_number`, а в параметрах `adcreatives` он есть.

### 5.5. Приветствие в переписке (`page_welcome_message`)

- Без него человек видит стандартный текст Meta («Hello! Can I get more info on this?»).
- Для WhatsApp это JSON-объект, передаваемый строкой: `type: "VISUAL_EDITOR"`, `version: 2`,
  `landing_screen_type: "welcome_message"`, `media_type: "text"`, `text_format.customer_action_type`
  (`autofill_message` или `ice_breakers`), `text_format.message.text` (приветствие) и
  `text_format.message.autofill_message.content` (заготовка ответа клиента). Есть варианты с кнопкой звонка, сайта,
  каталога и WhatsApp Flows.
- Для Messenger тот же формат; пределы: текст и ответ на быстрый вопрос до 300 знаков, заголовок быстрого вопроса
  до 80. В `text` допускается `{{user_first_name}}`.

### 5.6. Продвинуть готовый пост Instagram

`POST /act_{id}/adcreatives` с `object_id` = страница, `instagram_user_id`, `source_instagram_media_id` (номер
поста) и при желании `call_to_action`. Номер поста берётся через Instagram API (`/{ig-user-id}/media`); годность к
продвижению по полю `boost_eligibility_info`. Нельзя продвигать посты с музыкой под авторским правом и с
интерактивными элементами. Если пост Facebook продвигается с `instagram_user_id` и в группе есть оба размещения,
возможна ошибка «Creative is missing DOF spec»; лечится `asset_feed_spec.optimization_type =
"DOF_MESSAGING_DESTINATION"`.

### 5.7. Улучшения Advantage+ (отказ от автоизменений)

- С **v22.0** набор «standard enhancements» (`degrees_of_freedom_spec.creative_features_spec.standard_enhancements`)
  больше не принимается; вместо него каждая функция включается или выключается отдельно в
  `degrees_of_freedom_spec.creative_features_spec.<функция>.enroll_status` = `OPT_IN` / `OPT_OUT`.
- Функции: `adapt_to_placement` (по умолчанию включено), `image_touchups`, `image_templates`, `image_uncrop`,
  `image_animation`, `image_background_gen`, `image_brightness_and_contrast`, `text_optimizations`,
  `inline_comment`, `enhance_cta`, `creative_stickers`, `text_translation`, `image_text_translation`,
  `translate_voiceover`, `video_auto_crop`, `video_uncrop`, `video_filtering`, `reveal_details_over_time`,
  `pac_relaxation`, `product_extensions`, `description_automation`, `add_text_overlay`,
  `media_type_automation`. Музыка выключается пустым `asset_feed_spec.audios`.
- Неподходящие к формату функции Meta молча убирает; итог видно чтением `creative_features_spec`.
- Каково значение по умолчанию у функций, кроме `adapt_to_placement`, если поле не передано, **не сказано**. Чтобы
  Meta не меняла текст и картинку без ведома клиента, передавать `OPT_OUT` явно.
- Противоречие: в журнале ошибок есть `3858082` («креатив подходит под standard enhancements, но `enroll_status` не
  передан»), а руководства по Messenger и WhatsApp всё ещё требуют `standard_enhancements.enroll_status`. Как это
  сочетается с отменой в v22.0, не сказано; проверять `validate_only`.

### 5.8. Прочее

- `url_tags`: строка параметров, которая добавляется к ссылкам из рекламы (метки UTM).
- `status` креатива: `ACTIVE`, `IN_PROCESS`, `WITH_ISSUES`, `DELETED`.
- Ошибки создания: `100`, `105` (слишком много параметров), `190`, `200`, `368`, `500` (запрещённое содержимое
  текста), `613`, `1500` (неверный адрес), `2635`, `80004`.

## 6. Объявление: `POST /act_{ad_account_id}/ads`

| Параметр | Тип | Обязателен | Что значит |
|---|---|---|---|
| `name` | строка | **да** | имя |
| `adset_id` | int64 | **да** | группа объявлений |
| `creative` | объект | **да** | `{"creative_id": "<id>"}` или спецификация креатива целиком |
| `status` | `ACTIVE`, `PAUSED` | да (руководство) | при создании только эти два |
| `conversion_domain` | строка | **если кампания передаёт данные пикселю** | домен конверсий без пути (`example.com`) |
| `tracking_specs` | объект | нет | отслеживание действий |
| `execution_options` | список | нет | `validate_only`, `synchronous_ad_review`, `include_recommendations` |

`bid_amount` на объявлении больше не принимается. Ответ `{id, success}`. Ошибки: `100`, `105`, `190`, `194` (не хватает
обязательного параметра), `200`, `368`, `500`, `613`, `2635`, `80004`.

### 6.1. Проверка и состояние

- `status`/`configured_status`: что задано (`ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`).
- `effective_status`: что на деле: `ACTIVE`, `PAUSED`, `PENDING_REVIEW`, `DISAPPROVED`, `PREAPPROVED`,
  `PENDING_BILLING_INFO` (не хватает оплаты), `CAMPAIGN_PAUSED`, `ADSET_PAUSED`, `ARCHIVED`, `DELETED`,
  `IN_PROCESS`, `WITH_ISSUES`.
- `ad_review_feedback`: `global` (словарь «код причины → описание» для всех площадок) и `placement_specific`
  (причины по площадке). Пример ответа Meta не приводит.
- `issues_info`, `failed_delivery_checks`, `recommendations`: дополнительные причины, почему не показывается.
- Отклонённое объявление включить нельзя: надо менять и создавать новое (ошибки `2490427`, `2490468`).
- Получать смену состояния можно и вебхуками рекламы (раздел «Ads Webhooks, Effective status»), здесь не разобрано.

## 7. Изменения

- `POST /{campaign_id | adset_id | ad_id}` с нужными полями; ответ `{success: true}`.
- Статусы: `ACTIVE`, `PAUSED`, `ARCHIVED`, `DELETED`. Пауза кампании ставит дочерним `CAMPAIGN_PAUSED`, пауза группы
  ставит объявлениям `ADSET_PAUSED`. У архивного объекта меняются только `name` и `status` (и только в `DELETED`); у
  удалённого только `name`. Предел архивных объектов: 100 000 каждого вида на кабинет (ошибка `1487990`).
  Удаление: `status=DELETED` или `DELETE /{id}`, необратимо; статистика удалённого объявления может дописываться
  28 дней.
- **Бюджет группы:** `POST /{adset_id}` с `daily_budget`. Не чаще **4 раз в час** на группу, иначе изменение бюджета
  блокируется на час: ошибка `613`, подкод `1487632`. При снижении новый бюджет должен быть не меньше потраченного
  плюс 10 % (потрачено 300, значит не ниже 330). Минимумы раздела 4.2 действуют и при изменении.
- Лимит смены `spend_cap` кабинета: 10 раз в сутки (`17`, подкод `1885172`).
- Создание и правка кампаний, групп и объявлений: не больше 100 запросов в секунду на пару «приложение + кабинет»
  (`613`, подкод `5044001`). Общий счёт кабинета: чтение 1 балл, запись 3; при уровне Limited потолок 60 баллов с
  блокировкой 300 секунд, при Full 9 000 и 60 секунд (`17`/`2446079`, `613`/`1487742`). Создание объявлений также
  ограничено дневным лимитом расхода кабинета (`613`, подкод `1487225`).

## 8. Поиск мест: `GET /search?type=adgeolocation`

| Параметр | Что значит |
|---|---|
| `q` | строка поиска (UTF-8) |
| `location_types` | `["city"]`, также `country`, `region`, `zip`, `geo_market`, `country_group`, `electoral_district` (последнее только США) |
| `country_code` | искать в стране: `country_code=KZ` |
| `region_id` | искать в регионе |
| `limit` | размер страницы |

Ответ: `data[]` с `key` (строка, её и подставлять в `cities[].key`), `name`, `type`, `country_code`, `country_name`,
`region`, `region_id`, `supports_region`, `supports_city`. С марта 2019 часть «городов» переклассифицирована в
районы (`SUBCITY`, `NEIGHBORHOOD` и др.), но тип `city` в поиске работает. Языки: `type=adlocale&q=...` → `key`
(число) и `name`. Нужный ключ и права для поиска на странице не сказаны.

## 9. Активы, доступные ключу

- **Страницы системного пользователя:** `GET /{system-user-id}/assigned_pages` → `data[]` узлов Page плюс
  `tasks` (роли пользователя на странице) и `permitted_tasks`; `summary.total_count`. Параметров нет. Для рекламы
  нужна задача `ADVERTISE` (все руководства по переписке и формам требуют ключ человека с этой задачей). `/me/accounts`
  в этой выжимке не проверялся.
- **Ключ страницы:** поле `access_token` узла Page (выдаётся, если у запрашивающего на странице роль выше Live
  Contributor). Руководства по формам и переписке используют именно ключ страницы; годится ли напрямую SUAT для
  `adcreatives` с `page_id`, не сказано.
- **Instagram:**
  - поле страницы `instagram_business_account` (аккаунт, привязанный при переводе в бизнес-аккаунт) и
    `connected_instagram_account`;
  - `GET /{page_id}/instagram_accounts` (ключ страницы) → `id`, `username`, `profile_pic`;
  - `GET /act_{id}/instagram_accounts` и `GET /act_{id}/connected_instagram_accounts` → список IGUser (ошибка
    `200`, если нет права);
  - `GET /{business_id}/instagram_business_accounts`;
  - если своего аккаунта нет: «теневой» аккаунт страницы, `POST /{page_id}/page_backed_instagram_accounts` (вернёт
    существующий, если уже есть; на странице нужна роль не ниже ADVERTISER), читать `GET` тем же адресом.
- **Пиксели:** `GET /act_{id}/adspixels` → список AdsPixel; параметров нет; ошибки `100`, `190`, `200`, `80004`.
- **Лид-формы:** `GET /{page_id}/leadgen_forms?fields=name,id` с **ключом страницы** (руководство). Справочник
  ребра при этом пишет, что чтение не поддерживается; верим руководству и проверяем вызовом. Поле
  `is_eligible_for_in_thread_forms` отбирает формы, годные для Messenger.
- **Номер WhatsApp страницы:** поле `whatsapp_number` узла Page (читается с доступом Page Public Content Access или
  Page Public Metadata Access).

## 10. Лид-формы и заявки

### 10.1. Создать форму: `POST /{page_id}/leadgen_forms` (ключ страницы)

Обязательны `name` и `questions` (массив `{type, key, label, options}`; `type`: `FULL_NAME`, `FIRST_NAME`,
`LAST_NAME`, `EMAIL`, `PHONE`, `CUSTOM`, `DATE_TIME` и др.). Необязательны `privacy_policy {url, link_text до 70
знаков}`, `thank_you_page` (если есть, в нём обязательны `title` и `button_type`), `context_card`, `locale`,
`block_display_for_non_targeted_viewer`, `is_optimized_for_quality`, `tracking_parameters`,
`follow_up_action_url`. Ответ `{id}`. Обязательна ли ссылка на политику конфиденциальности, справочник не помечает,
руководство в примерах её не передаёт: **не сказано** (Ads Manager её требует, но это не документация API).
Удалить форму нельзя, только `status=ARCHIVED` (архивную нельзя ставить в объявление). Ошибки: `100`, `105`, `190`,
`192` (неверный телефон), `200`, `368`, `80005` (много вызовов leadgen на страницу).

### 10.2. Условия лид-рекламы (TOS)

Поле страницы `leadgen_tos_accepted` (bool): приняты ли условия лид-рекламы на странице. Как их принять через API и
какой код ошибки при непринятых условиях, **не сказано**. Перед запуском лид-формы читать это поле и при `false`
просить владельца принять условия в интерфейсе Meta.

### 10.3. Читать заявки

- `GET /{form_id}/leads?fields=created_time,id,ad_id,form_id,field_data` или `GET /{ad_id}/leads`. Форма может
  стоять в нескольких объявлениях, поэтому по форме заявок больше, чем по объявлению.
- Элемент: `id`, `created_time` (ISO 8601 с `+0000`), `ad_id`, `form_id`, `field_data[]` (`name`, `values[]`).
  `campaign_id` назван в руководстве среди «полей объявления»; `adset_id`, `is_organic` и `platform` в текущих
  прочитанных страницах **не подтверждены** (справочник узла заявки не открылся). Ответы на галочки согласия: поле
  `custom_disclaimer_responses`.
- **Фильтр по времени:** `filtering=[{"field":"time_created","operator":"GREATER_THAN","value":<unix>}]`;
  операторы `LESS_THAN`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`. Показан на `/{ad_id}/leads`; работает ли так же
  на форме, не сказано. Справочник `/{ad_id}/leads` при этом пишет «параметров нет».
- Право `leads_retrieval` обязательно; плюс `ads_management`, `pages_show_list`, `pages_read_engagement`,
  `pages_manage_ads`. Ключ страницы или пользователя человека, который может рекламировать на кабинете и странице.
  Заявки принадлежат странице: нужен админ страницы или выданный доступ в Leads Access Manager.
- Предел: 200 × 24 × (число заявок страницы за 90 дней) вызовов в сутки.
- Приложение в режиме разработки заявки не получает (кроме заявок от людей с ролью в приложении); для чтения нужен
  App Review с `leads_retrieval` и `pages_manage_ads`, затем проверка бизнеса.
- Тестовая заявка: `POST /{form_id}/test_leads` (ключ страницы, роль не ниже Advertiser, одна на форму), удалить
  `DELETE /{lead_id}`.

### 10.4. Вебхук `leadgen` (кратко)

Подписка приложения на поле `leadgen` объекта Page и установка на страницу `POST /{page_id}/subscribed_apps?
subscribed_fields=leadgen` (ключ страницы). Права: `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`,
`pages_read_engagement`, `ads_management`. В уведомлении только номера: `leadgen_id`, `page_id`, `form_id`,
`adgroup_id`, `ad_id`, `created_time`; данные заявки затем `GET /{leadgen_id}`. Задержка до нескольких минут.

## 11. Статистика по объявлениям и группам

Тот же `GET /act_{id}/insights` из README, но `level=adset` или `level=ad`; поля `adset_id`, `adset_name`, `ad_id`,
`ad_name` (наряду с `campaign_id`). Фильтр `filtering` принимает объекты `{field, operator, value}`; конкретные имена
полей для фильтра (например по `adset.id`) на странице не перечислены. Удалённые объекты не попадают в список при
`level=ad`, но учитываются в сумме родителя; их статистику читать по их собственному `id`.

## 12. Права и вход

| Право | Зачем |
|---|---|
| `ads_management` | создавать и менять кампании, группы, креативы, объявления; загружать медиа |
| `ads_read` | читать отчёты (README) и, по руководству «FB Video Ads», для загрузки видео |
| `pages_manage_ads` | реклама от имени страницы (все руководства по переписке и формам) |
| `pages_read_engagement` | то же; также нужно для креатива с видео |
| `pages_show_list` | список страниц |
| `leads_retrieval` | читать заявки |
| `pages_manage_metadata` | подписка вебхука `leadgen` |
| `business_management` | ребро `/{client_business_id}/system_user_access_tokens` (README, Facebook Login for Business) |
| `instagram_basic` | в руководствах по рекламе в Instagram и в Direct **не названо**; может понадобиться для чтения постов через Instagram API (не проверено) |
| `whatsapp_business_management` | для рекламы с переходом в WhatsApp **не требуется** по руководству (там только четыре права выше) |

- Все эти права есть в списке Facebook Login for Business и поддержаны ключом SUAT.
- В конфигурации входа выбираются «активы, к которым нужен доступ»; ключ SUAT видит только отмеченное клиентом. В
  примерах названы страницы, рекламные кабинеты, аккаунты Instagram. Входят ли в выбор пиксели (наборы данных) и
  номера WhatsApp, на странице **не сказано**: проверить в App Dashboard при создании конфигурации.
- Для чужих кабинетов нужен расширенный доступ (Advanced) к `ads_management` через App Review; уровень Full доступа
  Marketing API: 500 вызовов за 15 дней с долей ошибок ниже 15 %.

## 13. Частые ошибки создания

| Ситуация | Что сказано |
|---|---|
| Не хватает оплаты в кабинете | объявление в `effective_status = PENDING_BILLING_INFO` (у живых объектов упоминается и `CREDIT_CARD_NEEDED`); отдельного кода ошибки при создании **не сказано** |
| Кабинет без доступа к Instagram | `1815199`; при странице чужого аккаунта Instagram `1885029` (страница не совпадает) |
| Передали `instagram_actor_id` вместе с `instagram_user_id` | `2238055`, `2446149` |
| Условия лид-рекламы не приняты | **не сказано** (см. 10.2) |
| Не приняты условия пользовательских аудиторий / бизнес-инструментов | `200`/`1870034`, `1870090`, `1870092` |
| Неверный таргетинг | `100`/`1487694` (категория больше недоступна), `100`/`1815946` (радиус при нескольких местах), `1870199` (`location_types`), `1870165`/`3858064` (интересы при аудитории младше 18), `2446394`, `2641` |
| Бюджет мал | `1885272`, `1885650`, `2446307` (потолок кампании), `2238055` (бюджет кампании меньше суммы минимумов групп; в таблице Meta этот номер стоит дважды с разным смыслом, различать по вызову, в котором пришла ошибка) |
| Бюджет и на кампании, и на группе | `1885621` |
| Нет `is_adset_budget_sharing_enabled` | `4834011` |
| Неверный `destination_type` | `2446509` |
| Цель требует сайт, а ссылки нет | `2446383` |
| Ставка при автоставке | `1885204` («уберите ставку или смените оптимизацию») |
| Нет `enroll_status` у креатива | `3858082` (см. 5.7) |
| Страница не совпадает с продвигаемым постом | `1885029` |
| Пост создан приложением в режиме разработки | `1885183` |
| Нет прав на рекламу о политике | `2708008` |
| ЕС без плательщика и выгодоприобретателя | `3858079`, `3858081`, `3858152` |
| Нет `ads_management` или приложение не допущено | `294` |
| Кабинет заблокирован | `1404078`, `1404163`, `2859015` |

## 14. Противоречия в документации Meta

1. Минимальные обязательные поля кампании: руководство называет только `name`, `objective`, `status`; справочник
   требует `special_ad_categories`; руководство по бюджетам требует ещё `is_adset_budget_sharing_enabled` с v24.0.
   Типичный поток n8n из старых примеров падает на втором и третьем.
2. `instagram_actor_id` устарело, но руководство «Click to Instagram» его использует.
3. `standard_enhancements` отменено в v22.0, но примеры WhatsApp и требования Messenger его передают, а код
   `3858082` его требует.
4. Пример лид-группы передаёт `promoted_object` строкой (`"YOUR_PAGE_ID"`) и без `targeting`; справочник требует
   объект `{page_id}` и `targeting`.
5. Пример группы Messenger без `promoted_object`, хотя в списке он обязателен; там же `optimization_goal`
   `CONVERSIONS`, которого нет в перечислении (есть `CONVERSATIONS`).
6. «Archive»: руководство по управлению кампаниями пишет, что архивную кампанию можно вернуть в `ACTIVE`;
   страница о статусах пишет, что из `ARCHIVED` можно только в `DELETED`. Код считает архив необратимым.
7. `SEND_MESSAGE` в CTA не существует; `INSTAGRAM_MESSAGE` есть в перечислении `adcreatives`, но отсутствует в
   справочнике объекта CTA.
8. Формат `start_time`/`end_time`: описание говорит «UTC UNIX timestamp», примеры дают ISO 8601 со смещением.
9. `GET /{page_id}/leadgen_forms`: руководство показывает чтение, справочник ребра пишет, что чтение не поддерживается.

## 15. Не сказано (по этим местам код не гадает)

- Смещение валюты KZT и точный минимальный дневной бюджет в тенге.
- Пошаговый протокол загрузки видео частями в `/advideos`; годится ли SUAT для нового потока `/video_ads`.
- Нужен ли SUAT обменивать на ключ страницы для креативов, форм и заявок.
- Обязательность `privacy_policy` в лид-форме; способ принять условия лид-рекламы через API и код ошибки при
  непринятых условиях.
- Код ошибки при отсутствии способа оплаты на этапе создания.
- Код ошибки Advantage+ audience при нестандартном возрасте или поле без `targeting_automation`.
- Значения по умолчанию у функций Advantage+ creative (кроме `adapt_to_placement`).
- Поля `adset_id`, `is_organic`, `platform` у заявки в текущей документации.
- Входят ли пиксели и номера WhatsApp в выбор активов Facebook Login for Business.
