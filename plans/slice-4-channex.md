# Slice 4 — Channex (план, 09.09.2026)

Только по `docs/channex/site/` (AGENTS.md §5). Код Channex — `packages/integrations/src/channex` (ADR-004);
оркестрация синхронизации — `apps/api/src/channels` через `@pms/integrations`; домен про Channex не знает.
Sandbox = `https://staging.channex.io/api/v1`, ключ `CHANNEX_API_KEY` из `.env` (вписан владельцем 08.09).

## Шаги

| # | Что | Доказательство |
|---|---|---|
| 4.1 ✅ | Клиент: `user-api-key`, JSON:API, пагинация, ошибки, 429 → пауза 1 мин, 5xx → backoff | unit на примерах документации |
| 4.2 🟡 код | Объект, 5 категорий, тарифы на staging; `ChannelMapping` в БД (DATA_MODEL §7) | ответы sandbox в `tests/fixtures/channex/`, `channel_mappings` заполнена |
| 4.3 🟡 код | ARI: доступность по категориям (свободные ячейки на ночь) и цены/ограничения из `daily_rates`; full sync = 2 вызова на объект (лимит 10/мин на эндпоинт) | staging показывает наши цифры; скриншот |
| 4.4 🟡 код | Webhook → `ExternalEvent` (UNIQUE provider+event) → Booking Revision Feed → бронь → acknowledge; повтор webhook не даёт дубль | integration-тест |
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
`packages/integrations/src/channex`). Живой staging не запускался: **`CHANNEX_API_KEY` в `.env` пуст**. Как только ключ
вписан: `POST /channels/channex/setup` → `POST /channels/channex/sync` → тестовая бронь в staging → `POST /channels/channex/pull`.

## Что нужно от владельца

«Ок» на умолчания выше или поправки; ответы Q-094, Q-100, Q-101; Redis для dev (или разрешение на Upstash).
