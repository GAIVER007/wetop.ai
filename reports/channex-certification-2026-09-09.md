# Протокол сертификации Channex — 09.09.2026 (staging)

Источник требований: `docs/channex/site/api-v.1-documentation/pms-certification-tests.md`. Все сценарии выполнены
**действиями в интерфейсе PMS** (браузерный тест `tests/e2e/channex-certification.spec.ts` повторяет действия
администратора на экранах «Цены и ограничения», «Новая бронь», «Каналы»); скриптов, бьющих в API Channex, нет.
Объект staging: `60fc6ef0-5cdc-4f53-a2ca-3f477964cb2a` (Luxx Aparts, KZT, 5 категорий, тариф ОТА на каждую).

## Как устроена интеграция (pre-flight)

- Изменение цены/ограничения на экране → `POST /rates/bulk` (`apps/api/src/rates/rates.service.ts`) → одна транзакция →
  `OutboxAriPublisher.ratesChanged` (`apps/api/src/channels/ari-publisher.ts`) → строка в очереди `channel_outbox`.
- Бронь создана/изменена/отменена (стойка или OTA) → `ReservationsService.publish` / `InboundBookingsService` →
  `reservationChanged` → пересчёт доступности категории (единицы − блокировки − проданные проживания) → очередь.
- Воркер `OutboxWorker` (`apps/api/src/channels/outbox.worker.ts`): все PENDING одного вида → **один** вызов
  `POST /availability` или `POST /restrictions`; не чаще раза в 6 с на эндпоинт (лимит 10/мин); 429/5xx →
  экспоненциальная пауза (60 с × 2ⁿ), после 6 попыток — FAILED с причиной. Полный sync — только вручную (кнопка) или раз в сутки.
- Приём броней: webhook с общим секретом или `POST /channels/channex/pull` (лента ревизий) → `external_events`
  (UNIQUE provider+revision) → бронь → ack. Данные карт не сохраняются.

## Сценарии и ID задач Channex

| Сценарий | task id | Отправлено |
|---|---|---|
| 1. Full Sync, 500 дней, 2 вызова (кнопка «Полная выгрузка») | `84784a0f-9343-4fc7-96c0-c5874648dae4` (availability), `4430e3f6-d3c4-4f27-9c9e-83ac1dd05815` (restrictions) | 2026-09-09 |
| 2. Single Date Update for Single Rate | `92c91bb4-ef86-4340-a570-ffb7e0ce0330` | 2026-09-09 15:03:24 UTC |
| 3. Single Date Update for Multiple Rates | `ffd432f9-8aaa-470d-a2de-7f210407c027` | 2026-09-09 15:03:34 UTC |
| 4. Multiple Date Update for Multiple Rates | `a79cbdb0-ab13-48fc-a23b-98ff41ba1a03` | 2026-09-09 15:03:44 UTC |
| 5. Min Stay Update | `7080faad-3369-4e61-be63-096d28125775` | 2026-09-09 15:03:54 UTC |
| 6. Stop Sell Update | `d49ff230-fbb5-461a-a93f-abad7c288271` | 2026-09-09 15:04:07 UTC |
| 7. Multiple Restrictions Update | `d86b9f35-d70b-4841-9d1a-74ee725a5bdc` | 2026-09-09 15:04:16 UTC |
| 8. Half-year Update | `f9865a8b-e31d-4026-bd03-376fa21845e9` | 2026-09-09 15:04:26 UTC |
| 9. Single Date Availability Update (booking created in PMS UI) | `79d88ac2-7ba1-4667-b733-07bf0c6760bc` | 2026-09-09 15:04:40 UTC |
| 10. Availability Update (booking cancelled in PMS UI) | `82193ba5-cc56-48f2-9cee-d55f4ed2e7b7` | 2026-09-09 15:04:53 UTC |
| 11. Booking receiving: бронь `OFL-E2E-MTU18XN3` создана в staging (Booking CRS), получена через ленту ревизий, изменена, отменена; каждая ревизия подтверждена (ack) | ревизии `4675330b…`, `0e769e82…`, `e327957e…` | 2026-09-09 |

Адаптация под наш объект: вместо Twin/Double использованы «Одноместная комната с окном» и «Двухместная комната»
одного тарифа «Тариф для ОТА +35%»; в сценариях 3–8 «несколько тарифов» = несколько rate plan Channex (по одному
на категорию), все изменения одного сценария — в одном сообщении. Скриншоты: `reports/screenshots/channex-*.png`.

## 12. Rate limits
Да. Очередь и троттлинг 6 с на эндпоинт; backoff на 429; полный sync — 2 вызова на объект.

## 13. Update logic
Да, только изменения (дельты) по событиям PMS; полный sync — по кнопке или ночью раз в сутки.

## 14. Extra notes
- Min Stay: поддерживаем один `min_stay`, отправляем одинаково в `min_stay_arrival` и `min_stay_through`.
- Поддерживаем Stop Sell, CTA, CTD, Max Stay. Не поддерживаем: max_sell, max_availability, availability_offset.
- Несколько категорий — да (5); несколько тарифов на категорию — модель поддерживает, в Channex создаётся один тариф ОТА на категорию (решение владельца, Q-100).
- Данные карт **не нужны** и не сохраняются; PCI-сертификации нет.

## Что дальше
Форму `https://forms.gle/xA8F3eSYBPBd8apYA` и заявку на созвон отправляет владелец. После созвона — production-доступ (Gate 9, CUTOVER.md).

## Дополнение 10.09.2026 — webhook живьём

Webhook объекта зарегистрирован в Channex staging (адрес туннеля `https://<tunnel>/channels/channex/webhook`, заголовок
`x-channex-webhook-secret`, `send_data` вкл., события `*`). Тестовое сообщение из UI Channex: PMS ответила 200.
Бронь `OFL-WH-MTVAU2KQ` (Booking CRS, 2026-09-22 → 2026-09-24, «Общая женская») создана 09:02:29 UTC; событие
`booking_new` (ревизия `7313d2a5-1a49-47ee-8d3c-128b5796c3ef`) получено PMS в 09:02:40, обработано 09:02:48 (бронь создана,
ревизия подтверждена ack); событие `ari` получено 09:02:53. Периодический опрос ленты в это окно не запускался.
Обработчик отвечает Channex сразу и обрабатывает ревизии в очереди; при недоступности webhook брони добирает опрос ленты каждые 5 минут.
