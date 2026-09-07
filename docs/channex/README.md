# docs/channex

| Файл | Источник (URL) | Дата скачивания | Версия | Примечание |
|---|---|---|---|---|
| `channel-api.md` | docs.channex.io — Welcome, Channel API (OpenAPI «Channex.io — Channels» 0.0.0) | 07.09.2026 (вставка владельца в чат) | 0.0.0 | Выжимка: все эндпоинты `/channels*`, пробы, дескрипторы адаптеров, коды ошибок, derived_option, known mappings. Это сторона Channex → OTA |

Статус: **частично**. Есть Channel API (подключение OTA к объекту в Channex).
**Нет** PMS Integration Guide — стороны PMS → Channex: properties, room types, rate plans,
ARI push, bookings/webhooks, acknowledge, certification tests. Без них код адаптера не пишется (AGENTS.md §5).

## Что нужно получить

- [ ] **PMS Integration Guide** `/guides/pms-integration-guide` — главное
- [ ] PMS API: properties, room_types, rate_plans, availability/restrictions (ARI), bookings, webhooks
- [ ] Certification tests `/api-v.1-documentation/pms-certification-tests`
- [x] Channel API — `channel-api.md`
- [ ] Property size limits, retention periods (ссылки в `channel-api.md` §1)
- [ ] Гайды по нашим каналам: Booking.com, Agoda, Expedia, Emerging Travel Group (Ostrovok)
- [ ] Каталог адаптеров `GET /channels/list` со staging — есть ли Trip.com, Hostelworld, Bronevik, OneTwoTrip (**Q-096**)
- [ ] Sandbox documentation + credentials
- [ ] Webhook spec / retry policy
- [ ] Ответ по Pull Future Reservations по каждому OTA (Q-032)

Запрос отправлен письмом `outbox/01-channex.md`.

**Что маппить (аудит 07.09.2026):** 5 категорий, 8 каналов, ID объектов известны —
`OBJECT.md` §4. Ценообразование по каналам реализовано **отдельным тарифом на канал**,
а не наценкой: ошибка маппинга тарифа уводит цены в OTA на 35%.
Переносить 209 будущих проживаний на 4 743 535 ₸, из них 96,5% не оплачено.
