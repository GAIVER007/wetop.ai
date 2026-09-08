# docs/exely — документация Exely

Скачано агентом 08.09.2026 по просьбе владельца («найди сам документацию»). Только публичные
страницы, без авторизации. Код интеграции с Exely пишется **только по этой папке** (AGENTS.md §5).

| Что | Где | Источник | Дата |
|---|---|---|---|
| Спецификация OpenAPI 3.0 «Exely Connect APIs» v1.0.0, **44 эндпоинта** | `openapi-spec.json` | `https://exely.com/dev-portal/openapi/spec.json` | 08.09.2026 |
| Портал разработчика: категории API, сценарии, авторизация, webhooks (28 страниц, текст) | `dev-portal/**/*.md` | `https://exely.com/dev-portal/docs/…` | 08.09.2026 |
| База знаний: Public API (брони), PMS Integration, ключ интеграции / FiscalConnector (ru) | `help/*.md` | `https://exely.com/help/kb350850/`, `kb283752/`, `ru/help/kb380807/` | 08.09.2026 |
| **Универсальный API Exely PMS 1.5.0** — PDF от Exely + извлечённый текст | `Opisanie-API-ExelyPMS-1.5.0.pdf`, `universal-pms-api-1.5.0.md` | владелец, вкладка «Интеграции» Exely | 08.09.2026 |
| Манифест обхода | `_manifest.json` | | |

## Два API Exely — какой для чего

| | Exely Connect (dev-portal, `openapi-spec.json`) | Универсальный API Exely PMS 1.5.0 (`universal-pms-api-1.5.0.md`) |
|---|---|---|
| Хост | `connect.hopenapi.com/api/pms`, `/api/content`, … | `connect.hopenapi.com/api/exelypms/v1/…` (Swagger: `/api/exelypms/swagger/ui/index`) |
| Авторизация | OAuth2 client credentials → Bearer, токен 15 мин; client_id/secret из «Подключения API» | заголовок **`X-API-KEY`** = **ключ интеграции** из «Управление отелем → Настройки → Интеграции» |
| Состояние 08.09.2026 | подключение создано, токен выдаётся, **шлюз отвечает 401** (ждём Exely) | ключ существует, **не проверен**; засвечен в чате 08.09 → перевыпустить |
| Брони | `GET …/reservations/search` (period, pageToken) + `GET …/reservations/{number}` | `GET /v1/bookings?state=&affectsPeriodFrom&To` → `{bookingNumbers[]}` + `GET /v1/bookings/{number}` (Booking, RoomStay, Customer, TotalPrice) |
| **История для Gate 2** | `daily-occupancy` (≤31 дней) | **`GET /v1/analytics/services?startDate=yyyyMMdd&endDate=&dateKind=1`** — начисления по дням пребывания (≤31 день): проживания, категории, суммы; `dateKind` 0 по выезду, 2 по созданию, 3 по модификации; `/cancelled` — отменённые; `/csv` — файлом |
| Платежи | invoices, process-payment | `GET /v1/analytics/payments?startDateTime=yyyyMMddHHmm&endDateTime=` |
| Номера | `GET …/rooms` | `GET /v1/rooms?roomTypeId=` → `{id, name, roomTypeId}` |
| Гости | search / profile / document | `/v1/guests…` — то же |
| Запись | check-in, payment, assign | то же — **в MVP не вызывать** (AGENTS §9) |

Обе версии описывают одни и те же сущности (Booking → RoomStay → Customer). План: пробовать
Универсальный API первым — он не требует активации шлюза; Exely Connect остаётся как основной,
когда Exely его включит. Код адаптера принимает оба через общий интерфейс.

## Что это даёт проекту (Q-088)

**Exely Connect** — единый шлюз API, хост `connect.hopenapi.com`. Авторизация **OAuth2 client
credentials**: гостиница создаёт в экстранете «API-подключение» (Connectivity Hub), получает
`client_id` и `client_secret`; `POST /auth/token` → `access_token` на **30 минут**, заголовок
`Authorization: Bearer …`. Соблюдать лимиты авторизации (dev-portal/connect/intro).

> Ключ на вкладке «Настройки → Интеграции» — это **«ключ интеграции»** для Exely Агента /
> FiscalConnector (help/kb380807), другой механизм. К Exely Connect он отношения не имеет,
> но его всё равно надо перевыпустить (засвечен 08.09.2026).

### Эндпоинты, нужные для миграции и сверки (PMS API v2, Analytics, Reservation API)

| Задача проекта | Эндпоинт | Сценарий |
|---|---|---|
| **История и будущие брони** (Slice 2, Gate 2) | `GET /api/pms/reservations/search?state=&startAffectPeriodDateTime=&endAffectPeriodDateTime=` + `pageToken` | `dev-portal/scenarios/webpms-api/pms-search-reservations.md` |
| Детали брони: проживания, гости, суммы, единица | `GET /v2/properties/{propertyId}/reservations/{number}` | `pms-get-reservation.md` |
| **Загрузка по дням** — контроль Gate 2 (2174/2728, 79,7%) | `GET /api/pms-analytics/v1/properties/{id}/daily-occupancy?startStayDate&endStayDate` (макс. 31 день; `otbDate` — снимок на дату) | `analytics-api/analytics-get-daily-occupancy.md` |
| Номерной фонд из API (сверка с импортом Slice 1) | `GET /v2/properties/{id}/rooms`, `GET /v2/properties/{id}/obtain-accommodation-inventory` | spec |
| Блокировки | `POST /v1/properties/{id}/inventories/search`, `GET …/inventories/blocks/{id}` | spec |
| Гости, документы | `GET /v2/properties/{id}/guests/search`, `…/guests/{pmsPersonId}`, `PUT …/personal-document` | spec (ПД! только production в РК) |
| Счета, платежи, возвраты | `GET …/reservations/{number}/invoices`, `POST …/room-stays/{id}/process-payment`, `process-refund` | `pms-save-payment.md` |
| Check-in / check-out, назначение единицы | `POST …/room-stays/{id}/check-in`, `check-out`, `PUT …/room-stays/{id}/room`, `assign-rooms` | spec — **только чтение до cutover (AGENTS §9)** |
| Брони с изменениями с даты (Booking Engine / CM) | `GET /v1/properties/{id}/bookings?lastModification=` + `continueToken` | `reservation-api/read-reservation-get-all-bookings.md`, help/kb350850 |
| События | Webhooks: типы, авторизация, обработка | `dev-portal/scenarios/webhooks/*.md` |
| Правила аннуляции, ранний/поздний | `GET /v1/properties/{id}/cancellation-rules`, `…/extra-stay-rules` | spec (закрывает Q-093, Q-014/015 по данным) |

Все методы записи (check-in, payment, assign-rooms) в MVP **не вызываются** — Exely production
только для чтения до отдельного разрешения на cutover.

## Чего здесь нет

- Тестовый контур: в результатах поиска упоминался `connect.test.hopenapi.com` — не проверен.
- ~~Инструкция «как создать API-подключение»~~ — скачана: `help/kb350838-how-to-create-api-connection-ru.md`
  (и `-en`). Путь: экстранет → «Настройки гостиницы» → «Подключения API» → «Создать подключение»;
  вкладка «Публичные API» — галочки нужных API; «Сохранить» → «Сохранить и открыть доступ»;
  client_id/client_secret генерируются автоматически. Лимит — 3 подключения на объект.
- Лимиты запросов (rate limits) — см. `dev-portal/connect/intro.md`, конкретные числа уточнить.
