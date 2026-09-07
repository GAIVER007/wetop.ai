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

## Плюс обязательный документ

`inventory_breakdown.md` — разбор 88 номеров.
Шаблон: `templates/inventory-breakdown-template.md`.

**Без него DATA_MODEL.md не утверждается.**

## Чеклист получения

- [ ] inventory
- [ ] accommodation_types
- [ ] rate_plans
- [ ] rates_12_months
- [ ] restrictions
- [ ] future_reservations
- [ ] reservations_history_12_months
- [ ] services
- [ ] payment_methods
- [ ] channels
- [ ] blocks
- [ ] inventory_breakdown.md
