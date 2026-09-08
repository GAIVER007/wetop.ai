# docs/channex

| Файл | Источник (URL) | Дата скачивания | Версия | Примечание |
|---|---|---|---|---|
| `channel-api.md` | docs.channex.io — Welcome, Channel API (OpenAPI «Channex.io — Channels» 0.0.0) | 07.09.2026 (вставка владельца в чат) | 0.0.0 | Выжимка: все эндпоинты `/channels*`, пробы, дескрипторы адаптеров, коды ошибок, derived_option, known mappings. Это сторона Channex → OTA |

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
