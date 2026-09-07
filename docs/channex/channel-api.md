# Channex.io — Welcome + Channel API (выжимка)

**Источник:** docs.channex.io, страницы «Welcome» и «Channel API», вставлены владельцем
в чат 07.09.2026. Дата сохранения: 07.09.2026. Версия OpenAPI в документе: `0.0.0`
(`Channex.io — Channels`).

**Что это.** Channel API описывает, как **подключить OTA-канал к объекту в Channex**
и построить mapping «тариф Channex ↔ комната/тариф канала». Это сторона Channex → OTA.
Сторона **PMS → Channex** (property, room types, rate plans, ARI push, бронирования, webhooks,
acknowledge) описана в **PMS Integration Guide** — `/guides/pms-integration-guide` —
**в этой папке ещё нет** (см. README).

Формат ниже: все эндпоинты, поля, коды ошибок и правила из оригинала, без повторов
компонентных схем. Полный OpenAPI при кодировании адаптера скачать с docs.channex.io.

---

## 1. Общее

| Что | Значение |
|---|---|
| Production | `https://app.channex.io/api/v1` |
| Staging | `https://staging.channex.io/api/v1` |
| Регистрация staging | `https://staging.channex.io/` — даёт тестовый extranet: rates, rooms, ARI |
| API key | профиль пользователя `https://staging.channex.io/user_profile`; для начала один ключ на все properties |
| Аутентификация | заголовок **`user-api-key: <key>`** на каждом запросе |
| Формат | JSON:API: `{ data: { type, id, attributes, relationships } }`, списки — `{ data: [...], meta }` |
| Postman | `https://documenter.getpostman.com/view/681982/RztkPpne` — для игры на staging |
| Лимиты объекта | `/api-v.1-documentation/property-size-limits` — max rooms/rates на property |
| Retention | `/guides/channex-retention-periods` — удаление старых properties и отключённых каналов |
| PCI | `/guides/guide-to-pci` — если нужны карточные данные из Channex |
| Тестовые аккаунты OTA | Booking.com: `/guides/test-account-for-booking.com`; Airbnb: `/guides/test-accounts-for-airbnb` — реальные брони, изменения, отмены |
| Сертификация | тесты `/api-v.1-documentation/pms-certification-tests`, результат письмом на `support@channex.io` |
| Поддержка | `support@channex.io` |

Пагинация списков: `pagination[page]` (с 1), `pagination[limit]` ≤ 100 (выше — `400 Bad Request`).
`meta`: `page, limit, total, order_by, order_direction`.

Время в ответах: ISO 8601 **без смещения таймзоны** (`inserted_at`, `updated_at`).

### Коды ошибок (общие для всех эндпоинтов)

| HTTP | `errors.code` | Смысл |
|---|---|---|
| 400 | `bad_request` | запрос нельзя обработать в текущем состоянии; у probe-эндпоинтов — канал отверг учётные данные (`details` = ошибка канала) |
| 401 | `unauthorized` | нет/неверный `user-api-key` |
| 403 | `forbidden` | нет прав на действие |
| 404 | `resource_not_found` | ресурс не существует |
| 422 | `bad_request` + `details{field: [msg]}` | неверные аргументы; или `validation_error` + `details` — тело не прошло валидацию; у `mapping_details` — `{errors: <причина канала или null>}` |
| 503 | `service_unavailable` | backing service временно недоступен — **повторить позже** (retry, ADR-007) |

Форма ошибки: `{ "errors": { "code": "...", "title": "...", "details"?: {...} } }`.

---

## 2. Поток подключения канала (общий для почти всех)

1. **Дескриптор адаптера** — `GET /channels/adapter?code={code}`; каталог — `GET /channels/list`;
   коды каналов — `GET /channels/codes`.
2. **Собрать настройки подключения** — по полям `params` (обычно hotel ID / hotel code, иногда
   credentials или access token). Для части каналов доступные значения отдаёт сам канал:
   `POST /channels/connection_details` с учётными данными — пользователь выбирает property/contract.
3. **Проверить настройки** — `POST /channels/test_connection` `{channel, settings}` →
   `data: {success, errors}`. Соединение не создаётся. `success:false` — исправить и повторить.
4. **Прочитать обе стороны mapping** — сторона канала: `POST /channels/mapping_details`
   (то же тело); сторона Channex: `GET /room_types/options?filter[property_id]=` и
   `GET /rate_plans/options?filter[property_id]=&multi_occupancy=true`.
5. **Собрать mapping** — на каждый rate plan Channex: `{rate_plan_id, settings{...rate_params}}`
   с кодами комнаты/тарифа канала, occupancy, pricing type.
6. **Создать соединение** — `POST /channels`. Создаётся **выключенным**, данные не идут.
7. **Готовность и активация** — `POST /channels/{id}/check_readiness` (пустой список = готово),
   `POST /channels/{id}/activate` → full sync: availability, rates, restrictions уходят в канал,
   брони начинают приходить.

После запуска: `PUT /channels/{id}` (настройки/mapping; mapping удаляется `settings: null`),
`POST /channels/{id}/deactivate`, `DELETE /channels/{id}` (только деактивированный).

> **Каналы разные.** Шаги могут пропускаться (нечего маппить), меняться местами
> (connection_details раньше настроек) или заменяться (Airbnb — OAuth). Всегда читать
> гайд конкретного канала.

Гайды по каналам в документации: Agoda, Airbnb, Bed-and-Breakfast.it, **Booking.com**, Check24,
eDreams, **Emerging Travel Group (Ostrovok)**, **Expedia**, Hopper, Hotelbeds, HotelTonight, Lido,
Klook, Mr and Mrs Smith, Pitchup, Reconline, Roibos, VacanceSelect, World2Meet.

> ⚠ Для нашего объекта: в списке гайдов **нет Trip.com, Hostelworld, Bronevik, OneTwoTrip**.
> Список гайдов ≠ полный каталог адаптеров. Проверить через `GET /channels/list` на staging —
> **Q-096** в `QUESTIONS.md`. Trip.com даёт 20% заездов объекта.

---

## 3. Справочники адаптеров

### `GET /channels/codes` — коды каналов
`data: [{code, name}]`. 401.

### `GET /channels/list` — все поддерживаемые адаптеры
`data: [ChannelAdapter]`. 401.

### `GET /channels/adapter?code={code}` — один адаптер
`data: ChannelAdapter`. 400, 401.

**ChannelAdapter**

| Поле | Тип | Смысл |
|---|---|---|
| `code` | string | код адаптера |
| `title` | string | название канала |
| `params` | `{field: AdapterParam}` | поля формы подключения |
| `kind` | `ota` \| `meta` \| `cm` | OTA, метапоиск, channel manager |
| `actions` | string[] | доп. действия; известно: `load_future_reservations` |
| `mapping_mode` | `room_rate_multioccupancy` \| `direct` \| `listing` \| `tree` \| null | как маппятся комнаты/тарифы |
| `message_support` | boolean | поддержка переписки с гостем |
| `property_mapping` | `single` \| `multiple` \| null | одно соединение — один или несколько объектов |
| `rate_params` | `{field: AdapterParam}` \| null | поля формы mapping тарифа |

**AdapterParam**: `position` (int ≥0, порядок в форме), `type`
(`string|boolean|integer|number|select|switch|password|hidden|slug`), `title?`, `default?`
(тип по `type`), `options?` (значения для `select`/`switch`), `rules?[]` —
`{apply: "hidden", when: bool|string, influence_field, with_value}`: пока другое поле
`influence_field` равно `when`, к полю применяется `apply` и подставляется `with_value`.

---

## 4. Пробы до создания соединения

Тело у всех трёх одинаковое — **ChannelSettingsProbeRequest**:
`{ "channel": "<adapter code>", "settings": { ...ключи из params адаптера, напр. hotel_id для Booking.com } }`.

### `POST /channels/test_connection`
`data: {success: boolean, errors: string | string[] | object | null}`.
Отвергнутые учётные данные и недоступный канал — это `success:false` в теле, **не** HTTP-ошибка.
Каналы, идентифицирующие объект одним кодом, требуют, чтобы код был свободен: если другое
соединение его уже использует — тест не пройдёт. 401, 422.

### `POST /channels/connection_details`
Только **Booking.com, Expedia, Agoda**: валюта объекта; Booking.com дополнительно — состояние
каждого типа обмена (reservations, rates & availability, guest reviews, content, reporting).
`data: {type: "connection_details", attributes: <объект канала> | null}`. Запрашивается у канала
на каждый вызов. 400 (канал отверг), 401, 422.

### `POST /channels/mapping_details`
Комнаты и тарифы, которые канал показывает для данных учётных данных. Форма ответа —
**определяется каналом**; Airbnb отдаёт listings; канал без mapping — `{}`.
`data: <object>`. 400, 401, 404, 422 (InvalidArguments или `{errors: причина|null}`), 503.

---

## 5. CRUD соединений

### Объект **Channel** (attributes)

| Поле | Тип | Смысл |
|---|---|---|
| `id` | uuid | |
| `title` | string | название соединения |
| `channel` | string | код адаптера |
| `currency` | ISO 4217 \| null | валюта соединения |
| `is_active` | boolean, **read-only** | менять только `activate`/`deactivate` |
| `settings` | object | настройки подключения: ключи из `params` + необязательный `derived_option` |
| `rate_plans` | `[{id, rate_plan_id, settings}]` | mapping тарифов; `settings` — ключи из `rate_params` + `derived_option?` |
| `properties` | uuid[] | подключённые объекты; при `property_mapping = single` — ровно 1 |
| `actions` | string[] | вызываются `POST /channels/{id}/execute/{action}`; известно `load_future_reservations` |
| `expected_removal_date` | date \| null | дата запланированного удаления (после deactivate) |
| `inserted_at`, `updated_at` | ISO 8601 без tz | |
| `status` | `active|pending|temporal_error|permanent_error` | **только** для Google Hotel ARI |

**relationships:** `group {data:{id,type:"group"}}`, `properties {data:[{id,type:"property"}]}`;
в `GET /channels/{id}` дополнительно `known_mappings`.

**derived_option** (на уровне соединения и/или отдельного mapping):
`{ "<restriction>": [ ["<rule>", "<arg>"], ... ] }`, rule ∈ `increase_by_amount | increase_by_percent |
decrease_by_amount | decrease_by_percent`, arg — десятичная строка, напр. `["increase_by_percent","5.00"]`.
Шаги применяются слева направо к значению маппленного тарифа при push в канал. Уровень mapping
переопределяет уровень соединения **по каждому restriction отдельно**. Вступает в силу при
создании/обновлении mapping.

> Для нашего объекта: сейчас «+35% для OTA» реализован отдельным тарифом (OBJECT.md §3).
> `derived_option` — альтернатива (один базовый тариф + правило на канал). Выбор — решение
> владельца перед маппингом, см. CUTOVER.md «правильный тариф на канал».

**KnownMapping** (`GET /channels/{id}` → `relationships.known_mappings.data[]`):
`{id, type:"known_mapping", attributes:{id, type: auto|manual, rate_plan_code, room_type_code,
rate_plan_id, room_type_id}}` — запомненная связь «тариф+комната канала ↔ rate plan+room type
объекта». Используется для маппинга **входящих броней**; собирается автоматически для каналов
с derived rates и при разборе unmapped-броней.

### `GET /channels` — список
Фильтры: `filter[property_id]`, `filter[room_type_id]`, `filter[group_id]`, `filter[channel]`,
`filter[title]` (точное), `filter[currency]`, `filter[is_active]`. Сортировка: `order[title]`
(по умолчанию asc), `order[inserted_at]`. Пагинация — см. §1. Область — properties/groups
пользователя. 401, 403, 503.

### `GET /channels/options` — лёгкий список
`data: [{id, type:"channel", attributes:{id, title, channel}}]`. 401.

### `GET /channels/{id}` — одно соединение (с `known_mappings`)
401, 403, 404, 503.

### `POST /channels` — создать → 201
Тело: `{ "channel": ChannelCreateInput }`:

| Поле | Обяз. | Смысл |
|---|---|---|
| `channel` | да | код адаптера |
| `group_id` | да | uuid группы; у пользователя должен быть доступ к группе или к одному из объектов |
| `title` | нет | генерируется из названий канала и объекта |
| `properties` | — | uuid[]; при `single` — 1 |
| `currency` | нет | если канал сообщает свою валюту — она побеждает |
| `is_active` | — | **не действует**: соединение всегда создаётся выключенным |
| `settings` | да | ключи из `params` + `derived_option?` |
| `rate_plans` | нет | `[{rate_plan_id, settings}]`; можно добавить позже через PUT |

Каналы с одним кодом объекта — только одно соединение на код. Known mappings для каналов
с derived rates записываются автоматически. 401, 422 (InvalidArguments \| ValidationError), 503.

### `PUT /channels/{id}` — обновить
Тело: `{ "channel": ChannelUpdateInput }`: `channel` (обязателен, **менять нельзя**),
`group_id?`, `title?`, `properties?` (если опущено — сохраняются; объект с маппленными тарифами
удалить нельзя), `currency?` (администраторам), `settings?` (**заменяются целиком**),
`rate_plans?` (**заменяют набор целиком**: отсутствующий mapping удаляется, `settings: null`
тоже удаляет; если опущено — сохраняются).
Обновление **активного** соединения запускает full sync в фоне. Изменения записываются как
channel events (ресурс Channel Events). 401, 403, 404, 422, 503.

### `DELETE /channels/{id}`
Только деактивированное. **Необратимо**: соединение, mappings объектов и тарифов, channel events
удаляются. Брони, полученные через соединение, **сохраняются**, но теряют ссылку на него.
Ответ `{meta:{message}}`. 401, 403, 404, 422, 503.

### `POST /channels/{id}/activate`
Старт обмена: full sync (availability, rates, restrictions), очистка `expected_removal_date`;
для Airbnb/Booking.com/Expedia начинается сбор отзывов. Нужен ≥1 объект и ≥1 маппленный тариф
(если канал требует mapping). Повторная активация — успех без изменений. `{meta:{message}}`.
401, 403, 404, 422, 503.

### `POST /channels/{id}/deactivate`
Обмен останавливается, удаление планируется **через 30 дней** (`expected_removal_date`);
sync в канал не отправляется; mappings сохраняются. Соединение на несколько объектов и Airbnb
требуют сначала удалить mappings тарифов. Повторная деактивация — успех. `{meta:{message}}`.
401, 403, 404, 422, 503.

### `POST /channels/{id}/check_readiness`
`{ data: [ {id, type:"entity", entity (напр. "Channel"), relation (напр. "Mapping"),
error_code (напр. "required")} ], meta:{message} }`. Пустой `data` — готово. 401, 403, 404, 503.

---

## 6. Что из этого важно нашему проекту (для DATA_MODEL §7 и CUTOVER)

- `ChannelMapping` в модели должен хранить: `channel` (код адаптера), Channex `channel_id`
  (uuid соединения), `group_id`, `properties[]`, `settings` (в т.ч. hotel_id канала —
  OBJECT.md §4 знает ID объекта в 8 каналах), `rate_plans[]` mapping с `rate_plan_id` Channex.
- `is_active` read-only → в нашей модели статус соединения — производный от Channex, не поле ввода.
- 503 и `success:false` — разные вещи: первое — retry через очередь (ADR-007), второе — ошибка данных.
- Деактивация = таймер 30 дней на удаление. Для rollback в CUTOVER это важно: деактивированное
  соединение живёт месяц, потом исчезает вместе с channel events.
- `load_future_reservations` — то самое «Pull Future Reservations» из Q-032/CUTOVER: доступно
  только у адаптеров, где действие есть в `actions`. Проверять по `GET /channels/list`.
- В `docs/channex/` **нет** PMS Integration Guide, спецификаций properties/room_types/rate_plans,
  ARI (availability/restrictions), bookings/webhooks, certification tests — без них код адаптера
  PMS → Channex писать нельзя (AGENTS.md §5).
