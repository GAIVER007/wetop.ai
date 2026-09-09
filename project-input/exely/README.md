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

## Получено 08.09.2026

| Файл | Что внутри | Чего нет |
|---|---|---|
| `reservations_arrivals_2026-08.xlsx` (исходно «Заезды_01.08.2026_31.08.2026.xlsx», отчёт Exely «Заезды», лист `Report`) | **1044 строки** = заезды августа (совпадает с OBJECT.md); колонки: № брони (996 уникальных, 41 бронь с 2–4 проживаниями), Заказчик, ФИО гостей, Количество гостей (1040×1, 4×2), Номер комнаты (85 уникальных; не использованы 9, 27, 29, 70), Время заезда (дата+14:00), Категория (5), Баланс (сумма 4 957 500,77 = неоплаченный остаток из OBJECT.md §6), Валюта KZT, Теги (пусто), Комментарий гостя (500), Заметки (325), Статус («Заезд» 1031, «Опоздание» 13 — Q-097) | **даты выезда, ночей, источника/канала, суммы проживания, оплачено** — для загрузки и оборота Gate 2 не годится; нужен отчёт по бронированиям/проживаниям |

Содержит ПД (ФИО, комментарии). Не читать агентом; профиль — `npx tsx scripts/imports/src/exely/profile-xlsx.ts <файл>` (ПД маскирует).

## Получено 09.09.2026

| Папка | Что внутри | Как получено |
|---|---|---|
| `prices/price-calendar-2026-09-09.json` (+ `prices/README.md`) | Календарь цен и ограничений: 6 тарифов × 5 категорий × размещения, 366 дней с 09.09.2026, все 14 показателей Exely. ПД нет — читать агенту можно | Снимок внутреннего API страницы «Тарифы → Цены и ограничения» (только чтение). Импорт: `npx tsx scripts/imports/src/cli-import-price-calendar.ts`; сверка: `npx tsx scripts/reconciliation/src/cli-rates.ts` |

## Чеклист получения — состояние на 07.09.2026

- [x] inventory — 88 единиц, `audit-2026-09-07/inventory.md`
- [x] accommodation_types — 5 категорий
- [x] rate_plans — 6 тарифов
- [ ] **rates_12_months** — программно не выгружается, нужна кнопка «Экспорт в Excel»
- [x] restrictions — **пусто**, действующих ограничений нет
- [x] future_reservations — 209 проживаний на 4 743 535 ₸
- [~] reservations_history_12_months — снят август + июль, полные 12 месяцев не получены. 08.09.2026: получен отчёт «Заезды» за август (см. выше), но без дат выезда — **нужен отчёт с заездом, выездом, статусом, источником, суммой и оплатой** за 01.08–31.08 (лучше 12 мес.)
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
