# DATA MODEL

> **СТАТУС: DRAFT — НЕ УТВЕРЖДЕНА.**
>
> Модель утверждается только после получения реальных выгрузок Exely
> и заполненного `project-input/exely/inventory_breakdown.md` (разбор 88 номеров).
>
> До утверждения запрещено: создавать миграции, Prisma schema, репозитории,
> API-контракты, зависящие от этих сущностей.
>
> Изменение любой сущности/поля/связи — сначала правка этого файла (см. AGENTS.md §2).

Версия: 0.1 (draft)
Дата: 2026-09-07

---

## Принципы

1. `Property` существует в модели, но UI MVP работает с одним property (ADR-001).
2. **Room ≠ sellable inventory** (ADR-005). Dorm содержит несколько bed inventory units.
3. **Reservation ≠ allocation** (ADR-006). Бронь категории может существовать
   без назначенного физического номера.
4. Деньги — integer minor units (ADR-008). Никаких float.
5. Stay dates — `DATE` в timezone объекта. События — UTC `timestamptz` (AGENTS.md §13).
6. Все внешние события идемпотентны (ADR-007).

---

## 1. Объект и физическая структура

### Property
```
id
name
legal_name
bin
address
timezone
currency
check_in_time
check_out_time
```
В MVP — одна запись.

### Building
```
id
property_id  → Property
name
```

### Floor
```
id
building_id  → Building
name
sort_order
```

### AccommodationType
Продаваемая категория.
```
id
property_id           → Property
code
name
kind                  PRIVATE_ROOM | DORM_BED | APARTMENT
capacity_adults
capacity_children
active
```

### PhysicalRoom
Физическое помещение.
```
id
floor_id              → Floor
room_number
name
capacity
is_dorm
status                (см. RoomStatus)
```

### InventoryUnit
Минимальная единица, куда физически можно назначить гостя.
```
id
physical_room_id      → PhysicalRoom
accommodation_type_id → AccommodationType
kind                  ROOM | BED
code
active
```

Пример private:
```
Room 101 → InventoryUnit ROOM-101
```

Пример dorm:
```
Dorm 201 → BED-201-1, BED-201-2, BED-201-3, BED-201-4, ...
```

Так модель не ломается из-за койко-мест.

> **ОТКРЫТО:** продаётся ли dorm целиком отдельной категорией (`WHOLE_DORM`),
> и как в этом случае блокируются отдельные bed units. См. Q-004, Q-005.

---

## 2. Бронирование

### Reservation — шапка брони
```
id
property_id           → Property
confirmation_number
source                DESK | PHONE | WHATSAPP | WALK_IN | OTA
channel
external_id
status
booked_at

arrival_date          DATE
departure_date        DATE

adults
children

currency
total_amount          integer minor units

primary_guest_id      → Guest

created_at
updated_at
```

`status`: `TENTATIVE | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW`

### ReservationItem
Одна продаваемая позиция внутри брони. Нужна для групп.
```
id
reservation_id        → Reservation
accommodation_type_id → AccommodationType
arrival_date
departure_date
quantity
price                 integer minor units
```

### Allocation
Фактическое назначение физической комнаты/койки.
```
id
reservation_item_id   → ReservationItem
inventory_unit_id     → InventoryUnit
start_date
end_date
```

Это позволяет:
- продавать категорию до назначения номера;
- потом назначить физический номер;
- переселить (закрыть одну allocation, открыть другую);
- назначить несколько beds.

---

## 3. Гости

### Guest
```
id
first_name
last_name
middle_name
birth_date
citizenship
gender
phone
email
```

### GuestDocument
```
id
guest_id              → Guest
type
number_encrypted      ← НЕ хранить паспорт открытой строкой
issue_country
issued_at
expires_at
document_file_id
```

Паспортные данные не дублируются строкой в других таблицах. См. `SECURITY.md`.

---

## 4. Housekeeping и блокировки

### RoomStatus (enum)
```
CLEAN | DIRTY | INSPECT | OUT_OF_ORDER | OUT_OF_SERVICE
```

### HousekeepingEvent
```
id
room_id               → PhysicalRoom
from_status
to_status
user_id
created_at
```

### InventoryBlock
```
id
inventory_unit_id     → InventoryUnit
date_from
date_to
reason
type                  MAINTENANCE | MANAGEMENT | OUT_OF_ORDER | OTHER
```

---

## 5. Тарифы

### RatePlan
```
id
property_id           → Property
code
name
currency
meal_plan
active
```

### RatePlanAccommodationType
```
rate_plan_id          → RatePlan
accommodation_type_id → AccommodationType
```

### DailyRate
```
date
accommodation_type_id → AccommodationType
rate_plan_id          → RatePlan
price                 integer minor units
```

### Restriction
```
date
accommodation_type_id → AccommodationType
rate_plan_id          → RatePlan

min_stay
max_stay
stop_sell
closed_to_arrival
closed_to_departure
```

> **ОТКРЫТО:** зависит ли цена от occupancy (в выгрузке `rates_12_months.xlsx`
> колонка `occupancy` есть). Если да — `DailyRate` получает `occupancy` в ключ.
> Решается на реальных данных.

---

## 6. Folio (финансы)

### Folio
```
id
reservation_id        → Reservation
status
currency
```

### Charge
```
id
folio_id              → Folio
service_id            → Service
description
quantity
unit_price            integer minor units
amount                integer minor units
service_date
created_by
```

### Payment
```
id
folio_id              → Folio
method
amount                integer minor units
currency
status
external_reference
paid_at
```

### Refund
```
id
payment_id            → Payment
amount                integer minor units
reason
external_reference
created_at
```

> **Правило:** `Reservation.total_amount` и баланс folio — разные вещи.
> Не смешивать (см. риск №4 в PLAN.md).

---

## 7. Channel Manager

UI и бизнес-сущности **никогда** не обращаются к Channex напрямую.

### Интерфейс ChannelProvider
```
createProperty()
createRoomType()
createRatePlan()

pushAvailability()
pushRates()
pushRestrictions()

pullReservations()
acknowledgeReservation()

processWebhook()

connectChannel()
mapChannel()
syncFullInventory()
```

### ChannelMapping
```
id
provider
channel

local_accommodation_type_id → AccommodationType
local_rate_plan_id          → RatePlan

provider_property_id
provider_room_type_id
provider_rate_plan_id

channel_property_id
channel_room_id
channel_rate_id
```

---

## 8. Внешние события

### ExternalEvent
```
id
provider
external_event_id
type
received_at
payload_hash

status
attempt_count
last_error

processed_at
```

**UNIQUE (provider, external_event_id)** — обязательно, для идемпотентности.

---

## 9. Казахстан

### EqonaqNotification
```
id
guest_id              → Guest
reservation_id        → Reservation

status
external_request_id

submitted_at
confirmed_at

attempt_count
last_error
```

`status`: `PENDING | SENT | ACCEPTED | REJECTED | RETRY | MANUAL_REVIEW`

### FiscalReceipt
```
id
folio_id              → Folio
payment_id            → Payment

provider
receipt_number
fiscal_id

status

amount                integer minor units
created_at
fiscalized_at

error
```

> Конкретный fiscal provider **не зафиксирован**. См. Q-050…Q-053.

---

## 10. Аудит

### AuditLog
```
id
user_id
entity_type
entity_id
action
before      jsonb
after       jsonb
created_at
```

Обязательно логируется: изменение дат; изменение цены; room move; cancellation;
payment; refund; manual availability; изменение guest document.

---

## Чего в модели пока НЕТ и почему

| Область | Почему отложено |
|---|---|
| Roles/Permissions | Ждём Q-060…Q-064 (кто что может) |
| Services справочник | Ждём `services.xlsx` |
| PaymentMethod справочник | Ждём `payment_methods.xlsx` |
| Сезоны как отдельная сущность | Возможно, достаточно DailyRate. Решаем на данных |
| Groups / company accounts | Проверить, есть ли в Exely |

---

## Гейт утверждения

Модель считается утверждённой, когда:

- [ ] Получен `project-input/exely/inventory_breakdown.md` с ответами на все 18 вопросов раздела «88 номеров»
- [ ] Получены все обязательные выгрузки Exely
- [ ] Ответы на Q-001…Q-006 (inventory) записаны в QUESTIONS.md
- [ ] Ответы на Q-010…Q-015 (reservation) записаны
- [ ] Пробный маппинг: каждая строка `inventory.xlsx` укладывается в InventoryUnit без «докручивания» схемы
- [ ] Пробный маппинг: каждая строка `future_reservations.xlsx` укладывается в Reservation + ReservationItem + Allocation
- [ ] Явное письменное подтверждение владельца проекта

Пока хотя бы один пункт не выполнен — статус остаётся DRAFT.
