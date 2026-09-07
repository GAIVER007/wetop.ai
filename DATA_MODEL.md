# DATA MODEL

> **СТАТУС: DRAFT — НЕ УТВЕРЖДЕНА.**
>
> Аудит Exely 07.09.2026 сдан. Фактура объекта известна — см. [OBJECT.md](OBJECT.md).
> **Q-080 закрыт 07.09.2026** (ADR-013): койко-место = единица продажи, каждая из 88 единиц —
> отдельная ячейка. **Q-092 отложен владельцем** 07.09.2026: знаменатель загрузки — формула
> отчёта, не схема; до отдельного решения считаем как Exely, по 88 единицам.
> Осталось **одно решение**, без которого модель не утверждается:
>
> - **Q-091** — Folio привязан к брони или к проживанию
>
> Правки версии 0.3 помечены «v0.3» — это предложения по итогам разбора 07.09.2026,
> они тоже ждут утверждения владельцем.
>
> Это решения владельца, а не разработчика. До них запрещено: создавать миграции,
> Prisma schema, репозитории, API-контракты, зависящие от этих сущностей.
>
> Изменение любой сущности/поля/связи — сначала правка этого файла (AGENTS.md §2).

Версия: 0.3 (draft; Q-080 закрыт; правки по разбору 07.09.2026 помечены «v0.3»)
Дата: 2026-09-07

---

## Принципы

1. `Property` существует в модели, но UI MVP работает с одним property (ADR-001).
2. **Room ≠ sellable inventory** (ADR-005). Но на объекте по **ADR-013** каждая единица
   продажи — самостоятельная ячейка: `PhysicalRoom` заполняется 1:1, иерархия
   «комната → койки» в MVP не строится. Availability, шахматка, уборка, блокировки —
   по `InventoryUnit`.
3. **Reservation ≠ allocation** (ADR-006). Бронь категории может существовать
   без назначенного физического номера.
4. Деньги — integer minor units (ADR-008). Никаких float.
5. Stay dates — `DATE` в timezone объекта (UTC+05:00). События — UTC `timestamptz`.
6. Все внешние события идемпотентны (ADR-007).
7. **Ничего не выводить из номера единицы.** Нумерация в Exely не сплошная и не логичная
   (1–4 номера, 5–40 койки, 41–48 номера, 49–84 койки, 85–88 номера). Только явные связи.

---

## 1. Объект и физическая структура

### Property
```
id
name                  → "Luxx Aparts"
legal_name            → ИП «L.A»
bin                   → 851101300781
address
timezone              → Asia/Almaty (UTC+05:00)
currency              → KZT
check_in_time         → 14:00
check_out_time        → 12:00
```
В MVP — одна запись.

### Building
```
id
property_id  → Property
name                  → в Exely: один корпус «Основной»
```

### Floor
```
id
building_id  → Building
name                  → в Exely: один этаж «2»
sort_order
```

### AccommodationType

Продаваемая категория. Фактический состав объекта:

```
id
property_id           → Property
code
name
kind                  PRIVATE_ROOM | DORM_BED | APARTMENT
capacity_adults
capacity_children     → у всех 0, детское размещение выключено
active
```

| Exely ID | Название | kind | capacity_adults | Единиц |
|---|---|---|---|---|
| 5074312 | Одноместная комната с окном | PRIVATE_ROOM | 1 | 4 |
| 5074686 | Одноместная комната без окон | PRIVATE_ROOM | 1 | 8 |
| 5074687 | Двухместная комната | PRIVATE_ROOM | 1 или 2 | 4 |
| 5074688 | Общая мужская комната | DORM_BED | 1 | 36 |
| 5074689 | Общая женская комната | DORM_BED | 1 | 36 |

`APARTMENT` в модели остаётся, но на объекте таких категорий нет.

> **Гендерное деление dorm выражено через отдельные категории**, а не через атрибут.
> Exely так и делает, и OTA продают именно категорию. Отдельного поля `gender`
> в модели не заводим — иначе получим два источника правды.
>
> Отдельно: **система пола не проверяет**. Ничто не мешает поселить кого угодно куда
> угодно. Нужна ли проверка в новой PMS — вопрос к владельцу, не к модели.

### PhysicalRoom

```
id
floor_id              → Floor
room_number
name
capacity
is_dorm
```

> **Решено — ADR-013, 07.09.2026.** Единица продажи — койка/ячейка, бизнес-логика MVP
> на `PhysicalRoom` не опирается — только на `InventoryUnit`. Статус уборки перенесён
> на `InventoryUnit` (v0.3), см. §4.
>
> Чем заполняется `PhysicalRoom` (со слов владельца 07.09.2026, в Exely этого нет):
> **20 комнат** = 12 одноместных + 4 двухместных + 4 dorm-комнаты по 18 коек
> (2 мужские, 2 женские). Отдельные номера — 1:1 с единицей продажи (16 записей).
> Dorm-комнаты — 4 записи с `capacity` = 18, `is_dorm` = true; какие именно единицы
> Exely (5–40, 49–84) входят в какую комнату — только по явному списку, **Q-095**.
> Из номера единицы принадлежность не выводится (принцип 7).
> **Q-095 отложен владельцем.** До списка импорт заполняет `PhysicalRoom` 1:1 для всех 88
> единиц (исходный вариант А); при получении списка 72 койки перегруппировываются
> в 4 комнаты данными, схема не меняется.

### InventoryUnit

Минимальная единица, куда физически можно назначить гостя.

```
id
physical_room_id      → PhysicalRoom
accommodation_type_id → AccommodationType
kind                  ROOM | BED
code
housekeeping_status   DIRTY | CLEAN | INSPECTED     ← v0.3, см. §4
active
```

Фактически на объекте: **88 единиц = 16 ROOM + 72 BED.**

```
88 = 4 (одноместная с окном)
   + 8 (одноместная без окон)
   + 4 (двухместная)
   + 36 (мужские койки)
   + 36 (женские койки)

Максимальная вместимость гостей = 92
```

Связь единица → категория строго **1:1**. Виртуальных категорий нет,
составные типы размещения в менеджере каналов не используются.

---

## 2. Бронирование

### Reservation — шапка брони
```
id
property_id           → Property
confirmation_number
source                DESK | PHONE | WHATSAPP | WALK_IN | INSTAGRAM | OTA | WEBSITE
channel
external_id
status
booked_at

arrival_date          DATE
departure_date        DATE

adults
children

currency              → KZT
total_amount          integer minor units

primary_guest_id      → Guest   ← контактное лицо брони; состав гостей — StayGuest (v0.3)
notes                 text      ← v0.3: заметки, главный канал передачи смены (FINDINGS §2 #8)

created_at
updated_at
```

`status`: `TENTATIVE | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW`

> **`source` — не формальность.** В Exely 389 из 390 прямых броней записаны со значением
> по умолчанию «от стойки», и 37% продаж обезличены. Если новая система оставит source
> необязательным, проблема воспроизведётся. Обязательность — Q-089.

### ReservationItem

Одна продаваемая позиция внутри брони. В терминах Exely — «проживание» (room stay).

```
id
reservation_id        → Reservation
accommodation_type_id → AccommodationType
arrival_date
departure_date
quantity              ← v0.3: помечено к удалению, см. ниже
price                 integer minor units
status                ← v0.3: TENTATIVE | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW
```

Подтверждено фактом: бронь Trip.com на 2 единицы = одна бронь, два проживания,
**два счёта** (`…-01`, `…-02`).

> **v0.3 — предложено.** (1) Статус ведётся на проживании: в Exely no-show, переселение и
> счёт — на уровне проживания, и ситуация «из двух проживаний одно заселено, второе no-show»
> иначе не выражается. `Reservation.status` становится производным. (2) `quantity`
> избыточно: в Exely проживание = одна единица, у нас одно проживание = одна ячейка
> (ADR-013), а `Allocation` и folio по проживанию (если Q-091 = б) требуют именно этого.
> Предлагается убрать. Оба пункта утверждаются вместе с Q-091.

### StayGuest (v0.3 — предложено)

Кто живёт в каком проживании. Без этой связи бронь на две койки не знает, какой гость
в какой ячейке, а подача в eQonaq (на гостя) и folio по проживанию не с чем связать.
SPEC §4 требует «несколько гостей в одной брони».

```
reservation_item_id   → ReservationItem
guest_id              → Guest
is_primary
```

### Allocation

Фактическое назначение единицы.

```
id
reservation_item_id   → ReservationItem
inventory_unit_id     → InventoryUnit
start_date
end_date
```

Позволяет: продавать категорию до назначения единицы; назначить единицу; переселить
(закрыть одну allocation, открыть другую); назначить несколько коек.

> Факт объекта: единица назначается **сразу** при создании брони, включая брони
> из каналов — 1043 из 1044 заездов августа. Модель это разрешает, но не требует.
> Правило автоназначения ячейки для входящих OTA-броней — **Q-094**, решение владельца.

---

## 3. Гости

### Guest
```
id
first_name
last_name
middle_name
birth_date
citizenship           ← обязательно на check-in, см. ниже
gender
phone
email
notes                 ← v0.3: комментарии к гостю (SPEC §5)
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

> **Гражданство у OTA-броней не приходит** — в Exely это поле у канальных броней пустое.
> Для eQonaq данные берутся из паспорта вручную при заселении. Значит: `citizenship`
> заполняется на check-in и является обязательным полем check-in, а не полем импорта.

Паспортные данные не дублируются строкой в других таблицах. См. `SECURITY.md`.

---

## 4. Housekeeping и блокировки

### HousekeepingStatus (enum) — v0.3
```
DIRTY | CLEAN | INSPECTED
```

В Exely три статуса: «Грязно», «Убрано», «Проверено» — ровно эти. Ремонт и вывод
из продажи здесь **не** выражаются: для этого есть `InventoryBlock` ниже. До v0.3
`OUT_OF_ORDER` был и в статусе уборки, и в типе блокировки — два источника правды
для «единица недоступна». Оставлен один: `InventoryBlock`.

Статус уборки ведётся по `InventoryUnit`, а не по `PhysicalRoom`: так делает Exely
(отчёт обслуживания — 88 строк) и так требует ADR-013.

### HousekeepingEvent
```
id
inventory_unit_id     → InventoryUnit     ← v0.3, было room_id → PhysicalRoom
from_status
to_status
user_id
created_at
```

> **Факт, который меняет требования.** На 07.09.2026 в Exely: 85 «Грязно», **0 «Убрано»**,
> 3 «Проверено» — при 78 занятых единицах и включённой настройке «заселять только
> в убранные». Статусы уборки **не ведутся вообще**.
>
> Два следствия для новой системы: (1) статус должен обновляться там, где стоит горничная,
> а не там, где сидит администратор; (2) блокировка заселения по статусу уборки,
> включённая в лоб, парализует работу.

### InventoryBlock
```
id
inventory_unit_id     → InventoryUnit
date_from
date_to
reason
type                  MAINTENANCE | MANAGEMENT | OUT_OF_ORDER | OTHER
```

На объекте на 07.09.2026 — 0 блокировок. Переносить нечего, механизм нужен.

---

## 5. Тарифы

### RatePlan
```
id
property_id           → Property
code
name
currency              → KZT
meal_plan             → на объекте: НИ ОДНОГО тарифа с питанием
active
```

Фактически 6 тарифов, из них 3 без продаж и 2 ни к чему не привязаны (Q-082).

### RatePlanAccommodationType
```
rate_plan_id          → RatePlan
accommodation_type_id → AccommodationType
```

> На объекте тарифы **не привязаны к категориям** — действуют на все. Связь в модели
> оставляем: она нужна для Channex и для будущей гибкости, при импорте заполняется
> декартовым произведением.

### DailyRate
```
date
accommodation_type_id → AccommodationType
rate_plan_id          → RatePlan
occupancy             ← см. ниже
price                 integer minor units
```

> **Вопрос occupancy закрыт аудитом.** Цена зависит от числа гостей только у одной
> категории — «Двухместная комната» (1 или 2 гостя). У остальных четырёх вместимость
> фиксирована. `occupancy` в ключе нужен, но поддержать достаточно вариант 1|2.

Цены на объекте загружены на 30.05.2026 – 31.12.2027 (основные тарифы)
и 26.06.2026 – 31.12.2026 (тарифы Островка).

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

> **Переносить нечего:** ни одного действующего ограничения на объекте нет.
> Механизм в новой PMS обязателен — без него нельзя работать с OTA.

### Сезоны

**В модели не заводим.** На объекте сезонность не используется: один «Сезон по умолчанию»
без периодов и цен. `DailyRate` покрывает потребность. Если сезоны понадобятся — отдельное
решение и отдельная сущность.

---

## 6. Folio (финансы)

> **⚠ РАЗДЕЛ НЕ УТВЕРЖДАЕТСЯ — открыт Q-091.**
>
> Черновик ниже привязывает `Folio` к `Reservation`. Exely создаёт счёт **на каждое
> проживание**: бронь на 2 единицы → счета `…-01` и `…-02`. Это прямое расхождение.
> Решение влияет на: разделение счёта между гостями, перенос будущих броней,
> сверку с Exely на Gate 1 и Gate 8.

### Folio
```
id
reservation_id        → Reservation      ← или reservation_item_id, см. Q-091
status
currency              → KZT
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

> **Сегодня начислений нет вообще.** Ни у одного из 1044 заездов августа нет привязанных
> услуг, при этом по кассе прошло 170 600 ₸ услуг и 62 200 ₸ питания. Услуги проводятся
> разовой строкой в кассе, минуя счёт гостя. Заставлять ли начислять — Q-090.

### Payment
```
id
folio_id              → Folio
method                → Halyk Bank | Kaspi Bank | Наличные | Депозит | Внешняя система оплаты
amount                integer minor units
currency              → KZT
status
external_reference
paid_at
```

> Оплата частями — обычная практика: 1449 финансовых операций на 1044 заезда.
> Модель обязана поддерживать несколько платежей на один счёт.

### Refund
```
id
payment_id            → Payment
amount                integer minor units
reason
external_reference
created_at
```

### Service
```
id
property_id           → Property
code
name_ru
name_kz
price                 integer minor units
tax
group                 → «Минибар», «Прачечная»
active
```

Фактически 9 услуг. Завтрака, трансфера, раннего заезда и позднего выезда как услуг нет.

> **Правило:** `Reservation.total_amount` и баланс folio — разные вещи, не смешивать.
> На объекте это видно прямо: приход в кассу за август 17,6 млн ₸ против оборота
> проживания по заездам 15,7 млн ₸ — разница из перечислений каналов за прошлые периоды,
> услуг и переходящих оплат. Новая система должна показывать обе цифры и объяснять разницу.

---

## 7. Channel Manager

UI и бизнес-сущности **никогда** не обращаются к Channex напрямую (ADR-004).

### Интерфейс ChannelProvider
```
createProperty()      createRoomType()      createRatePlan()
pushAvailability()    pushRates()           pushRestrictions()
pullReservations()    acknowledgeReservation()
processWebhook()
connectChannel()      mapChannel()          syncFullInventory()
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

Восемь каналов подлежат маппингу, ID объектов известны — см. [OBJECT.md](OBJECT.md) §4.

> **Ценообразование по каналам на объекте реализовано отдельным тарифом на канал,
> а не наценкой.** Базовый тариф → сайт и PMS; «+35%» → все 8 OTA; отдельные тарифы
> под Островок. Модель это поддерживает через `ChannelMapping.local_rate_plan_id`.

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

**UNIQUE (provider, external_event_id)** — обязательно, для идемпотентности (ADR-007).

---

## 9. Казахстан

### EqonaqNotification
```
id
guest_id              → Guest
reservation_id        → Reservation

status                PENDING | SENT | ACCEPTED | REJECTED | RETRY | MANUAL_REVIEW
external_request_id

submitted_at
confirmed_at

attempt_count
last_error
```

> Масштаб: ~1000 заездов в месяц, большинство — иностранцы (62,6% заездов через
> международные каналы, крупнейший внешний рынок — Китай через Trip.com).
> Сегодня подача полностью ручная. Это самый нагруженный участок автоматизации.

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

> Масштаб: ~1300 приходных операций в месяц + 14 возвратов. Сегодня чек пробивается
> отдельно от проведения оплаты — двойной ввод на каждой операции.
> Конкретный fiscal provider **не зафиксирован** (Q-050…Q-053).

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

## Чего в модели нет и почему

| Область | Решение |
|---|---|
| Сезоны | Не заводим — на объекте не используются, `DailyRate` достаточно |
| Детские тарифы и возрастные группы | Не заводим — детское размещение выключено, 0 детей за месяц |
| Ярус койки, окно у dorm-места, площадь, планировка комнат | Данных не существует; по ADR-013 в MVP не нужны. Q-081 закрыт |
| Roles/Permissions | Ждём Q-061…Q-064 |
| Company / юрлица-заказчики | Справочник в Exely есть, за август **0 реальных юрлиц**. Вне MVP |
| Учёт расходов бизнеса (зарплата, коммуналка) | Вне scope PMS (`SPEC.md`), но люди этим пользуются — Q-084 |
| Овербукинг | На объекте не настроен. Механизм квот отложен |

---

## Гейт утверждения

- [x] Аудит по `TZ-EXELY-AUDIT.md` сдан — `project-input/exely/audit-2026-09-07/`
- [x] Раздел 5 (номерной фонд) закрыт: 88 = 16 ROOM + 72 BED, подтверждено трижды
- [x] Раздел 6 (dorm) закрыт, кроме 6.11 и 6.14
- [x] Вопросы Q-001…Q-011 записаны с источниками
- [x] Пробный маппинг инвентаря: 88 строк укладываются в `InventoryUnit` без изменения схемы
- [x] Вопрос occupancy в `DailyRate` разрешён (только «Двухместная», 1|2)
- [x] **Q-080 — модель койки** — закрыт 07.09.2026, вариант А (ADR-013)
- [ ] Правки v0.3 (StayGuest, статус проживания, `quantity`, notes, уборка по единице) рассмотрены владельцем
- [ ] **Q-091 — Folio на бронь или на проживание** (решение владельца)
- [x] ~~Q-092~~ — отложен владельцем 07.09.2026; на схему не влияет, сверка по 88 как в Exely
- [ ] Пробный маппинг будущих броней: 209 проживаний укладываются в Reservation + Item + Allocation
- [ ] Явное письменное подтверждение владельца проекта

Пока хотя бы один пункт не выполнен — статус остаётся DRAFT.
