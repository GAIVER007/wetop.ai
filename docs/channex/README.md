# docs/channex

| Файл | Источник (URL) | Дата скачивания | Версия | Примечание |
|---|---|---|---|---|
| `channel-api.md` | docs.channex.io — Welcome, Channel API (OpenAPI «Channex.io — Channels» 0.0.0) | 07.09.2026 (вставка владельца в чат) | 0.0.0 | Выжимка: все эндпоинты `/channels*`, пробы, дескрипторы адаптеров, коды ошибок, derived_option, known mappings. Это сторона Channex → OTA |

| `how-channex-works-for-us.md` | объяснение для владельца: три потока (маппинг, ARI наружу, брони внутрь), что Channex делает сам, порядок Slice 4 | 08.09.2026 | — | по `pms-integration-guide.md` и API-справочникам |
| `site/**/*.md` | https://docs.channex.io/ — все 112 страниц из `llms.txt`, markdown-версии (`.md`) | 07.09.2026, `curl`, разрешение владельца («вот тут вся документация») | по состоянию сайта на 07.09.2026 | Полная документация: PMS Integration Guide, API Reference, Properties/Room Types/Rate Plans, ARI, Webhooks, Bookings, Channel API, Certification Tests, гайды по каналам. Манифест — `site/_manifest.json`, индекс — `llms.txt` |

Статус: **получена полностью** (07.09.2026). Код адаптера пишется только по `site/` (AGENTS.md §5).
Ключевые страницы для PMS → Channex: `site/guides/pms-integration-guide.md`,
`site/api-v.1-documentation/{api-reference,hotels-collection,room-types-collection,rate-plans-collection,ari,webhook-collection,bookings-collection,pms-certification-tests}.md`.

## Что нужно получить

- [x] PMS Integration Guide — `site/guides/pms-integration-guide.md`
- [x] PMS API: properties, room_types, rate_plans, ARI, bookings, webhooks — `site/api-v.1-documentation/`
- [x] Certification tests — `site/api-v.1-documentation/pms-certification-tests.md`
- [x] Channel API — `channel-api.md` (выжимка) и `site/api-v.1-documentation/channel-api.md` (оригинал)
- [x] Property size limits, retention periods — `site/api-v.1-documentation/property-size-limits.md`, `site/guides/channex-retention-periods.md`
- [x] Гайды по нашим каналам: Booking.com, Agoda, Expedia, Ostrovok (`site/channel-api-examples/`), **Trip.com и Hostelworld** (`site/channel-mapping-guides/ctrip-trip.com.md`, `hostelworld.md`)
- [~] **Q-096**: Bronevik и OneTwoTrip в документации Channex **не упоминаются ни разу** — адаптеров, судя по документации, нет. Подтвердить у Channex (письмо, вопрос 10) и по `GET /channels/list` на staging
- [ ] Sandbox credentials (регистрация владельца на staging, ключ в `.env`)
- [ ] Sandbox documentation + credentials
- [ ] Webhook spec / retry policy
- [ ] Ответ по Pull Future Reservations по каждому OTA (Q-032)

Запрос отправлен письмом `outbox/01-channex.md`.

**Что маппить (аудит 07.09.2026):** 5 категорий, 8 каналов, ID объектов известны —
`OBJECT.md` §4. Ценообразование по каналам реализовано **отдельным тарифом на канал**,
а не наценкой: ошибка маппинга тарифа уводит цены в OTA на 35%.
Переносить 209 будущих проживаний на 4 743 535 ₸, из них 96,5% не оплачено.

## Чтение цен и ограничений назад (сверка в обе стороны)

Источник — `site/api-v.1-documentation/ari.md` → «Get Availability Or Restrictions Per Rate Plan»
(строки 9–47: запрос, 142–152: Restriction Object). Мы публикуем цены и ограничения через
`POST /restrictions` (integer minor units, `min_stay_arrival`/`min_stay_through`, `max_stay`, `stop_sell`,
CTA/CTD) и обязаны уметь прочитать назад ровно то, что канал видит.

| Что | Где |
|---|---|
| Клиент | `packages/integrations/src/channex/client.ts` → `ChannexClient.getRestrictions(propertyId, from, to, ratePlanIds?, restrictions?)` |
| Тип клетки | `ChannexRestrictionCell`, имена — `ChannexRestrictionName` (11 значений из ari.md; `availability_offset`, `max_availability` — только чтение) |
| Цена → тиыны | `channexDecimalToMinor("14000.00") = 1400000n` — без float (ADR-008); дубликат логики `decimalToMinor` из `apps/api/src/channels/inbound.service.ts`, потому что скрипты не импортируют apps/api |
| Тест | `packages/integrations/src/channex/client.test.ts` → «ChannexClient.getRestrictions», фикстура по ari.md + живому ответу `tests/fixtures/channex/readback-restrictions-2026-09-09.json` |
| Скрипт сверки | `npx tsx scripts/reconciliation/src/cli-channex-rates.ts [дней=14]` → `reports/channex-rates-YYYY-MM-DD.md`, код выхода 1 при любом расхождении; работает только на staging (`CHANNEX_API_BASE_URL` без `staging` → отказ) |

Запрос по документации: `GET /restrictions?filter[property_id]=…&filter[date][gte]=…&filter[date][lte]=…&filter[restrictions]=rate,min_stay_arrival,stop_sell,closed_to_arrival,closed_to_departure`
— все три аргумента обязательны, без `restrictions` — 400 «restrictions is required». Ответ:
`{ data: { <rate_plan_id>: { "YYYY-MM-DD": { <restriction>: <value> } } } }`, только запрошенные ключи.
**Фильтра по тарифу в документации нет** — `ratePlanIds` сужают ответ уже на нашей стороне.

Что видно на живом staging и чего нет в документации (проверено 09–11.09.2026):

- `rate` приходит строкой с двумя знаками (`"14000.00"`), хотя отправляем integer minor units (`1400000`);
- к каждой дате добавлен `unavailable_reasons: []` — в типе он есть как необязательный, в сверке не участвует;
- `stop_sell` равен `true` везде, где остаток по тарифу 0 (`availability: 0`), даже если мы stop sell не ставили.
  Скрипт считает такие клетки отдельно («закрыто каналом при нулевом остатке»), не как расхождение:
  сам остаток сверяет `cli-channex-ari.ts`.

Первая сверка 11.09.2026 (`reports/channex-rates-2026-09-11*.md`):

- 14 дней: 70 клеток, 0 расхождений по цене, min_stay, max_stay, CTA/CTD и stop_sell; 18 клеток закрыты каналом по нулевому остатку;
- 365 дней **до** полной выгрузки 10:05 UTC: 980 расхождений на двух тарифах (одноместная с окном, двухместная) с 01.11.2026 —
  в Channex остались значения сертификационных сценариев 10.09 (цены 241.00/333.00/432.00, min stay 2–3, max stay 4, CTA),
  хотя календарь PMS был восстановлен из снимка Exely; скрипт это поймал (`…-365d-before-sync.md`, код выхода 1);
- 365 дней **после** полной выгрузки: 1825 клеток, 0 расхождений (`…-365d.md`). Вывод: после любых тестовых правок
  в Channex нужна полная выгрузка, а сверка назад — способ это проверить.
