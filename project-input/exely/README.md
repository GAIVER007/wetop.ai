# project-input/exely

Реальные выгрузки объекта из Exely.

> **Содержимое этой папки не коммитится в Git** (PII, SECURITY.md §4).
> В репозитории остаётся только этот README.

Шаблоны заголовков — `templates/exely-exports/`.

## Обязательные файлы

| Файл | Колонки |
|---|---|
| `inventory.xlsx` | building, floor, room_number, room_name, accommodation_type, capacity, dorm_yes_no, bed_count, active, housekeeping_status |
| `accommodation_types.xlsx` | type_code, type_name, capacity, number_of_rooms, number_of_beds, sell_mode (ROOM / BED / WHOLE_DORM) |
| `rate_plans.xlsx` | rate_plan_code, name, meal_plan, cancellation_policy, accommodation_type, base_occupancy, conditions |
| `rates_12_months.xlsx` | date, accommodation_type, rate_plan, occupancy, price, currency |
| `restrictions.xlsx` | date_from, date_to, accommodation_type, rate_plan, min_stay, max_stay, stop_sell, closed_to_arrival, closed_to_departure |
| `future_reservations.xlsx` | exely_reservation_id, external_reservation_id, channel, booking_date, status, guest, citizenship, arrival, departure, accommodation_type, physical_room, beds, adults, children, total, paid, balance, currency, comments |
| `reservations_history_12_months.xlsx` | та же структура |
| `services.xlsx` | service_code, name_ru, name_kz, price, currency, tax, active |
| `payment_methods.xlsx` | например: Cash KZT, Card, Kaspi, Bank transfer, OTA prepaid |
| `channels.xlsx` | channel_name, property_id, account_id, average_bookings_month, future_bookings, current_connectivity_provider, notes |
| `blocks.xlsx` | блокировки номерного фонда |

## Разбор номерного фонда

Закрыт аудитом: **88 = 16 номеров + 72 койки**, см. `OBJECT.md` §2.
Физическая планировка не нужна: по ADR-013 (07.09.2026) каждая единица — отдельная ячейка.

> Табличные файлы (`*.xlsx`, `*.csv`) в этой папке закрыты от чтения агентом
> (`.claude/settings.json`). Агент работает с ними только через скрипты импорта,
> которые не выводят персональные данные.

## Чеклист получения — состояние на 07.09.2026

- [x] inventory — 88 единиц, `audit-2026-09-07/inventory.md`
- [x] accommodation_types — 5 категорий
- [x] rate_plans — 6 тарифов
- [ ] **rates_12_months** — программно не выгружается, нужна кнопка «Экспорт в Excel»
- [x] restrictions — **пусто**, действующих ограничений нет
- [x] future_reservations — 209 проживаний на 4 743 535 ₸
- [~] reservations_history_12_months — снят август + июль, полные 12 месяцев не получены
- [x] services — 9 услуг
- [x] payment_methods — 9 способов
- [x] channels — 8 каналов с ID
- [x] blocks — **пусто**, 0 блокировок
- [ ] **Отчёт по отменам за 01–31.08.2026**
- [x] ~~Физическая планировка~~ — не требуется: Q-080 закрыт вариантом А (ADR-013)

Аудит сведён в [OBJECT.md](../../OBJECT.md) и [FINDINGS.md](../../FINDINGS.md).

> Реальные выгрузки отличаются от эталонных заголовков в `templates/exely-exports/`:
> данные сняты из внутренних структур Exely, а не через «Экспорт в XLSX».
> Под шаблон не подгонялись, как требует ТЗ п. 2.2.
