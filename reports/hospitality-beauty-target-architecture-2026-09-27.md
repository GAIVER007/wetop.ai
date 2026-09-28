# WETOP — целевая архитектура: Hospitality + Beauty

**Дата:** 27.09.2026
**Основание:** `reports/beauty-vertical-audit-2026-09-27.md` (аудит AS-IS) + прямое техническое задание владельца на целевую архитектуру.
**Статус:** проектный документ. Код не менялся, миграции не запускались, схема не трогалась — это план, а не реализация.
**Как читать:** каждый пункт задания владельца (1–20) закрыт где-то в разделах A–M; сквозная нумерация задания указана в скобках при первом упоминании. Каждое утверждение — с конкретным `file:line`/именем таблицы из текущего кода.

---

## 0. Продуктовая модель (закрывает пункт 1)

```
Platform Core                 — Organization, User, Membership, Session, Invite, PlatformAdmin,
                                 Location, OrganizationExtension, IntegrationConnection,
                                 Finance-арифметика, Web-analytics, Notifications, дизайн-система
    │
    ├── Vertical: HOSPITALITY — Property, AccommodationType, InventoryUnit, Reservation,
    │                            ReservationItem, Allocation, RatePlan, DailyRate, Restriction,
    │                            Housekeeping, ChannelMapping, Chessboard, Channex/архивный источник/eQonaq
    │
    └── Vertical: BEAUTY      — Customer, Employee, BeautyService, EmployeeService, WorkingHours,
                                 TimeOff, Appointment, Beauty Calendar
    │
    ├── Extensions             — AI_SELLER, CHANNEL_MANAGER*, ONLINE_BOOKING, ADVANCED_ANALYTICS
    │                            (*только для HOSPITALITY-локаций; расширение — не вертикаль)
    │
    └── Client Configuration/Data — конкретные Organization/Location строки: Luxx Aparts,
                                     будущий салон, их данные, их IntegrationConnection
```

**Luxx Aparts — это исключительно строка в четвёртом уровне** (`Organization{name:'Luxx Aparts'}` + одна `Location{vertical:'HOSPITALITY'}` + связанные данные), а не часть Platform Core или Vertical-логики. Сегодня это не так: константа `LUXX_APARTS_PROPERTY` (`packages/domain/src/property/index.ts:11-21`) живёт в `packages/domain` — то есть в слое, который аудит классифицировал как «бизнес-логика PMS» — и используется 16–20 файлами `apps/api/src` как fallback-идентичность. Раздел J и Фаза 8 плана миграции переносят её из Platform/Vertical-кода в Client Configuration (реальную строку `Property`/`Location`, найденную по контексту запроса, а не по имени).

Обоснование правильности целевой модели именно как «4 слоя», а не «Organization = Hotel»: `SPEC.md` уже 07.09.2026 зафиксировал, что база не должна предполагать «в мире существует только один отель», и сохранил `Property` как отдельную сущность именно для этого. Целевая модель — прямое продолжение этого решения, а не отказ от него.

---

## A. Target Architecture Diagram

```
                              ┌─────────────────────────────┐
                              │        apps/web (shell)      │
                              │  один route/shell Today,     │
                              │  vertical выбирает виджеты    │
                              │  и navigation (см. §I)        │
                              └───────────────┬──────────────┘
                                               │ REST (как сейчас)
                              ┌────────────────▼──────────────┐
                              │           apps/api             │
                              │  SessionGuard → AuthorInterceptor │
                              │  → RequestActor{orgId,locationId, │
                              │     vertical,role} (см. §J)       │
                              └───┬─────────────────────┬──────┘
                                  │                      │
                     ┌────────────▼──────────┐  ┌────────▼─────────────┐
                     │  Hospitality modules    │  │   Beauty modules      │
                     │  (НЕ переписываются,     │  │   (новые, параллельные)│
                     │   §E)                    │  │   §F                   │
                     │  chessboard/reservations/ │  │  beauty/customers/     │
                     │  inventory/rates/finance/  │  │  employees/services/   │
                     │  guests/channels           │  │  appointments/schedule │
                     └────────────┬──────────┘  └────────┬─────────────┘
                                  │                      │
                     ┌────────────▼──────────────────────▼─────────────┐
                     │              packages/domain                     │
                     │  Hospitality: reservations/availability/         │
                     │    chessboard/inventory/housekeeping (не трогать) │
                     │  Beauty: appointments/scheduling (новое)           │
                     │  Shared (§G): finance-арифметика, money,          │
                     │    web-analytics, accounts, incidents             │
                     └────────────┬──────────────────────┬─────────────┘
                                  │                      │
                     ┌────────────▼──────────┐  ┌────────▼─────────────┐
                     │  packages/database      │  │ packages/integrations  │
                     │  Property/InventoryUnit/│  │ Channex/архивный источник/eQonaq   │
                     │  Reservation (не трогать)│  │  (только HOSPITALITY)  │
                     │  + НОВОЕ: Location,      │  │ mail/telegram/fiscal   │
                     │  Customer, Employee,     │  │  (platform, оба        │
                     │  Appointment,            │  │   vertical)            │
                     │  IntegrationConnection    │  └────────────────────────┘
                     └──────────────────────────┘

apps/ai-seller ──HTTP(x-wetop-service-key)──▶ apps/api  (не меняется маршрутом; знает про organizationId
                                                          и locationId — Protocol-интерфейсы уже generic,
                                                          требуется правка только hotel_tools.py/wetop.py/
                                                          knowledge/facts.py, §H)
```

---

## B. Target Database/Entity Diagram

```
Organization ──1:N── Location ──vertical:{HOSPITALITY|BEAUTY}
     │                   │
     │                   ├──1:1(nullable, HOSPITALITY only)── Property ──(без изменений, §E)
     │                   │                                        │
     │                   │                                        ├── Building/Floor/PhysicalRoom
     │                   │                                        ├── AccommodationType ── InventoryUnit
     │                   │                                        ├── Reservation ── ReservationItem ── Allocation
     │                   │                                        ├── RatePlan/DailyRate/Restriction
     │                   │                                        ├── ChannelMapping/ExternalEvent/ChannelOutbox
     │                   │                                        └── Service/Folio/Charge/Payment/Refund
     │                   │
     │                   └──(BEAUTY only, новое, §F)
     │                        ├── Customer ──N:M(через Appointment)── Employee
     │                        ├── Employee ──1:1(nullable)── User
     │                        ├── Employee ──N:M── BeautyService (через EmployeeService)
     │                        ├── Employee ──1:N── WorkingHours, TimeOff
     │                        └── Appointment(startAt,endAt) → Customer, Employee, BeautyService
     │
     ├──1:N── Membership ──role:{OWNER|STAFF} ──N:1── User
     ├──1:N── OrganizationExtension ──extension:{AI_SELLER|CHANNEL_MANAGER|ONLINE_BOOKING|ADVANCED_ANALYTICS}
     ├──1:N── IntegrationConnection ──provider:{CHANNEX|EMAIL|WHATSAPP|...} (organization- или location-owned)
     └──1:N── Session ──(NEW) activeLocationId
```

Полная сегодняшняя карта БД (без изменений в этом документе) — в `reports/beauty-vertical-audit-2026-09-27.md` §C.

---

## C. Current → Target Mapping

| Текущее | Целевое | Тип изменения | Файлы/таблицы |
|---|---|---|---|
| `Property.organizationId` — прямая связь Organization↔Property | `Location.organizationId`, `Property.locationId` (новый) — Property становится HOSPITALITY-специализацией Location | Additive, потом deprecate старой колонки | `schema.prisma:24-63` (`Property`), новая модель `Location` |
| `AuthService.register()` создаёт `Organization`+`Property` одной транзакцией | `register()` создаёт только `Organization`+`User`+`Membership`; отдельный шаг создаёт `Location` с выбором vertical | Behavior change (Фаза 4) | `apps/api/src/auth/auth.service.ts:276-345` |
| `hotel/onboarding.ts` — единственный онбординг, создаёт Room/Bed/RatePlan | Остаётся HOSPITALITY-специфичным онбордингом, запускается после выбора vertical=HOSPITALITY | Не переписывается, только точка входа переносится | `apps/api/src/hotel/onboarding.ts` (без изменений внутри) |
| `LUXX_APARTS_PROPERTY` + ~16-20 файлов резолвят объект по имени | Явный `propertyId`/`locationId` в контексте каждого service-пути; сторож/синк итерируют все объекты, а не «один» | Замена по одному файлу (Фаза 8) | список файлов — `reports/beauty-vertical-audit-2026-09-27.md` §F.1(B) |
| `Guest`/`AuditLog`/`ExternalEvent`/`ChannelOutbox` без tenant-колонки | Nullable `organizationId`/`propertyId` на всех четырёх | Additive + backfill (Фаза 1) | `schema.prisma:328,507,567,606` |
| `RequestActor{userId,organizationId,role,platformAdmin,organizationScope}` | + `locationId`, `vertical`, `locationScope` | Additive поля | `apps/api/src/auth/request-context.ts` |
| `property-ref.ts` резолвит Property по `organizationId` напрямую | Внутренняя реализация `organizationPropertyRef()` резолвит через `Location`; внешний контракт (`PropertyRef`) не меняется | Внутренний рефакторинг, 0 изменений в вызывающих репозиториях | `apps/api/src/database/property-ref.ts` |
| `.env`-ключи Channex/почты на процесс | `IntegrationConnection` per organization/location, шифрование как у `GuestDocument` | Новая модель + миграция данных (Фаза 8) | `apps/api/src/channels/connection.ts:13,17,37,64` |
| `Folio.reservationItemId @unique` — жёсткая связь с Hospitality | См. §K — два варианта, решение владельца | Схема (Фаза 6) | `schema.prisma:663-677` |
| `lib/navigation.ts` — единый статический массив | `verticals/hospitality.ts` + `verticals/beauty.ts`, выбор по `location.vertical` | Рефакторинг конфигурации, не логики | `apps/web/src/lib/navigation.ts` |
| Нет `Customer`/`Employee`/`Appointment` | Новые таблицы, параллельные Hospitality | Additive (Фаза 5) | новые модели, см. §F |

---

## D. Organization / Location / Vertical Model (закрывает пункт 2)

### D.1 Целевая модель

```prisma
enum LocationVertical {
  HOSPITALITY
  BEAUTY
}

model Location {
  id             String           @id @default(uuid()) @db.Uuid
  organizationId String           @map("organization_id") @db.Uuid
  vertical       LocationVertical
  name           String
  address        String?
  phone          String?
  email          String?
  timezone       String
  currency       String @db.Char(3)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  property     Property?    // 1:1, только для vertical = HOSPITALITY

  @@index([organizationId])
  @@map("locations")
}
```

`Organization` — без изменений (`schema.prisma:966-984`), без поля `vertical`: по прямому требованию задания vertical принадлежит `Location`, не Organization. Это уточняет рекомендацию аудита (там предлагалось `Organization.vertical`) — уточнение верное: одна организация в будущем теоретически может держать и гостиницу, и салон под разными Location.

### D.2 Почему НЕ переименовывать/не трогать `Property`

Если `Location.id` заменить на `Property.id` (слить identity) — придётся переписать 8+ таблиц, которые сегодня напрямую ссылаются на `property_id` (`Building`, `AccommodationType`, `Reservation`, `RatePlan`, `ChannelMapping`, `Payment`, `Service`, `TrackedSite`, `InventoryUnit` — `schema.prisma:51-59`). Вместо этого:

- `Property` остаётся отдельной таблицей с собственным `id`, получает новую nullable колонку `locationId`.
- Все 8+ существующих внешних ключей на `property_id` **не меняются вообще**.
- `Property` концептуально становится «HOSPITALITY-специализацией `Location`» — то самое «Hospitality Property» из цепочки задания `Organization → Location → Hospitality Property`.

### D.3 Конкретный результат миграции для Luxx

Один раз, аккуратно, аддитивно:

1. `CREATE TABLE locations (...)`.
2. Для существующей единственной строки `properties` (Luxx): `INSERT INTO locations (organization_id, vertical, name, address, phone, email, timezone, currency) SELECT organization_id, 'HOSPITALITY', name, address, phone, email, timezone, currency FROM properties WHERE ...` — копия полей, которые логически принадлежат «точке бизнеса», а не «гостиничным часам».
3. `ALTER TABLE properties ADD COLUMN location_id uuid REFERENCES locations(id)`, затем `UPDATE properties SET location_id = <id только что созданной строки>`.
4. Итог для Luxx: `Organization{name:'Luxx Aparts'}` → `Location{vertical:'HOSPITALITY', name:'Luxx Aparts', timezone:'Asia/Almaty', currency:'KZT'}` → `Property{locationId: <тот же>, checkInTime:'14:00', checkOutTime:'12:00', legalName, bin}` со всеми существующими связями (`Building`, `Reservation`, `AccommodationType`, …) **без единого изменения строки в этих таблицах**. Ни одна бронь, ни один платёж не переносится и не меняет `id`.

### D.4 Безопасный переход `Organization → Property` к `Organization → Location → Hospitality Property`

Порядок (детально — Фазы 1-2-3 в §L):
1. Добавить `Location` и `Property.locationId` (аддитивно, Property.organizationId остаётся работать как раньше — **окно совместимости**).
2. Переключить внутреннюю реализацию резолвера (`organizationPropertyRef()` в `property-ref.ts:86-100`) на путь через `Location`, сохранив внешний контракт `PropertyRef{id,name,organizationId,timezone}` — ни один из ~20 репозиториев, вызывающих `propertyRef`/`propertyIdRef`, не меняется.
3. Только после того, как весь трафик пошёл через `Location`, и это подтверждено тестами — вывести `Property.organizationId` в deprecated (не удалять сразу, §L Фаза 8).

---

## E. Hospitality Bounded Context (закрывает пункт 3)

Не переписываются и не расширяются (буквально по списку задания): `Property`, `AccommodationType`, `InventoryUnit`, `PhysicalRoom`, `Reservation`, `ReservationItem`, `Allocation`, `RatePlan`, `DailyRate`, `Restriction`, Housekeeping (`HousekeepingEvent`, `InventoryBlock`), `ChannelMapping`, Channex/архивный источник/eQonaq (`packages/integrations/src/{channex,retired-source,eqonaq}`), Chessboard (`packages/domain/src/chessboard/build.ts`, `apps/api/src/chessboard`, `apps/web/src/app/chessboard`).

**Единственное изменение, которое их касается:** `InventoryUnitKind` (`ROOM|BED`) и `AccommodationKind` (`PRIVATE_ROOM|DORM_BED|APARTMENT`) **не получают новых значений** (`MASTER`/`CHAIR`/`SERVICE` и т.п. туда не добавляются — прямое требование задания и одновременно то, что защищает Channex/ARI/шахматку/availability/pricing/архивный источник-сверку от риска, описанного в аудите §I.2). Всё, что нужно Hospitality от новой модели — это то, что `Property` теперь на один шаг глубже (через `Location`), и это прозрачно благодаря §D.4.

Шахматка (Chessboard) сохраняет архитектурное назначение без изменений (пункт 15): `apps/web/src/app/chessboard/board-grid.tsx` и `packages/domain/src/chessboard/build.ts` не трогаются. Generic overlap-движок внутри `buildChessboard()` остаётся источником *паттерна* (не кода) для Beauty Calendar — см. §F.7.

---

## F. Beauty Bounded Context (закрывает пункты 4, 5, 6, 15-beauty)

### F.1 Entity-relationship (новые таблицы, все — новые файлы миграций, ничего существующего не трогают)

```prisma
model Customer {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid   // NOT NULL с первого дня — новая таблица
  firstName      String   @map("first_name")
  lastName       String   @map("last_name")
  phone          String?
  email          String?
  notes          String?
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization  @relation(fields: [organizationId], references: [id])
  appointments Appointment[]

  @@index([organizationId])
  @@map("customers")
}

model Employee {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  locationId     String   @map("location_id") @db.Uuid
  userId         String?  @map("user_id") @db.Uuid   // nullable — см. §F.2
  firstName      String   @map("first_name")
  lastName       String   @map("last_name")
  phone          String?
  email          String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  location      Location         @relation(fields: [locationId], references: [id])
  user          User?            @relation(fields: [userId], references: [id], onDelete: SetNull)
  services      EmployeeService[]
  workingHours  WorkingHours[]
  timeOff       TimeOff[]
  appointments  Appointment[]

  @@index([locationId])
  @@map("employees")
}

model BeautyService {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  locationId     String   @map("location_id") @db.Uuid
  name           String
  durationMinutes Int     @map("duration_minutes")
  price          BigInt   // integer minor units, ADR-008 — без исключений и для Beauty
  category       String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  location  Location          @relation(fields: [locationId], references: [id])
  employees EmployeeService[]
  appointments Appointment[]

  @@index([locationId])
  @@map("beauty_services")
}

model EmployeeService {
  employeeId       String  @map("employee_id") @db.Uuid
  beautyServiceId  String  @map("beauty_service_id") @db.Uuid
  priceOverride    BigInt? @map("price_override")
  durationOverrideMinutes Int? @map("duration_override_minutes")

  employee      Employee      @relation(fields: [employeeId], references: [id])
  beautyService BeautyService @relation(fields: [beautyServiceId], references: [id])

  @@id([employeeId, beautyServiceId])
  @@map("employee_services")
}

model WorkingHours {
  id         String @id @default(uuid()) @db.Uuid
  employeeId String @map("employee_id") @db.Uuid
  weekday    Int    // 0=понедельник … 6=воскресенье
  startTime  String @map("start_time")  // "HH:mm", по образцу Property.checkInTime
  endTime    String @map("end_time")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId])
  @@map("working_hours")
}

model TimeOff {
  id         String    @id @default(uuid()) @db.Uuid
  employeeId String    @map("employee_id") @db.Uuid
  startAt    DateTime  @map("start_at") @db.Timestamptz(6)
  endAt      DateTime  @map("end_at") @db.Timestamptz(6)
  reason     String?

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, startAt, endAt])
  @@map("time_off")
}

enum AppointmentStatus {
  BOOKED
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum AppointmentSource {
  DESK
  PHONE
  WHATSAPP
  WALK_IN
  INSTAGRAM
  WEBSITE
  // без OTA — у Beauty нет аналога канал-менеджера (аудит §E.3)
}

model Appointment {
  id              String            @id @default(uuid()) @db.Uuid
  organizationId  String            @map("organization_id") @db.Uuid
  locationId      String            @map("location_id") @db.Uuid
  customerId      String            @map("customer_id") @db.Uuid
  employeeId      String            @map("employee_id") @db.Uuid
  beautyServiceId String            @map("beauty_service_id") @db.Uuid
  startAt         DateTime          @map("start_at") @db.Timestamptz(6)   // НЕ DATE — timestamptz
  endAt           DateTime          @map("end_at") @db.Timestamptz(6)
  status          AppointmentStatus @default(BOOKED)
  source          AppointmentSource
  price           BigInt            // снимок цены на момент записи, minor units
  notes           String?
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime          @updatedAt @map("updated_at") @db.Timestamptz(6)

  location      Location      @relation(fields: [locationId], references: [id])
  customer      Customer      @relation(fields: [customerId], references: [id])
  employee      Employee      @relation(fields: [employeeId], references: [id])
  beautyService BeautyService @relation(fields: [beautyServiceId], references: [id])

  @@index([employeeId, startAt, endAt])
  @@index([locationId, startAt])
  @@map("appointments")
}

-- Raw SQL в отдельной миграции, по образцу 20260909000003_rates_and_overbooking_guard:
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap_per_employee
  EXCLUDE USING gist (employee_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&);
```

`startAt`/`endAt` — **timestamptz, не DATE** (прямое требование пункта 4; отличие от `ReservationItem.arrivalDate/departureDate @db.Date`, `schema.prisma:258-259`).

### F.2 User ≠ Employee (пункт 5)

```
User/Membership  = доступ в WETOP (логин, роль в организации)
Employee         = сотрудник бизнеса, доступный для записи (bookable)
```

`Employee.userId` — **nullable**. Сотрудник может существовать без аккаунта WETOP (временный мастер, которого заводит администратор только для расписания — без логина). Bookable master в `Appointment.employeeId` — это **всегда `Employee.id`**, никогда `Membership`/`User.id` напрямую. Администратор салона может быть `User`+`Membership(role=STAFF)`, но не иметь строки `Employee` (не bookable). Мастер обычно имеет и то, и другое (`Employee.userId → User.id`), но это два разных факта в двух разных таблицах — ровно то разделение, которое просит аудит §10 и это задание.

### F.3 Customer ≠ Guest (пункт 6) — transitional design

- **`Customer`** — новая, generic, tenant-scoped (`organizationId` **NOT NULL** с первого дня — в отличие от `Guest`, у которого этой колонки вообще нет сегодня). Используется исключительно Beauty на этом этапе.
- **`Guest`** (`schema.prisma:328`) — **не трогаем** в этом плане, кроме P0-фикса из аудита (nullable `organizationId`, Фаза 1 плана миграции, см. §L) — это отдельная, уже запланированная работа по изоляции, а не часть Beauty-миграции.
- **Будущий, НЕ входящий в этот план переход Hospitality → Customer** (описываем, чтобы не потерять путь): добавить `Guest.customerId` nullable FK → `Customer.id`; фоновая задача создаёт по одной строке `Customer` на каждого `Guest` (копия имени/телефона/почты) и линкует; новый Hospitality-код постепенно читает универсальные поля через `Guest.customer`, оставляя гражданство/документ на `Guest`. Это чисто additive, big-bang не требуется — но выполняется отдельным решением владельца, не в рамках подключения Beauty.

### F.4 BeautyService — не путать с существующим `Service`

Существующая модель `Service` (`schema.prisma:679-697`) — hospitality-специфична (`propertyId`-scoped, «доп. услуга к проживанию» — завтрак/трансфер/minibar). Новая `BeautyService` — это **отдельная таблица**, каталог продаваемых услуг салона со своей длительностью и ценой. Имена намеренно разные, чтобы не создавать иллюзию совместимости там, где её нет.

### F.5 BeautyResource / Workplace — только если реально нужно

**Рекомендация: не создавать на MVP.** В отличие от Hospitality (где продаваемая единица — Room/Bed — физически отделена от персонала, который её обслуживает), в салоне красоты узкое место бронирования обычно — сам мастер (`Employee`), а не кресло/кабинет: пока не выявлена реальная потребность в раздельном ограничении «кресло занято, даже если мастер свободен» (например, аппаратная процедура на одном устройстве вне зависимости от того, кто его использует), достаточно связки `Appointment → Employee`. Если такая потребность появится — добавляется `AppointmentResource` (join-таблица `appointmentId ↔ resourceId`) по образцу `Allocation`, отдельной аддитивной миграцией, без переписывания уже работающего `Appointment`.

### F.6 Booking / Resource — физически не объединять (пункты 7, 8)

- **Hospitality → `Reservation`/`ReservationItem`/`Allocation`** — без изменений.
- **Beauty → `Appointment`** — отдельная таблица, отдельный enum статусов, отдельный enum источника (см. F.1).
- Никакой единой Prisma-модели `Booking` не создаётся. Общее — только на уровне `packages/domain` (см. §G): паттерны статус-переходов, source-vocabulary (как TS-тип, не общий Prisma enum), хелперы диапазона времени, номер подтверждения, money-хелперы, collision-хелперы.
- Аналогично `InventoryUnit` **не переименовывается** в `Resource`. Hospitality продолжает использовать `InventoryUnit`. Если в будущем понадобится общий контракт — он на уровне TypeScript-интерфейса в `packages/domain` (например, `interface BookableSlot { start: Date; end: Date }`, которому структурно соответствуют и Allocation-математика, и Appointment-математика), не на уровне общей таблицы.

### F.7 Beauty Calendar — что переиспользуется, что строится отдельно

Из аудита §11/§12 (шахматка): переиспользуется — общие UI-примитивы (`apps/web/src/components/ui.tsx`), паттерн написания тестов на drag&drop (`apps/web/src/app/chessboard/drag-plan.test.ts` — как образец структуры теста, не код), сам принцип "grid по времени × колонки-ресурсы, с оверлап-детектом на уровне БД" (GiST exclusion — F.1). Не переиспользуется: `board-grid.tsx` и его API-контракт (`ChessboardUnit.kind`, `StayStatus`, day-гранулярность) — салонный календарь строится с нуля как новое дерево компонентов (`apps/web/src/app/schedule/*` или аналог), с колонками-мастерами и часовой, а не суточной, гранулярностью.

---

## G. Shared Platform Modules (закрывает часть пунктов 7, 8, 11, 16)

### G.1 Общие domain-примитивы (не общая таблица, а общий код в `packages/domain`)

| Примитив | Где сегодня | Целевое | Кто использует |
|---|---|---|---|
| Status-transition guards | `packages/domain/src/reservations/reservations.ts:89-145` (`assertCanCancel` и т.п.) | Общий хелпер `assertTransition(current, allowed[])`; Hospitality и Beauty оставляют свои тонкие обёртки (`assertCanCancelReservation`, `assertCanCancelAppointment`) поверх него | Оба, раздельные обёртки |
| Confirmation number | `packages/domain/src/reservations/reservations.ts:129-134` (сегодня хардкод +5ч, требует фикса — аудит P1) | `confirmationNumber(now, random, timezone)` — с параметром таймзоны вместо хардкода | Оба, с разными префиксами |
| Money-хелперы | `packages/domain/src/finance/finance.ts:74` (`parseMoney`) | Без изменений, переиспользуется как есть | Оба |
| Source vocabulary | `ReservationSource` (Prisma enum) | `AppointmentSource` — отдельный Prisma enum (F.1), но общий TS-тип объединяет пересечение значений для общих UI-компонентов (например, значка источника) | Оба, раздельные enum + общий тип для UI |
| Collision-хелперы | Логика внутри `buildChessboard()` (`packages/domain/src/chessboard/build.ts:139-198`) | Опционально — вынести чистую функцию `intervalsOverlap()`/`assertNoOverlap()` для клиентского предпросчёта конфликтов и в Hospitality, и в Beauty Calendar; DB-уровень (GiST) у каждой вертикали свой | Оба (необязательно, не блокер) |

### G.2 `IntegrationConnection` (пункт 11)

```prisma
enum IntegrationProvider {
  CHANNEX
  EMAIL
  WHATSAPP
}

model IntegrationConnection {
  id                    String              @id @default(uuid()) @db.Uuid
  organizationId        String              @map("organization_id") @db.Uuid
  locationId            String?             @map("location_id") @db.Uuid   // null = на всю организацию
  provider              IntegrationProvider
  credentialsEncrypted   Bytes               @map("credentials_encrypted")  // AES-256-GCM, как GuestDocument
  config                 Json?                                             // несекретные настройки
  status                 String              @default("ACTIVE")
  createdBy              String?             @map("created_by") @db.Uuid
  createdAt              DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt              DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  location     Location?    @relation(fields: [locationId], references: [id])

  @@unique([organizationId, locationId, provider])
  @@map("integration_connections")
}
```

Ownership: `CHANNEX` — обычно `locationId` задан (у каждого физического объекта свой листинг на OTA); `EMAIL`/`WHATSAPP` (для ИИ-продавца) — обычно `organizationId`-wide, `locationId = null`. Секреты хранятся зашифрованными по тому же паттерну, что уже применён к `GuestDocument.numberEncrypted` (AES-256-GCM) — **ни один секрет не выводится в открытом виде ни в этом документе, ни в коде миграции**. Значения ключей вписывает владелец (по правилу `CLAUDE.md`: «значения ключей вписывает только владелец»).

Миграция Luxx: одна строка `IntegrationConnection{provider:'CHANNEX', locationId:<Luxx's location>}`, куда владелец вручную переносит текущие `CHANNEX_API_KEY`/`CHANNEX_PROPERTY_ID` из `.env` (Фаза 8). До переноса `.env`-значения остаются рабочим fallback — **никакого big-bang**.

### G.3 Finance-арифметика

Переиспользуется как есть (`packages/domain/src/finance/finance.ts` — `folioBalance`, `assertAllocationsMatch`, `assertRefundWithin`, `parseMoney`), см. §K для решения о persistence-слое.

---

## H. Extension Model (закрывает пункт 17)

`Vertical` **не** является `OrganizationExtension`. Это разные оси: vertical определяет, какой domain у Location (что бронируется — номер или запись), extension — дополнительная платная возможность **внутри** этого domain.

```prisma
enum ExtensionKind {
  AI_SELLER
  CHANNEL_MANAGER      // NEW
  ONLINE_BOOKING       // NEW
  ADVANCED_ANALYTICS   // NEW
}
```

Добавление новых значений в `ExtensionKind` — аддитивная операция (`ALTER TYPE ... ADD VALUE`), **не путать с правилом «не расширять hotel-enum»**: то правило (пункт 3 задания) касается domain-enum'ов Hospitality (`InventoryUnitKind`, `AccommodationKind`), которые жёстко типизируют существующие таблицы бронирования; `ExtensionKind` изначально спроектирован как растущий список (`schema.prisma:1214-1216`, комментарий подтверждает единственное текущее значение — `AI_SELLER`), это его прямое назначение.

| Extension | HOSPITALITY | BEAUTY | Комментарий |
|---|---|---|---|
| `AI_SELLER` | ✅ (уже работает) | ✅ (требует правки `hotel_tools.py`→аналог для услуг, `knowledge/facts.py`, `_head()`-шаблона — аудит §F.2) | Один и тот же механизм расширения, разная реализация бота под каждой вертикалью |
| `CHANNEL_MANAGER` | ✅ | ❌ | UI предлагает переключатель только для Location с `vertical=HOSPITALITY` — валидация в форме, не ограничение схемы |
| `ONLINE_BOOKING` | ✅ (существующий `/w/book`-виджет) | ✅ (новый виджет на базе Appointment) | Общий флаг, разные backend-реализации |
| `ADVANCED_ANALYTICS` | ✅ | ✅ | Общая для обеих |

---

## I. Navigation/Config Architecture (закрывает пункты 12, 13, 14)

### I.1 Механизм конфигурации вертикали

```
apps/web/src/lib/verticals/
  ├── index.ts           — pickVertical(vertical): возвращает конфиг ниже
  ├── hospitality.ts     — navigation, sidebarSections, terminology, dashboardWidgets, onboardingSteps
  └── beauty.ts          — то же самое, для Beauty
```

`apps/web/src/lib/navigation.ts` в сегодняшнем виде становится содержимым `verticals/hospitality.ts` (без изменения структуры данных — `NavigationItem`/`SidebarSection`/`allowedItem`/`sidebarSectionsFor` остаются как есть, аудит подтвердил, что это уже чистый, переиспользуемый паттерн). `/auth/me` (уже отдаёт `access: NavigationAccess`) начинает дополнительно отдавать `vertical`, которое кладётся в `RequestActor` на бэкенде (§J).

### I.2 Навигация Hospitality (без изменений относительно текущей `sidebarSections`, `apps/web/src/lib/navigation.ts:214-274`, с косметическим приведением к списку из задания)

| Раздел | Текущий href |
|---|---|
| Сегодня | `/today` |
| Шахматка | `/chessboard` |
| Брони | `/reservations` |
| Гости | `/guests` |
| Номерной фонд | `/inventory` |
| Доступность | `/rooms/availability` |
| Тарифы | `/rates` |
| Каналы | `/channel-manager`, `/channels` |
| ИИ-продавец | `/ai-seller` |
| Сайт | `/analytics/setup` |
| Оплаты | `/finance` |
| Статистика | `/management/statistics` |
| Журнал | `/journal` |
| Настройки | `/hotel-settings` |

### I.3 Навигация Beauty (новая, по образцу структуры Hospitality)

| Раздел | Новый href (предложение) |
|---|---|
| Сегодня | `/today` (тот же route/shell, §I.4) |
| Расписание | `/schedule` |
| Записи | `/appointments` |
| Клиенты | `/customers` |
| Мастера | `/employees` |
| Графики | `/employees/working-hours` |
| Услуги | `/beauty-services` |
| Рабочие места | `/workplaces` (только если понадобится §F.5) |
| Онлайн-запись | `/analytics/setup` (тот же механизм, что и Hospitality-виджет, другой backend) |
| ИИ-продавец | `/ai-seller` (тот же раздел) |
| Оплаты | `/finance` (тот же раздел, другой источник данных — §K) |
| Статистика | `/management/statistics` |
| Журнал | `/journal` |
| Настройки | `/salon-settings` |

### I.4 Today/Dashboard (пункт 14)

Один route `/today`, один shell (KPI-грид, «требует внимания» — общие рамки из `components/ui.tsx`). Внутри — выбор набора виджетов по `vertical`:

```
apps/web/src/app/today/page.tsx
  → vertical === 'HOSPITALITY' ? <HospitalityTodayWidgets/>   (существующий, без изменений)
                                : <BeautyTodayWidgets/>         (новый)
```

Hospitality-виджеты (без изменений): Arrivals/Departures/Occupancy/Unpaid/Room status (`apps/web/src/app/today/{desk-strip,day-attention}.tsx`, backend `apps/api/src/desk`).
Beauty-виджеты (новые): Appointments today/Available slots/Masters working/No-show-cancelled/Revenue/Unpaid — новый backend-эндпоинт (`apps/api/src/beauty/today` или аналог), не расширение `apps/api/src/desk`.

### I.5 Терминология

Вместо переписывания текстов внутри каждого Hospitality-компонента (что запрещено пунктом 3 — не переписывать) — терминологический словарь только для **общих** компонентов интерфейса (заголовки KPI-виджетов на Today, generic empty-states), передаётся через React-контекст на уровне shell:

```ts
interface VerticalTerminology {
  customerLabel: string;   // «Гость» | «Клиент»
  bookingLabel: string;    // «Бронь» | «Запись»
  resourceLabel: string;   // «Номер» | «Мастер»
}
```

Hospitality-специфичные страницы (шахматка, брони, номера) продолжают использовать свои текущие хардкод-строки — они и не должны становиться «универсальными».

---

## J. Request/Tenant Context (закрывает пункты 9 и 10)

### J.1 Целевой `RequestActor`

```ts
interface RequestActor {
  userId: string | null;
  organizationId: string | null;
  locationId?: string | null;              // NEW
  vertical?: LocationVertical | null;      // NEW, производное от locationId
  role?: MembershipRole | null;
  platformAdmin?: boolean;
  organizationScope?: boolean;
  locationScope?: boolean;                  // NEW — аналог organizationScope для публичных путей конкретной Location (виджет записи Beauty)
}
```

Расширяет `apps/api/src/auth/request-context.ts:11-27` строго аддитивно — ни одно существующее поле не меняется, ни один существующий вызов `withSignedInUser`/`currentOrganizationId`/`hasSignedInActor`/`actorIsOwner` не требует правки.

### J.2 Выбор активной Location, хранение в сессии

Сегодня Organization ↔ Property — де-факто 1:1 (аудит §B.2), поэтому на первом этапе «активная локация» = единственная `Location` организации, точно так же, как сегодня резолвится `Property`:

```
organizationLocationRef(db) := db.location.findFirst({ where: { organizationId } })
```

Задел под будущее (не в Beauty MVP, но не блокируется): `Session` (`schema.prisma:1077-1095`) получает нужный **nullable** `activeLocationId` — `null` означает «резолвить единственную/дефолтную Location организации» (текущее поведение), явное значение — «сессия закреплена за конкретной Location» (когда у организации их несколько). Хранение — в самой строке `Session` (она уже в БД, не JWT), без изменения формата токена/куки.

### J.3 Цепочка проверки доступа

1. `SessionGuard` (`apps/api/src/auth/auth.guard.ts`) — как сегодня резолвит `SignedInUser` по токену, дополнительно читает `Session.activeLocationId` (если задано).
2. `AuthorInterceptor` (`apps/api/src/auth/author.interceptor.ts`) — кладёт `{userId, organizationId, locationId, vertical, role, platformAdmin}` в `AsyncLocalStorage`, как сегодня кладёт `organizationId` (без изменения механизма — тот же `withSignedInUser`).
3. **Membership↔Organization** — без изменений: `Membership` уже проверяется при логине (`schema.prisma:1061-1073`), составной PK допускает несколько организаций у одного пользователя — уже сегодня работает, не требует правок.
4. **Location↔Organization** — новый `apps/api/src/database/location-ref.ts` (по образцу `property-ref.ts`):
   ```ts
   export function assertLocationVisible(location: LocationRef): void {
     if (!actsForOrganization()) return;
     const organizationId = currentOrganizationId();
     if (organizationId !== null && location.organizationId === organizationId) return;
     throw new ForbiddenException(FOREIGN_LOCATION_MESSAGE);
   }
   ```
   — буквальная копия паттерна `assertPropertyVisible` (`property-ref.ts:46-51`), только для `Location`.
5. **Hospitality repositories получают Property** — без изменения точки вызова: `propertyRef(db, name)`/`propertyIdRef(db, name)` (уже используются в ~20 репозиториях) продолжают работать; внутри `organizationPropertyRef()` меняется реализация на «резолвить Location по organizationId, затем Property по `location.property`» — внешний контракт (`PropertyRef{id,name,organizationId,timezone}`) не меняется, поэтому ни один из ~20 вызывающих файлов не редактируется.
6. **Beauty repositories получают Location** — прямо, без Property: `organizationLocationRef(db)` (аналог `organizationPropertyRef`), новые Beauty-репозитории вызывают именно эту функцию.

### J.4 Tenant isolation P0 (пункт 10) — конкретные фиксы перед подключением второй вертикали

| Проблема (аудит) | Фикс | Где |
|---|---|---|
| `Guest` без `organizationId` | Добавить nullable-колонку, backfill через `StayGuest→ReservationItem→Reservation→Property→Organization` | `schema.prisma:328`, `apps/api/src/guests/guests.repository.ts` |
| `AuditLog` без `organizationId` | Добавить nullable-колонку, backfill через `User→Membership` на момент записи (для записей без `userId` — остаётся `null`, это правда, не пропуск) | `schema.prisma:507` |
| `ExternalEvent`/`ChannelOutbox` без property-scope | Добавить nullable `propertyId` (не `locationId` — это чисто Hospitality/Channex-понятия) | `schema.prisma:567,606` |
| Ключи интеграций в `.env` процесса | `IntegrationConnection` (§G.2), перенос значений владельцем | `apps/api/src/channels/connection.ts` |
| `LUXX_APARTS_PROPERTY`-фоллбэк, 16-20 файлов | Замена на явный `propertyId`/`locationId` из контекста; service-пути (сторож/синк) переходят с «одного объекта» на «перебрать все объекты» | список файлов — аудит §F.1(B) |
| Хардкод +5ч (Asia/Almaty) в трёх местах | Параметр `timezone` вместо литерала | `packages/domain/src/reservations/reservations.ts:129-134`, `packages/domain/src/incidents/alerts.ts:51-53`, `apps/api/src/guard/guard.service.ts:80,496,578,751` |

Порядок (детально — §L Фаза 1): это единственный явно поставленный **гейт перед** тем, как к платформе может быть привязан второй реальный tenant (второй объект Hospitality или первый Beauty-салон за пределами внутреннего пилота владельца).

### J.5 Решение по PostgreSQL RLS — откладываем, с условиями

**Решение: откладываем**, не делаем частью подготовки к подключению Beauty.

**Обоснование:**
1. Прикладные P0-фиксы (J.4) закрывают конкретные, продемонстрированные пути утечки (`Guest`, `AuditLog`, резолюция по имени) без RLS — этого достаточно для внутреннего пилота Beauty под управлением владельца.
2. RLS требует прокидывать роль/session-переменную через каждое подключение Prisma (что нетривиально с Supabase pooler — `TESTING.md` уже фиксирует грабли с пулером) и трогает дисциплину каждой будущей миграции — цена несоразмерна текущему масштабу (один Hospitality-tenant, один пилотный Beauty-tenant, оба фактически под контролем владельца).
3. Этот выбор согласован с уже принятой в проекте позицией: ADR-056/ADR-061 уже говорят «продавать установку второму объекту нельзя без RLS» — данный план не открывает самостоятельную продажу третьим лицам, значит формальное условие ADR не нарушается.

**Условия, при которых RLS становится обязательным (не опциональным hardening, а блокером перед запуском):**
- (a) Момент, когда регистрация открывается внешним организациям, не находящимся под непосредственным контролем владельца (настоящий self-serve SaaS, не «вторая точка того же владельца» и не «пилотный салон-партнёр»).
- (b) Момент появления второго платящего тенанта, чьи персональные данные владелец не может лично гарантировать (реальные ПД клиентов за пределами Luxx).
- (c) Если после Фазы 8 (§L) список «service walker»-файлов, требующих ручного разбора по каждому новому tenant, окажется практически неисчерпаемым (симптом того, что дисциплина не держит) — тогда RLS обязателен как страховка именно от класса ошибок «забыли WHERE».

До срабатывания (a)/(b)/(c) — RLS остаётся в бэклоге, не блокирует Beauty MVP.

---

## K. Finance Integration Decision (закрывает пункт 16)

**Проблема:** `Folio.reservationItemId` — `@unique` (`schema.prisma:663-677`), жёсткая связь 1:1 с Hospitality-сущностью. Нужно подключить `Appointment` к `Folio`/`Charge`/`Payment`/`Refund` без зависимости Beauty от `ReservationItem`.

### Вариант 1 — Polymorphic Folio (быстрый путь)

```prisma
model Folio {
  ...
  reservationItemId String? @unique
  appointmentId      String? @unique
  // CHECK: ровно одно из двух заполнено
}
```

- **Плюсы:** минимум миграций, `folioBalance()` и остальная арифметика работают без изменений, быстро разблокирует Beauty-оплаты.
- **Минусы:** `Folio` начинает «знать» про обе вертикали; при третьей вертикали — снова новая nullable-колонка + правка CHECK на общей таблице (не масштабируется); `Payment.propertyId` (`schema.prisma:726`) остаётся hospitality-именованной колонкой, для Beauty потребуется параллельная `locationId`.

### Вариант 2 — Generic `BillingAccount` (рекомендуемый для устойчивой архитектуры)

```prisma
enum BillingAccountKind {
  HOSPITALITY_FOLIO
  BEAUTY_APPOINTMENT
}

model BillingAccount {
  id             String             @id @default(uuid()) @db.Uuid
  organizationId String             @map("organization_id") @db.Uuid
  locationId     String             @map("location_id") @db.Uuid
  kind           BillingAccountKind
  status         FolioStatus        @default(OPEN)
  currency       String             @db.Char(3)
  createdAt      DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)
  closedAt       DateTime?          @map("closed_at") @db.Timestamptz(6)

  charges Charge[]
  // Payment/PaymentAllocation/Refund — репривязка к billingAccountId вместо folioId
}

model Folio {
  id               String @id @default(uuid()) @db.Uuid
  reservationItemId String @unique @map("reservation_item_id") @db.Uuid
  billingAccountId  String @unique @map("billing_account_id") @db.Uuid
  // тонкий bridge, Hospitality-специфика не уходит из кода вызова — reservationItem.folio работает как раньше
}

model AppointmentBilling {
  id             String @id @default(uuid()) @db.Uuid
  appointmentId  String @unique @map("appointment_id") @db.Uuid
  billingAccountId String @unique @map("billing_account_id") @db.Uuid
}
```

- **Плюсы:** доводит до логического конца то, что аудит уже нашёл — `folioBalance`/`assertAllocationsMatch`/`assertRefundWithin`/`parseMoney` (`packages/domain/src/finance/finance.ts`) уже не привязаны к Reservation по сути; этот вариант убирает последнюю привязку и на уровне таблиц. Масштабируется на третью вертикаль без повторной правки `Folio`/`Appointment`.
- **Минусы:** больше миграционной работы сразу (новая таблица + backfill трёх существующих таблиц `Charge`/`Payment`/`PaymentAllocation`/`Refund` с `folioId`→`billingAccountId`, окно совместимости, отдельная репривязка `Payment.propertyId`).

### Рекомендация

**Для первого Beauty-пилота — Вариант 1** (быстро, низкий риск, разблокирует оплаты без промедления). **Вариант 2 — инвестировать только тогда, когда на горизонте реально появится третья вертикаль** — тогда цена доведения до конца оправдана. Это осознанный компромисс, а не technical debt по недосмотру — фиксируется явно как решение владельца в Фазе 6 плана (§L), с обоими вариантами перед глазами.

---

## L. Migration Plan по PR/Phase (закрывает пункты 18, 19)

Правило по всем фазам: только additive-миграции, никаких переименований существующих Hospitality-таблиц/enum, каждая фаза — отдельный PR (или несколько маленьких), откат — удаление добавленного, не восстановление удалённого.

| Phase | Что меняется (schema/backend/frontend) | Backfill | Compat-окно | Тесты | Rollback | Production risk |
|---|---|---|---|---|---|---|
| **0. Решения** | Только документы: `DATA_MODEL.md` v2.0 draft (Location/Vertical/Customer/Employee/…); решение владельца по §K (Вариант 1 vs 2) и §J.5 (RLS — откладываем) | — | — | — | — | Нет (бумага) |
| **1. P0-изоляция** | Schema: nullable `Guest.organizationId`, `AuditLog.organizationId`, `ExternalEvent.propertyId`, `ChannelOutbox.propertyId`. Backend: заполнение при новых записях (`guests.repository.ts`, `audit.module.ts`, `channels.repository.ts`) | Скрипт backfill по цепочкам связей; неоднозначные строки — в отдельный отчёт на ручной разбор | Колонки nullable, старые строки могут остаться `null` | Расширение `tests/integration/organization-isolation.test.ts` на 4 новые таблицы — красный до, зелёный после | Удалить колонки (чисто additive) | Низкий — только новые колонки, поведение Luxx не меняется |
| **2. Location** | Schema: `Location`, `LocationVertical`, nullable `Property.locationId`. Backend: `location-ref.ts`; внутренняя реализация `organizationPropertyRef()` переключается на путь через Location (внешний контракт не меняется) | Для Luxx — одна строка `Location`, backfill `properties.location_id` (см. §D.3) | `Property.organizationId` остаётся рабочим и верным до Фазы 8 | Новые тесты `location-ref.test.ts` по образцу `property-ref.test.ts`; весь текущий Hospitality-сьют должен остаться зелёным без единой правки — это и есть доказательство прозрачности | Удалить `Location` + колонку `Property.locationId` | Низкий — 0 изменений поведения для Luxx |
| **3. Request context** | Backend: `RequestActor` +`locationId`/`vertical`; `auth.guard.ts`/`author.interceptor.ts` их заполняют; `/auth/me` отдаёт `vertical`. Frontend: типы сессии получают `vertical` (используется только Фазой 7) | — | — | Тесты auth/session — расширены проверкой нового поля, ничего существующего не ломается | Откат интерсептора/guard (без изменения схемы) | Низкий |
| **4. Онбординг split** ⚠️ behavior change | Backend: `AuthService.register()` перестаёт безусловно создавать `Property` — создаёт только `Organization`+`User`+`Membership`; новый шаг «создать первую Location» с выбором vertical; HOSPITALITY-выбор запускает существующий `hotel/onboarding.ts` без изменений внутри; BEAUTY-выбор — новый `BeautyOnboardingService`. Frontend: шаг выбора vertical перед существующей формой категорий | — | Существующие организации (Luxx) не задеты — меняется только флоу новых регистраций | `auth.service.test.ts` — тест создания Property убирается/переносится; новый тест шага «первая Location»; существующие тесты онбординга Hospitality — зелёные без изменений (`buildHotelSetupPlan` вызывается тем же образом, просто на шаг позже) | Откат одной функции `register()` | Средний — первое видимое изменение для новых сигнапов; смягчается тем, что `REGISTRATION_OPEN=0` на проде (Q-157) — есть окно проверить без риска для внешних пользователей |
| **5. Beauty-схема** | Schema только: `Customer`, `Employee`, `BeautyService`, `EmployeeService`, `WorkingHours`, `TimeOff`, `Appointment`+enums, GiST exclusion (raw SQL, как в `20260909000003`). Backend: только генерация Prisma-клиента, без API | — | — | Новые `packages/domain/src/appointments/*.test.ts` по образцу `reservations.test.ts` — red→green по новому модулю | Дроп новых таблиц (на них ничего не ссылается) | Нет — инертное добавление схемы |
| **6. Finance-решение (§K)** | Владелец выбирает Вариант 1/2; Schema+backend по выбору | Backfill только при Варианте 2 (репривязка Charge/Payment/PaymentAllocation/Refund) | При Варианте 2 — старая `folioId`-колонка держится deprecated до полной проверки | Расширение finance-тестов на Appointment-путь; Hospitality finance-тесты — зелёные без изменений | Additive (Вариант 1) / удаление новой таблицы+колонок (Вариант 2) | Низкий (В1) / средний (В2, из-за backfill трёх таблиц) |
| **7. Beauty backend+frontend** | Backend: `apps/api/src/beauty/*` (customers/employees/services/working-hours/appointments/today/schedule) — по образцу `apps/api/src/{guests,reservations,inventory,rates,finance,desk}`, только через `location-ref.ts`. Frontend: новые routes, `verticals/beauty.ts`, Beauty Calendar (новое дерево компонентов), Beauty-онбординг форма | — | — | Полный параллельный сьют (create/move/extend appointment, availability, org isolation, аналог check-in) — тот же DoD-паттерн, что у исходного MVP (`SPEC.md`) | Удаление модуля + одна строка подключения навигации | Средний — новая пользовательская поверхность, но почти полностью изолирована от Hospitality-кода |
| **8. IntegrationConnection + отказ от Luxx-фоллбэка** | Backend: `IntegrationConnection` (§G.2); перенос ключей Luxx владельцем; замена `LUXX_APARTS_PROPERTY`-резолюции на явный `propertyId`/`locationId` в ~16-20 файлах, по одному PR на файл/группу; сторож/синк переходят на «перебрать все объекты»; убрать хардкод +5ч (`reservations.ts`, `alerts.ts`, `guard.service.ts`) → параметр `timezone`; дроп `Property.organizationId` (заменена на `Location.organizationId`) | — | Каждый файл — свой маленький PR, независимый откат | `organization-isolation.test.ts` — расширение на синтетический второй Hospitality-объект, доказывающее, что фоллбэк реально снят | По файлу — независимо | Низкий по каждому PR; вся фаза — предпосылка для реального второго объекта, стоит проверить на пилоте перед тем, как открывать Beauty вовне |
| **9. RLS (условно)** | Не входит в базовый путь плана; отдельный backlog-пункт с условиями триггера (§J.5) | — | — | — | — | — |

## M. Acceptance Criteria по каждой фазе

| Phase | Acceptance criteria |
|---|---|
| 0 | `DATA_MODEL.md` v2.0-черновик утверждён владельцем; решения по §K и §J.5 записаны как ADR |
| 1 | `organization-isolation.test.ts` зелёный на всех 4 новых колонках; backfill-отчёт показывает 0 неоднозначных строк или явный список на ручной разбор |
| 2 | Весь существующий Hospitality-тест-сьют (unit/integration/e2e) зелёный без единой правки тестового кода под Location; сверка Luxx (88/88, цены, балансы — контрольные числа `CLAUDE.md` §6) — без расхождений |
| 3 | `/auth/me` отдаёт `vertical:'HOSPITALITY'` для Luxx; ни один существующий тест auth/session не изменил ожидаемый результат |
| 4 | Новый сигнап проходит путь Organization→Location(выбор vertical)→онбординг без создания Property до явного выбора HOSPITALITY; существующая учётная запись Luxx проходит вход и работу без изменений |
| 5 | Все новые unit-тесты Beauty-домена красные до миграции, зелёные после; ни одна существующая таблица не тронута (проверка по `git diff` миграции) |
| 6 | Appointment получает Folio (по выбранному варианту); Hospitality Folio-тесты — без регрессий |
| 7 | Полный параллельный DoD-сьют Beauty зелёный (по аналогии с `SPEC.md`'s Definition of Done); ручная проверка одного полного дня записи в салоне (аналог «параллельный день» из Hospitality Gate 8) |
| 8 | `grep -rn LUXX_APARTS_PROPERTY apps/api/src` → 0; синтетический второй Hospitality-объект в тестах не видит и не блокирует данные первого; ключи Channex/почты Luxx читаются из `IntegrationConnection`, не из `.env` |
| 9 (условно) | Не применимо, пока не выполнено одно из условий §J.5 |

---

## Итог

Документ закрывает все 20 пунктов задания без единой строки кода и без единого изменения существующей Hospitality-схемы/логики. Главный архитектурный инвариант, который делает это возможным: **`Property` не переименовывается и не трогается — она получает нового родителя (`Location`) через одну nullable-колонку**, а весь путь резолюции объекта для Hospitality (`property-ref.ts`) продолжает работать по тому же внешнему контракту, каким пользуются уже ~20 файлов сегодня. Beauty строится как параллельный bounded context на этом фундаменте, с явным решением владельца, отложенным до реальной необходимости, только в двух местах: способ подключения Appointment к финансам (§K) и момент, когда RLS становится обязательным (§J.5).
