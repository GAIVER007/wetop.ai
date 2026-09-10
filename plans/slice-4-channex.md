# Slice 4 — Channex (план, 09.09.2026)

Только по `docs/channex/site/` (AGENTS.md §5). Код Channex — `packages/integrations/src/channex` (ADR-004);
оркестрация синхронизации — `apps/api/src/channels` через `@pms/integrations`; домен про Channex не знает.
Sandbox = `https://staging.channex.io/api/v1`, ключ `CHANNEX_API_KEY` из `.env` (вписан владельцем 08.09).

## Шаги

| # | Что | Доказательство |
|---|---|---|
| 4.1 ✅ | Клиент: `user-api-key`, JSON:API, пагинация, ошибки, 429 → пауза 1 мин, 5xx → backoff | unit на примерах документации |
| 4.2 ✅ | Объект, 5 категорий, тарифы на staging; `ChannelMapping` в БД (DATA_MODEL §7) | ответы sandbox в `tests/fixtures/channex/`, `channel_mappings` заполнена |
| 4.3 ✅ | ARI: доступность по категориям (свободные ячейки на ночь) и цены/ограничения из `daily_rates`; full sync = 2 вызова на объект (лимит 10/мин на эндпоинт) | staging показывает наши цифры; скриншот |
| 4.4 ✅ | Webhook → `ExternalEvent` (UNIQUE provider+event) → Booking Revision Feed → бронь → acknowledge; повтор webhook не даёт дубль | integration-тест |
| 4.5 | Сертификационные сценарии `pms-certification-tests.md` | протокол |

## Умолчания, принятые до ответа владельца (легко поменять)

- **В Channex создаётся только то, что продаётся в OTA:** 5 категорий и один тариф на категорию —
  «Тариф для ОТА +35%» (`exely-10158310`, KZT) как `manual`, `per_room`, primary occupancy = вместимость.
  Базовый тариф (сайт/PMS) и тарифы Островка (0 продаж, Q-082) в Channex не создаются, пока владелец не решит.
  Это соответствует факту объекта «отдельный тариф на канал», а не `derived_option` (Q-100).
- **Dorm:** `room_kind = dorm`, `count_of_rooms` = число коек категории (36), `capacity` = коек в комнате (18, OBJECT.md).
- **Доступность категории на ночь** = активные ячейки категории − занятые (назначения проживаний не CANCELLED/NO_SHOW)
  − заблокированные. Считает домен (`availability`), Channex получает число.
- **Входящая OTA-бронь** создаётся **без назначения ячейки** (вариант «в» Q-094) — самое безопасное умолчание:
  ничего не выбирает за администратора; ячейка назначается на карточке. Как только владелец ответит Q-094 — правило меняется в одном месте.
- **Bronevik и OneTwoTrip** (Q-096): адаптеров нет — не маппим.
- Очередь ARI: пока без Redis — синхронный push из команд + полный ночной sync скриптом; BullMQ (ADR-011) когда появится Redis.

## Состояние 09.09.2026

Весь код 4.1–4.4 написан и покрыт тестами на фальшивках и примерах документации (`apps/api/src/channels`,
`packages/integrations/src/channex`). **Живой прогон 09.09.2026 (ключ вписан владельцем):** setup → sync → сверка diff 0 → тестовая бронь через Booking CRS API
(`booking_crs` установлен на объект staging) → pull: new / modified / cancelled. Объект staging: `60fc6ef0-5cdc-4f53-a2ca-3f477964cb2a`.
Дальше: 4.5 сценарии `pms-certification-tests.md`, кнопки sync/pull на стойке, webhook при появлении публичного URL.

## Что нужно от владельца

«Ок» на умолчания выше или поправки; ответы Q-094, Q-100, Q-101; Redis для dev (или разрешение на Upstash).


## Webhook (добавлено 09.09.2026)

Переменные `.env` (вписывает владелец): `CHANNEX_WEBHOOK_SECRET` — секрет заголовка `x-channex-webhook-secret`
(любая длинная строка, та же в настройках webhook Channex); `PUBLIC_API_URL` — публичный https-адрес API
(в dev — туннель `npx localtunnel --port 3001`, адрес меняется при перезапуске; в production — хостинг, Q-070).
Кнопки на `/channels`: «Зарегистрировать webhook» (один webhook на объект, события `booking`, `send_data` вкл.;
повтор обновляет адрес) и «Проверить webhook» (Channex шлёт пробный POST и возвращает ответ PMS: 200/400 — адрес
доступен и секрет принят, 401 — секрет не совпал). Обработчик отвечает сразу, ревизии обрабатывает в очереди; что не
дошло — доберёт «Забрать брони» (лента ревизий) и **периодический опрос ленты** каждые 5 минут (`CHANNEX_PULL_INTERVAL_MS`,
выключить `CHANNEX_PULL=off`; в тестах выключен). Диагностика без ПД: `cli-db-activity.ts`, `cli-webhook-check.ts`, `cli-channex-feed.ts`;
тестовая бронь на staging: `cli-channex-test-booking.ts` (только staging).
