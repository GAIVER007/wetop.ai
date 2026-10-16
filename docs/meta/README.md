# Meta Marketing API: выжимка для кабинета рекламы (МКТ-В3, интеграция)

**Источник:** официальная документация Meta for Developers, снято 16.10.2026:

- https://developers.facebook.com/docs/marketing-api/insights (обзор Insights API);
- https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/ (справочник параметров и полей);
- https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/ (формат `actions`);
- https://developers.facebook.com/docs/marketing-api/insights/best-practices/ (пределы, асинхронные отчёты, свежесть);
- https://developers.facebook.com/docs/marketing-api/overview/authorization/ (уровни доступа, права);
- https://developers.facebook.com/docs/facebook-login/facebook-login-for-business (вход для техпровайдеров, виды ключей).

Пересказ своими словами, только то, на что будет опираться код интеграции (AGENTS.md §5). Примеры в документации на
версии Graph API `v25.0`. Чего документация не говорит, помечено «не сказано»; по таким местам код не гадает.

## Права и доступ

- Чтение отчётов кабинета: право `ads_read` на кабинет, которым приложение владеет или к которому владелец кабинета дал
  доступ. Для кабинетов **чужих бизнесов** (наш случай: каждая организация WETOP со своим кабинетом) нужен
  **расширенный доступ (Advanced Access)** к `ads_read` через App Review.
- Уровни Marketing API: **Limited access** по умолчанию, «только для разработки, не для рабочих приложений живых
  рекламодателей»; **Full access** через App Review, неограниченное число кабинетов при выданном `ads_read`.
- Проверка бизнеса (Business Verification) для этого случая прямо не сказана; сказано «если приложение получает
  чувствительные данные». Решение по ней: в App Dashboard при подаче.

## Подключение клиента: Facebook Login for Business

- Предпочтительный способ Meta для техпровайдеров. В App Dashboard создаётся конфигурация (вид ключа, активы, права),
  её `config_id` передаётся в окно входа вместо `scope`.
- Приложение должно быть типа **Business**.
- Вид ключа для работы сервера без человека: **Business Integration System User access token (SUAT)**. Выдаётся только
  через веб-поток с кодом авторизации (authorization code grant). По умолчанию **не истекает**; параметром
  `set_token_expires_in_60_days` можно ограничить 60 днями.
- Пользовательский ключ «короткоживущий», для действий человека в реальном времени; для ночной сверки не подходит.
- Все запрошенные права должны быть выданы, иначе приложение не получает ни одного. `ads_read` поддержан обоими видами
  ключа.

## Отчёт: `GET /act_{ad_account_id}/insights`

| Параметр | Что значит |
|---|---|
| `level` | `ad`, `adset`, `campaign`, `account`; нам нужен `campaign` |
| `time_range` | `{'since':'ГГГГ-ММ-ДД','until':'ГГГГ-ММ-ДД'}`; время UNIX не принимается |
| `time_increment` | `all_days` (по умолчанию), `monthly` или число дней 1–90 на срез; нам `1` (по дням) |
| `date_preset` | готовые периоды (`last_7d` и т.п.); по совету Meta эффективнее своих дат |
| `fields` | список полей через запятую |
| `limit` | размер страницы; максимум не сказан |

Поля, которые нам нужны: `campaign_id`, `campaign_name`, `date_start`, `date_stop`, `spend` (оценка расхода, **строка
с десятичным числом**, например `"5339.5"`), `impressions`, `clicks`, `actions`, `account_currency` (валюта кабинета).
Готовые `ctr`, `cpc`, `cpm` есть, но мы считаем их сами из сырых чисел (одинаково с ручной статистикой).

Ответ: `data`, `paging` (курсоры по общим правилам Graph API), `summary`. Начало периода не дальше 37 месяцев назад
(ошибка 3018).

### `actions` (список `AdsActionStats`)

Элемент: `action_type` (строка), `value` (число строкой, окно атрибуции по умолчанию), а также `1d_click`, `7d_click`,
`1d_view`. Типы, относящиеся к заявкам и переписке:

- `lead`: все заявки вне Facebook и на Facebook;
- `onsite_conversion.lead_grouped`: все заявки на Facebook;
- `leadgen_grouped`: заявки из Messenger и мгновенных форм;
- `offsite_conversion.fb_pixel_lead`: заявки по пикселю;
- `onsite_conversion.messaging_conversation_started_7d`: начатые переписки;
- `onsite_conversion.messaging_first_reply`: новые переписки.

Окно атрибуции по умолчанию в разных разделах справочника описано по-разному (`["7d_click","1d_view"]` и
`["7d_view","1d_click"]`), а что вернётся в `value` при нескольких заданных окнах, не сказано. Поэтому код окно не
задаёт и берёт `value` (окно кабинета по умолчанию, как в Ads Manager); экран подписывает это словами.

## Свежесть данных и часовой пояс

- Отчёты обновляются каждые **15 минут**; данные перестают меняться через **28 дней**; после остановки объявления
  цифры ещё пару дней дописываются. Как часто перечитывать последние дни, не сказано.
- Данные считаются в **часовом поясе кабинета**; ежедневные выгрузки Meta советует разносить по суткам.

## Пределы и асинхронные отчёты

- Заголовок `X-FB-Ads-Insights-Throttle`: JSON с `app_id_util_pct`, `acc_id_util_pct` (доля использованного запаса
  приложения и кабинета) и `ads_api_access_tier`. Заголовок `x-ad-account-usage`: пределы кабинета.
- Превышение: `error_code = 4` (у глобального предела подкод `1504022`, «Too many API requests»), в справочнике также
  `613`. Совет: разносить запросы, замедляться по мере приближения к 100 %, после отказа ждать и повторять.
- Большие периоды: асинхронный отчёт `POST <объект>/insights` → `report_run_id` → опрашивать `async_status` до
  «Job Completed» и `async_percent_completion` = 100 → читать `<report_run_id>/insights`. Отчёт живёт 30 дней, может
  идти до часа. Сначала пробовать синхронно, на таймауте переходить на асинхронный.

## Запрос, страницы, ошибки (Graph API)

Источники, снято 16.10.2026: https://developers.facebook.com/docs/graph-api/overview,
https://developers.facebook.com/docs/graph-api/results, https://developers.facebook.com/docs/graph-api/guides/error-handling.

- Хост `graph.facebook.com`, версия в пути (`/v25.0/...`): без версии запрос уходит на самую старую версию.
- Ключ передаётся параметром запроса `access_token`; заголовок Authorization в документации не описан, не используем.
- Страницы: `paging.next` это адрес следующей страницы (с курсором `after`). Читать, пока `next` есть: страница может
  быть короче `limit` и даже пустой, но с `next`. Курсоры не хранить.
- Ошибка: объект `error` с `message`, `type`, `code`, `error_subcode`, `error_user_title`, `error_user_msg`,
  `fbtrace_id`. Коды: `190` ключ истёк (нужен новый ключ, повтор бесполезен); `4`, `17` слишком много вызовов (ждать
  и повторить), `613` предел Insights (из справочника Insights, см. выше); `10` и `200`–`299` нет права (повтор
  бесполезен, нужен новый вход); `1`, `2` временный сбой (ждать и повторить).

## Вход клиента и чтение кабинета

Источники, снято 16.10.2026: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow,
https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/,
https://developers.facebook.com/docs/marketing-api/reference/ad-account/.

- Окно входа: `https://www.facebook.com/v25.0/dialog/oauth` с параметрами `client_id` (номер приложения),
  `redirect_uri` (должен совпадать с адресом из «Valid OAuth redirect URIs» в настройках приложения), `state` (строка
  приложения, возвращается без изменений; служит защитой от подделки запроса, проверяет приложение), `response_type`.
  Для Facebook Login for Business добавляется `config_id`; для ключа SUAT обязательно `response_type=code` и
  `override_default_response_type=true` (SUAT выдаётся только через код авторизации).
- Обмен кода на ключ сервером: `GET https://graph.facebook.com/v25.0/oauth/access_token` с `client_id`,
  `redirect_uri` (тот же, что в окне), `client_secret`, `code`. Ответ JSON: `access_token`, `token_type`, `expires_in`.
  Секрет приложения никогда не попадает в браузер.
- Кабинет по номеру: `GET /act_{ad_account_id}?fields=…`. Поля: `id` («act_{номер}»), `account_id` (номер строкой),
  `name`, `currency`, `timezone_name`, `account_status` (1 ACTIVE, 2 DISABLED, 3 UNSETTLED, 7 PENDING_RISK_REVIEW,
  8 PENDING_SETTLEMENT, 9 IN_GRACE_PERIOD, 100 PENDING_CLOSURE, 101 CLOSED, 201 ANY_ACTIVE, 202 ANY_CLOSED).
- **Какие кабинеты выбрал клиент** (снято 16.10.2026: https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business,
  https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/system-user/assigned_ad_accounts):
  ключ SUAT видит только активы, которые клиент отметил в окне входа. `GET /me?fields=client_business_id` с этим ключом
  возвращает `id` (системный пользователь интеграции) и `client_business_id`. `GET /{system-user-id}/assigned_ad_accounts`
  возвращает `data`: список кабинетов (узлы AdAccount, поля просятся через `fields`, плюс `tasks`), `paging`,
  `summary.total_count`; параметров у ребра нет, права в справочнике не названы, ошибка `100` «Invalid parameter».
  Поэтому номер кабинета человек не вводит: после входа сервер читает этот список; один кабинет подключается сразу,
  несколько показываются на выбор.
