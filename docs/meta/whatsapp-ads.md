# WhatsApp из рекламы: выжимка для атрибуции (ИИ-таргетолог)

**Источник:** официальная документация Meta for Developers, снято 16.10.2026:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages (общая форма
  вебхука `messages`);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text (текстовое
  сообщение, синтаксис и пример с объектом `referral`);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/image (то же
  для картинки);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/ctwa/welcome-message-sequences
  (приветственные цепочки и ещё один пример `referral`);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog (когда добавлены `referral` и
  `ctwa_clid`);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint (проверка
  подписи, повторы);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview (повторы и дубли);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (окно бесплатного входа);
- https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging (Conversions API для
  переписки);
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/automatic-events-api
  (автоматические события, для справки);
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads и
  https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp
  (создание рекламы с переходом в WhatsApp).

Страницы брались в виде Markdown (тот же адрес с `.md`), который Meta отдаёт для своих документов. Пересказ своими
словами, только то, на что будет опираться код (AGENTS.md §5). Чего документация не говорит, помечено «не сказано»; по
таким местам код не гадает. Справочник On-Premises API (где раньше было подробное описание `referral`) на дату снятия
не открывается: страница показывает только извещение о закрытии этого API; журнал изменений прямо предупреждает, что
`referral` в Cloud API отличается от On-Premises, поэтому описания оттуда не переносим.

## 1. Объект `referral` во входящем сообщении

Когда человек нажал рекламу с переходом в WhatsApp (Click-to-WhatsApp, далее CTWA) и отправил сообщение бизнесу,
вебхук `messages` (поле подписки `messages`, `object` = `whatsapp_business_account`) приходит в обычной форме, а в
элементе массива `messages` появляется объект `referral`. Справочники text и image показывают его одинаково; для
остальных типов сообщений (видео, голос и т.д.) отдельно не проверялось, в общем обзоре сказано лишь, что сообщения
«напрямую, через рекламу или через элемент интерфейса» имеют одну общую форму.

| Поле | Что значит по документации |
|---|---|
| `source_url` | Адрес рекламы, вида `https://fb.me/...` |
| `source_id` | **ID рекламы** (Cloud API: «Click to WhatsApp ad ID», пример `120226305854810726`). На странице приветственных цепочек тот же пример подписан «ad or post», то есть при `source_type=post` это, видимо, ID публикации; отдельно не описано |
| `source_type` | В справочнике Cloud API показано только значение `ad`. На странице приветственных цепочек указано `ad or post`. Полный список значений не сказан |
| `body` | Основной текст рекламы |
| `headline` | Заголовок рекламы |
| `media_type` | `image` или `video` |
| `image_url` | Ссылка на картинку рекламы; есть только у рекламы с картинкой |
| `video_url` | Ссылка на видео; есть только у видеорекламы |
| `thumbnail_url` | Превью видео; есть только у видеорекламы |
| `ctwa_clid` | ID клика по рекламе (строка, длинная). **Поля нет совсем**, если сообщение пришло из рекламы в Статусе WhatsApp (размещение WhatsApp Status) |
| `welcome_message.text` | Текст приветствия, заданный в рекламе |
| `ref` | Есть только в примере на странице приветственных цепочек с пометкой «новое поле»; смысл не описан |

Пример формы (значения вымышленные, по образцу документации):

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<WABA_ID>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "<НОМЕР>", "phone_number_id": "<PHONE_NUMBER_ID>" },
        "contacts": [{ "profile": { "name": "Тест Гость" }, "wa_id": "<WA_ID>" }],
        "messages": [{
          "from": "<WA_ID>",
          "id": "wamid.<...>",
          "timestamp": "1760600000",
          "type": "text",
          "text": { "body": "Здравствуйте, есть места?" },
          "referral": {
            "source_url": "https://fb.me/<...>",
            "source_id": "<AD_ID>",
            "source_type": "ad",
            "body": "<ОСНОВНОЙ ТЕКСТ>",
            "headline": "<ЗАГОЛОВОК>",
            "media_type": "image",
            "image_url": "https://scontent.xx.fbcdn.net/<...>",
            "ctwa_clid": "<CLICK_ID>",
            "welcome_message": { "text": "<ПРИВЕТСТВИЕ>" }
          }
        }]
      }
    }]
  }]
}
```

Что **не сказано**:

- приходит ли `referral` только в первом сообщении после клика или в нескольких; документация описывает лишь
  сообщение, отправленное после нажатия рекламы. Код считает рекламным то сообщение, в котором `referral` есть, и
  запоминает его на переписку; на повтор в следующих сообщениях не рассчитывает;
- что будет, если человек уже переписывался с номером раньше и потом пришёл из рекламы (новая это переписка или нет
  для `referral`);
- может ли `referral` прийти без `source_id` (в Cloud API обязательность полей не указана; есть только явные пропуски:
  `ctwa_clid` в Статусе, медиаполя по типу рекламы);
- полный список значений `source_type`;
- срок жизни ссылок `image_url`, `video_url`, `thumbnail_url` (это адреса CDN; если нужна картинка, сохранять сразу,
  гарантии хранения нет).

Пример в Conversions API (раздел 2) показывает `referral` со вложенным `image: { id }` вместо `image_url`; это, судя по
ссылкам рядом, форма On-Premises API. Для Cloud API опираемся на справочник вебхука.

**История вебхуков не запрашивается**: API для получения прошлых вебхуков нет, поэтому `referral` надо сохранить в
момент приёма вместе с исходным телом.

## 2. Conversions API для переписки (отправка событий в Meta)

Нужен, чтобы вернуть в Meta факт заявки или покупки, случившейся в переписке из CTWA (для отчётов и оптимизации).

- **Права приложения (расширенный доступ):** `whatsapp_business_management` и `whatsapp_business_manage_events`
  (второе выдаётся почти автоматически, если уже есть расширенный `whatsapp_business_messaging`), плюс функция
  «Marketing API Access Tier». Порог для полного уровня на странице назван дважды по-разному: в плашке сверху 500
  успешных вызовов Marketing API за 15 дней, в тексте ниже 1 500 с ошибками меньше 10%. Какой действует, проверяется в
  App Dashboard при подаче.
- **Ключ:** с правами `whatsapp_business_management` и `whatsapp_business_manage_events`. Подходит ключ из Embedded
  Signup (рекомендован), системного пользователя интеграции (SUAT), системного пользователя или пользователя.
- **Вход клиента:** Embedded Signup или Facebook Login for Business.
- **Набор данных (dataset):** `POST /{WABA_ID}/dataset` создаёт его, а если уже есть, возвращает существующий;
  `GET /{WABA_ID}/dataset` читает. Ответ: ID набора. Набор принадлежит клиенту. На одну Страницу один набор (FAQ).
- **Отправка:** `POST https://graph.facebook.com/{версия}/{DATASET_ID}/events` с ключом. В примерах версия `v16.0`.
- **Тело события** (`data` списком):
  - `event_name`: поддержаны `Purchase`, `LeadSubmitted`, `QualifiedLead`, `InitiateCheckout`, `AddToCart`,
    `ViewContent`, `OrderCreated`, `OrderShipped`, `OrderDelivered`, `OrderCanceled`, `OrderReturned`,
    `CartAbandoned`, `RatingProvided`, `ReviewProvided`;
  - `event_time`: UNIX-время;
  - `action_source`: `business_messaging`;
  - `messaging_channel`: `whatsapp`;
  - `user_data`: `whatsapp_business_account_id` и `ctwa_clid` из `referral`;
  - `custom_data`: `currency`, `value` (в примере `"USD"`, `123`; в каких единицах `value`, целых или дробных, на
    этой странице не сказано);
  - рядом с `data` поле `partner_agent` (имя партнёра).
- `ctwa_clid` назван **обязательным** для отправки события; без него (реклама в Статусе) событие по этой схеме не
  отправить.
- **Дубли Meta не убирает**: удалять повторы до отправки должен отправитель.
- События должны описывать только то, что случилось в переписке; покупка на сайте отправляется через Conversions API
  для сайта.
- Пример тела в документации синтаксически сломан (двойная вложенность `data`); опираемся на перечень полей, не на
  пример.

Для справки: есть «Automatic Events API» (Embedded Signup): Meta сама ищет в переписках из CTWA признаки заявки или
покупки и шлёт вебхук `automatic_events` с `event_name` (`LeadSubmitted` и др.) и `ctwa_clid`. Включается клиентом,
недоступен в ЕС, Великобритании и Японии. Для Казахстана ограничения не названы. Нам не нужен, пока бот сам знает, что
была заявка.

## 3. Реклама с переходом в WhatsApp: что нужно со стороны рекламы

- **Страница Facebook с привязанным номером WhatsApp** (вручную или через API проверки номера Страницы). Это условие
  стоит в разделе «Before you start».
- **Ключ Страницы** от человека, который может выполнять на Странице задачу ADVERTISE, и права приложения:
  `ads_management`, `pages_manage_ads`, `pages_read_engagement`, `pages_show_list`. Права `whatsapp_business_*` для
  самой рекламы в этом руководстве **не названы**; они нужны для приёма сообщений и для Conversions API (раздел 2).
- **Кампания:** `POST /act_{ad_account_id}/campaigns`, `objective` один из `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`,
  `OUTCOME_SALES`, `OUTCOME_TRAFFIC` (с кнопкой звонка только `OUTCOME_ENGAGEMENT`), `special_ad_categories`
  обязательно.
- **Группа объявлений:** `POST /act_{ad_account_id}/adsets` с `destination_type=WHATSAPP`, `billing_event=IMPRESSIONS`,
  `optimization_goal` по цели (для переписок `CONVERSATIONS`), бюджет, таргетинг и `promoted_object`:
  `page_id` **обязателен**, `whatsapp_phone_number` **необязателен** (номер, связанный с группой). Как Meta выбирает
  номер, если у Страницы их несколько и номер не передан, не сказано.
- **Креатив:** `object_story_spec.page_id`, `link_data` с `link: https://api.whatsapp.com/send` и
  `call_to_action: { type: WHATSAPP_MESSAGE, value: { app_destination: WHATSAPP } }`. Приветствие и заготовка
  сообщения задаются в `page_welcome_message` (по умолчанию «Hello! Can I get more info on this?»).
  Приветственную цепочку партнёра можно подставить через `asset_feed_spec.additional_data.partner_app_welcome_message_flow_id`
  (цепочки создаются `POST /{WABA_ID}/welcome_message_sequences`, право `whatsapp_business_management`).
- **Объявление:** `POST /act_{ad_account_id}/ads`, затем `status=ACTIVE`; Meta проверяет (`PENDING_REVIEW`).
- Примеры на версии `v25.0`, как и в README этой папки.

## 4. Окно бесплатного входа

Если человек написал из CTWA (или кнопки Страницы) с телефона (Android или iOS, не веб и не компьютер) и бизнес ответил
в течение 24 часов, ответ бесплатный и открывается окно на 72 часа, в котором любые сообщения бесплатны; 24-часовое окно
обслуживания при этом идёт отдельно.

## 5. Проверка подписи вебхука

Каждый POST от Meta несёт заголовок `X-Hub-Signature-256: sha256=<хэш>`. Хэш это HMAC-SHA256 от тела запроса с
секретом приложения (App Secret) в качестве ключа. Сервер считает свой хэш от сырого тела и сравнивает с частью после
`sha256=`; не совпало, значит запрос недействителен, ответ не 200. Верный запрос подтверждается ответом 200. При ошибке
Meta повторяет доставку сразу, а потом всё реже до 7 дней, после чего бросает; повторы получают все подписанные
приложения, поэтому дубли возможны и их надо отсеивать (по `messages[].id`). Пакет может содержать до 1 000 обновлений,
но пакетирование не гарантировано. Подтверждение адреса при настройке: GET с `hub.mode=subscribe`, `hub.verify_token`
(своя строка) и `hub.challenge`, в ответ 200 и значение `hub.challenge`.

## Вывод для атрибуции

- `referral.source_id` по справочнику Cloud API это ID объявления; по нему сообщение связывается с объявлением, а через
  Marketing API (`GET /{ad_id}?fields=adset_id,campaign_id`) с группой и кампанией. Это официальная, без посредников,
  связь.
- Надёжна она только для того сообщения, в котором `referral` пришёл: повторяется ли он дальше, не сказано, история
  вебхуков недоступна. Значит, сохранять при приёме и закреплять за перепиской.
- `source_type` надо проверять: при `post` ID, вероятно, не объявления.
- `ctwa_clid` отсутствует для рекламы в Статусе WhatsApp: атрибуция по `source_id` там есть, а отправка события в
  Conversions API нет.
