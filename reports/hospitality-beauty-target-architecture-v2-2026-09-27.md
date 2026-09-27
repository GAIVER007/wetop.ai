# WETOP — целевая архитектура v2: Organization → Business → Location

**Дата:** 27.09.2026
**Основание:** `reports/hospitality-beauty-target-architecture-2026-09-27.md` (v1) + новое требование владельца — вставить `Business` между `Organization` и `Location`.
**Статус:** проектный документ. Код не менялся, миграции не запускались, схема не трогалась.
**Отношение к v1:** этот документ **не отменяет** v1, а расширяет его. Всё, что v1 уже решил и что здесь не упомянуто как изменённое, действует без изменений (в первую очередь — главный инвариант: `Property` не переименовывается и не переписывается, сохраняет все текущие ID/FK на `Reservation`/`InventoryUnit`/`RatePlan`/`ChannelMapping`).

---

## 0. Изменения относительно v1 (сводка)

| # | Было (v1) | Стало (v2) | Причина |
|---|---|---|---|
| 1 | `Organization → Location → vertical` | `Organization → Business → Location`, `vertical` на `Business` | Прямое требование: Business = направление/бренд (сеть отелей, сеть салонов), Location = конкретный филиал |
| 2 | `Location.vertical` — единственный источник | `Business.vertical` — канонический источник; `Location.vertical` остаётся, но как **денормализованная неизменяемая копия** (тот же приём, что уже применён к `Session.organizationId`, денормализованному от `Membership` при логине) | Не заставлять каждый read-путь, уже спроектированный в v1 вокруг `location.vertical`, добавлять join к `Business` |
| 3 | `RequestActor{organizationId, locationId, vertical}` | + `businessId`, + `scope: ORGANIZATION\|BUSINESS\|LOCATION` | Executive dashboard всей компании и агрегированная аналитика сети требуют более широкого scope, чем один Location |
| 4 | Аналитика не описана отдельным разделом | Новый раздел: агрегация Location → Business → Organization, universal-метрики на Organization, vertical-KPI только на Business | Прямое требование (пункт 4) |
| 5 | Folio/Payment = единственный финансовый контур | Новый управленческий слой `FinancialCategory`/`ManagementFinanceEntry` поверх операционного Folio/Payment, не вместо него | Folio — операционный биллинг гостя/клиента, не P&L компании (пункт 5) |
| 6 | Одна валюта на объект (`Property.currency`) | `Organization.reportingCurrency` + `ExchangeRate` + `reportingAmount`-снимок на управленческих записях | Сеть в нескольких странах (KZT/AED/USD) требует консолидации (пункт 6) |
| 7 | `Employee.locationId` — NOT NULL, один филиал | `Employee.businessId` — NOT NULL; новая `EmployeeLocation` (N:M) — мастер работает в нескольких филиалах; `WorkingHours` переезжает с `Employee` на `EmployeeLocation` | Сетевой мастер, разные часы в разных филиалах (пункт 7) |
| 8 | `BeautyService.locationId` — своя копия на каждый салон | `BeautyService.businessId` — единый каталог сети; новая `LocationService` (N:M) — вкл/выкл, переопределение цены/длительности на филиал | Не плодить копии услуги на каждый салон (пункт 8) |
| 9 | Роли — только `Membership.role: OWNER\|STAFF` на Organization | Модель явно не блокирует будущую `MembershipScope` (Business Manager / Location Manager / Employee-self) — **не реализуется в этой фазе**, но структура готова | Пункт 9: «не обязательно реализовывать granular RBAC сейчас, но модель не должна этому препятствовать» |
| 10 | `OrganizationExtension` — единственная запись, вкл/выкл на всю организацию | `OrganizationExtension` (entitlement, куплено ли вообще) отделён от новой `ExtensionActivation` (где именно включено — Business или Location) | Пункт 10: организация может купить `AI_SELLER`, но включить только на части сети |
| — | Миграционный план — 9 фаз | Вставлена новая фаза «Business» сразу после фазы «Location»; фаза «Онбординг» расширена созданием первого Business | См. §L2 |

**Не изменилось (подтверждено явно):** `Property` — не переименовывается, не переписывается, её текущие FK на `Building/AccommodationType/Reservation/RatePlan/ChannelMapping/Payment/Service/TrackedSite/InventoryUnit` не трогаются (`schema.prisma:24-63`). `Reservation`/`ReservationItem`/`Allocation` — без изменений. `InventoryUnitKind`/`AccommodationKind` — без новых значений. Booking (`Reservation` vs `Appointment`) и Resource (`InventoryUnit` vs `Employee`) по-прежнему физически не объединяются.

---

## 1. Product Model (обновлено)

```
Platform Core
    │
    ├── Organization (tenant/workspace владельца — "Yuri Group")
    │       │
    │       ├── Business "Luxx Hotels"  (vertical = HOSPITALITY)
    │       │       ├── Location "Almaty"
    │       │       ├── Location "Astana"
    │       │       └── Location "Dubai"
    │       │
    │       └── Business "Luxx Beauty"  (vertical = BEAUTY)
    │               ├── Location "Marina"
    │               ├── Location "Downtown"
    │               └── Location "JVC"
    │
    ├── Extensions — Organization entitlement (OrganizationExtension)
    │              + Business/Location activation (ExtensionActivation, НОВОЕ)
    │
    └── Client Configuration/Data — конкретные строки Organization/Business/Location
```

Luxx Aparts в реальности сегодняшнего WETOP — это **одна** Organization с **одним** Business (vertical=HOSPITALITY) и **одной** Location. Схема допускает рост в обе стороны (несколько Business на Organization, несколько Location на Business) без изменения этой единственной сегодняшней строки — см. §L2 (миграция).

---

## 2. Organization / Business / Location / Vertical Model

### 2.1 Целевые модели

```prisma
enum LocationVertical {
  HOSPITALITY
  BEAUTY
}

model Business {
  id             String           @id @default(uuid()) @db.Uuid
  organizationId String           @map("organization_id") @db.Uuid
  vertical       LocationVertical
  name           String                                    // "Luxx Hotels", "Luxx Beauty"
  createdAt      DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  locations    Location[]

  @@index([organizationId])
  @@map("businesses")
}

model Location {
  id             String           @id @default(uuid()) @db.Uuid
  organizationId String           @map("organization_id") @db.Uuid   // денормализовано от Business, для проверок, которым Business не нужен
  businessId     String           @map("business_id") @db.Uuid       // NEW относительно v1
  vertical       LocationVertical                                    // денормализовано от Business.vertical, ИММУТАБЕЛЬНО (см. 2.2)
  name           String
  address        String?
  phone          String?
  email          String?
  timezone       String
  currency       String           @db.Char(3)
  createdAt      DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  business     Business     @relation(fields: [businessId], references: [id])
  property     Property?    // 1:1, только для vertical = HOSPITALITY — без изменений от v1

  @@index([organizationId])
  @@index([businessId])
  @@map("locations")
}
```

`Organization` — без изменений, кроме нового `reportingCurrency` (§6).

### 2.2 Почему `vertical` денормализован на `Location`, а не только на `Business`

Каноническое хранилище — `Business.vertical`. Но весь дизайн v1 (property-ref.ts, request-context.ts, навигация, Today-виджеты — §5, §7) уже читает `location.vertical` без join к Business на каждый запрос. Вариант «убрать колонку с Location и всегда join'иться к Business» создал бы N дополнительных join'ов на самом горячем пути (каждый запрос стойки). Вместо этого — тот же приём, что уже есть в текущей схеме: `Session.organizationId` денормализован от `Membership` при входе (аудит подтвердил это как существующий паттерн). Инвариант: `Location.vertical` **пишется один раз при создании Location** (копируется из `Business.vertical`) и никогда не обновляется — Location не может «переехать» из одного Business в другой с другим vertical (это была бы разрушительная операция данных, поэтому она и не предусмотрена).

### 2.3 Конкретный пример (Yuri Group) на целевой модели

```
Organization "Yuri Group"
  Business "Luxx Hotels" (vertical=HOSPITALITY)
    Location "Almaty"  → Property{legalName, bin, checkInTime, checkOutTime, ...} (без изменений от v1)
    Location "Astana"  → Property{...}
    Location "Dubai"   → Property{...}
  Business "Luxx Beauty" (vertical=BEAUTY)
    Location "Marina"
    Location "Downtown"
    Location "JVC"
```

Для сегодняшнего реального Luxx Aparts: `Organization{name:'Luxx Aparts'}` → один `Business{vertical:'HOSPITALITY', name:'Luxx Aparts'}` (авто-созданный при миграции, переименовываемый владельцем позже) → одна `Location{name:'Luxx Aparts'}` → существующая `Property`. Ни одна бронь, ни один платёж не переносится (см. §L2 Фаза 2.5).

---

## 3. Architecture Diagram (обновлено)

```
apps/web (shell)
  │  один route/shell Today, но выбор scope (Organization/Business/Location) определяет,
  │  что агрегируется (§7); выбор vertical (через активный Business) определяет виджеты/навигацию
  ▼
apps/api
  SessionGuard → AuthorInterceptor → RequestActor{organizationId, businessId?, locationId?,
                                                    vertical?, scope, role, platformAdmin}  (§5)
  │
  ├── scope=LOCATION  → как в v1: property-ref.ts (Hospitality) / location-ref.ts (Beauty)
  ├── scope=BUSINESS  → NEW: business-ref.ts — резолвит Business + агрегирует по всем его Location
  └── scope=ORGANIZATION → NEW: organization aggregate — агрегирует по всем Business организации
  │
  ▼
packages/domain
  Hospitality (не трогаем) / Beauty (v1, + сетевые EmployeeLocation/LocationService, §4)
  Shared: finance-арифметика + НОВОЕ: management-finance rollup, currency-конверсия
  ▼
packages/database
  Organization → Business (NEW) → Location → Property (не трогаем, §2.1)
  + НОВОЕ: FinancialCategory, ManagementFinanceEntry, ExchangeRate, EmployeeLocation,
           LocationService, ExtensionActivation
```

---

## 4. Database Diagram (обновлено)

```
Organization ──reportingCurrency
     │
     ├──1:N── Business ──vertical:{HOSPITALITY|BEAUTY}
     │            │
     │            ├──1:N── Location ──vertical (денормализовано, immutable)
     │            │            │
     │            │            ├──1:1(HOSPITALITY only)── Property (без изменений от v1/сегодня)
     │            │            └──1:N(BEAUTY only)── EmployeeLocation, LocationService, Appointment
     │            │
     │            ├──1:N(BEAUTY only)── Employee ──1:1(nullable)── User
     │            │                         │
     │            │                         ├──N:M── Location (через EmployeeLocation)
     │            │                         ├──1:N── TimeOff (по Employee, не по филиалу)
     │            │                         └──N:M── BeautyService (через EmployeeService)
     │            │
     │            └──1:N(BEAUTY only)── BeautyService ──N:M── Location (через LocationService)
     │
     ├──1:N── Membership ──role:{OWNER|STAFF} ──N:1── User
     ├──1:N── OrganizationExtension ──extension:{...}  (entitlement)
     │              └──1:N── ExtensionActivation ──businessId?|locationId?  (activation, NEW)
     ├──1:N── IntegrationConnection (без изменений от v1)
     ├──1:N── FinancialCategory (NEW)
     ├──1:N── ManagementFinanceEntry ──organizationId + businessId? + locationId? (NEW)
     └──1:N── ExchangeRate (NEW)

EmployeeLocation ──1:N── WorkingHours   (перенесено с Employee, теперь по паре employee+location)
```

---

## 5. Request/Tenant Context и Access Scopes (обновляет §J v1, закрывает пункты 3, 9)

### 5.1 Целевой `RequestActor`

```ts
type Scope = 'ORGANIZATION' | 'BUSINESS' | 'LOCATION';

interface RequestActor {
  userId: string | null;
  organizationId: string | null;
  businessId?: string | null;        // NEW
  locationId?: string | null;        // как в v1
  vertical?: LocationVertical | null;
  scope?: Scope;                     // NEW
  role?: MembershipRole | null;
  platformAdmin?: boolean;
  organizationScope?: boolean;
  businessScope?: boolean;           // NEW — публичные/агрегатные пути на уровне Business
  locationScope?: boolean;           // как в v1
}
```

Строго аддитивно к `apps/api/src/auth/request-context.ts:11-27` — ни одно поле v1 не меняется.

### 5.2 Резолюция по scope

| Scope | Что резолвится | Кто использует | Новый файл |
|---|---|---|---|
| `LOCATION` (по умолчанию, как в v1) | Одна `Location` (+`Property`, если HOSPITALITY) | Ежедневная операционная работа филиала — Today, шахматка/расписание, брони/записи | `property-ref.ts` (Hospitality, без изменений контракта) / `location-ref.ts` (Beauty, как в v1) |
| `BUSINESS` (NEW) | Одна `Business` + `db.location.findMany({ where: { businessId } })` | Executive dashboard сети (агрегированная аналитика по всем филиалам одного бренда) | `business-ref.ts` (NEW): `assertBusinessVisible()` — та же проверка `organizationId`, что и `assertLocationVisible` в v1 |
| `ORGANIZATION` (NEW) | `db.business.findMany({ where: { organizationId } })` → все Location транзитивно | Executive dashboard всей компании (Organization Owner) | Агрегатная функция поверх `business-ref.ts`, отдельного резолвера не требует |

Выбор активного scope/Business/Location — расширение уже предложенного в v1 §J.2 механизма: `Session` получает (кроме `activeLocationId` из v1) ещё `activeBusinessId` и `activeScope`. Для сегодняшней реальности (один Business, один Location) выбор тривиален и не требует UI-переключателя — переключатель нужен только когда у организации реально больше одного Business/Location.

### 5.3 Membership↔Organization, Business↔Organization, Location↔Business — проверки

- **Membership↔Organization** — без изменений от v1/сегодня (`Membership{userId,organizationId,role}`, `schema.prisma:1061-1073`).
- **Business↔Organization** — новая проверка `assertBusinessVisible()`, буквальная копия паттерна `assertPropertyVisible`/`assertLocationVisible`: `business.organizationId === currentOrganizationId()`.
- **Location↔Business** — при резолюции `Location` дополнительно проверяется `location.businessId` принадлежит `Business`, видимому этой организации (транзитивно через `assertBusinessVisible`, т.к. `Location.organizationId` денормализован и совпадёт по построению).

### 5.4 Access Scopes / роли (пункт 9) — модель, не реализация

Явно **не реализуется** в этой фазе (по прямому указанию задания), но модель не блокирует:

```
Organization Owner  = Membership.role = OWNER, без ограничений scope → видит весь Organization
Business Manager    = Membership.role = STAFF + (будущее) MembershipScope{scopeType:'BUSINESS', scopeId:<businessId>}
Location Manager    = Membership.role = STAFF + (будущее) MembershipScope{scopeType:'LOCATION', scopeId:<locationId>}, может быть несколько строк
Staff                = Membership.role = STAFF без MembershipScope → сегодняшнее поведение (ADR-023: все сотрудники равноправны)
Employee/Self        = самая узкая: доступ только к тем Location, где есть активная EmployeeLocation — не отдельная сущность доступа,
                        а естественное следствие уже существующей Beauty-модели (§6)
```

Будущая (не создаваемая сейчас) таблица:
```prisma
model MembershipScope {
  membershipUserId String
  membershipOrgId  String
  scopeType        String  // 'BUSINESS' | 'LOCATION'
  scopeId          String

  @@id([membershipUserId, membershipOrgId, scopeType, scopeId])
}
```
Отсутствие строк `MembershipScope` для Membership = «без ограничений в пределах роли» — то есть **сегодняшнее поведение сохраняется по умолчанию** без единой миграции данных, если/когда эта таблица будет создана.

---

## 6. Hospitality Bounded Context — без изменений

Всё как в v1 §E: `Property`/`AccommodationType`/`InventoryUnit`/`PhysicalRoom`/`Reservation`/`ReservationItem`/`Allocation`/`RatePlan`/`DailyRate`/`Restriction`/Housekeeping/`ChannelMapping`/Channex/Exely/eQonaq/Chessboard — не переписываются, не расширяются новыми enum-значениями. Единственное дополнение: `Property` теперь на два шага глубже от Organization (`Organization → Business → Location → Property`), но это прозрачно тем же образом, что и в v1 (§2.2 — резолвер меняется внутри, внешний контракт `PropertyRef` нет).

---

## 7. Beauty Bounded Context (обновляет v1 §F, закрывает пункты 7, 8)

### 7.1 Employee — сетевой (пункт 7)

```prisma
model Employee {
  id             String  @id @default(uuid()) @db.Uuid
  organizationId String  @map("organization_id") @db.Uuid
  businessId     String  @map("business_id") @db.Uuid    // ИЗМЕНЕНО от v1: было locationId (NOT NULL, один филиал)
  userId         String? @map("user_id") @db.Uuid         // nullable, без изменений от v1 (§F.2 v1)
  firstName      String  @map("first_name")
  lastName       String  @map("last_name")
  phone          String?
  email          String?
  active         Boolean @default(true)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  business  Business           @relation(fields: [businessId], references: [id])
  user      User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  locations EmployeeLocation[]
  services  EmployeeService[]
  timeOff   TimeOff[]
  appointments Appointment[]

  @@index([businessId])
  @@map("employees")
}

model EmployeeLocation {
  employeeId String  @map("employee_id") @db.Uuid
  locationId String  @map("location_id") @db.Uuid
  active     Boolean @default(true)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  employee     Employee       @relation(fields: [employeeId], references: [id])
  location     Location       @relation(fields: [locationId], references: [id])
  workingHours WorkingHours[]

  @@id([employeeId, locationId])
  @@map("employee_locations")
}

model WorkingHours {
  id         String @id @default(uuid()) @db.Uuid
  employeeId String @map("employee_id") @db.Uuid    // ИЗМЕНЕНО от v1: было прямой FK на Employee
  locationId String @map("location_id") @db.Uuid    // NEW — часы теперь per (employee, location)
  weekday    Int
  startTime  String @map("start_time")
  endTime    String @map("end_time")

  employeeLocation EmployeeLocation @relation(fields: [employeeId, locationId], references: [employeeId, locationId])

  @@index([employeeId, locationId])
  @@map("working_hours")
}

model TimeOff {
  // без изменений от v1 — остаётся по Employee целиком (отпуск действует во всех филиалах сразу)
  id         String   @id @default(uuid()) @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  startAt    DateTime @map("start_at") @db.Timestamptz(6)
  endAt      DateTime @map("end_at") @db.Timestamptz(6)
  reason     String?

  employee Employee @relation(fields: [employeeId], references: [id])
  @@map("time_off")
}
```

`Appointment.employeeId` не меняется по форме (по-прежнему указывает на `Employee.id`), но добавляется app-level инвариант (по образцу существующих guard-функций типа `assertRestrictionsAllow` в `packages/domain/src/reservations/reservations.ts`): **нельзя создать `Appointment` с `(employeeId, locationId)`, для которых нет активной `EmployeeLocation`** — мастер не может быть записан в филиал, где не работает. Реализуется как обычная бизнес-проверка в domain-слое, не как БД-constraint (по аналогии с тем, как в проекте уже устроены похожие межтабличные правила).

### 7.2 BeautyService — единый каталог сети (пункт 8)

```prisma
model BeautyService {
  id              String  @id @default(uuid()) @db.Uuid
  organizationId  String  @map("organization_id") @db.Uuid
  businessId      String  @map("business_id") @db.Uuid    // ИЗМЕНЕНО от v1: было locationId
  name            String
  durationMinutes Int     @map("duration_minutes")
  price           BigInt                                   // базовая цена сети, minor units, ADR-008
  category        String?
  active          Boolean @default(true)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  business  Business          @relation(fields: [businessId], references: [id])
  locations LocationService[]
  employees EmployeeService[]
  appointments Appointment[]

  @@index([businessId])
  @@map("beauty_services")
}

model LocationService {
  locationId              String  @map("location_id") @db.Uuid
  beautyServiceId         String  @map("beauty_service_id") @db.Uuid
  enabled                 Boolean @default(true)
  priceOverride           BigInt? @map("price_override")
  durationOverrideMinutes Int?    @map("duration_override_minutes")

  location      Location      @relation(fields: [locationId], references: [id])
  beautyService BeautyService @relation(fields: [beautyServiceId], references: [id])

  @@id([locationId, beautyServiceId])
  @@map("location_services")
}
```

`EmployeeService` (кто из мастеров умеет какую услугу) остаётся ровно как в v1 §F.1 — это внутренний для Business вопрос компетенции, не зависящий от филиала (мастер, работающий в двух филиалах одного Business, «умеет» одну и ту же услугу в обоих — вопрос «предлагается ли эта услуга в конкретном филиале и по какой цене» решает `LocationService`, а не `EmployeeService`). `Appointment.beautyServiceId` получает аналогичный app-level инвариант: должна существовать `LocationService{locationId: appointment.locationId, enabled:true}`.

### 7.3 Остальное — без изменений от v1

`Customer`, `AppointmentStatus`, `AppointmentSource`, `Appointment` (timestamp-based `startAt`/`endAt`, GiST exclusion по `employeeId`) — как в v1 §F.1, §F.3, §F.6. `Customer.organizationId` остаётся на уровне Organization (не Business) — клиент сети видим во всех Business/Location одной организации, что логично совпадает с реальностью (человек может быть клиентом и отеля, и салона одного холдинга).

---

## 8. Analytics Hierarchy (НОВЫЙ раздел, закрывает пункт 4)

### 8.1 Принцип: агрегация запросом, не дублирующим хранилищем

Аналитика на Business/Organization-уровне **не** хранится как отдельный источник правды — она считается агрегирующим запросом по тем же операционным таблицам, что уже существуют на Location-уровне (`Charge`/`Payment` для Hospitality — `packages/domain/src/dashboard/metrics.ts`; будущий Beauty-аналог). Это тот же принцип, которым в проекте уже защищена сверка (`CLAUDE.md` §6: «расхождение при сверке допускается нулевое») — вторая копия чисел означала бы второй источник, который может разойтись с первым.

```
Location-уровень   : существующие/новые Beauty-аналоги dashboard-запросов (без изменений от v1/сегодня)
Business-уровень    : те же запросы с WHERE location.business_id = X (JOIN по всем Location этого Business)
Organization-уровень: те же запросы с WHERE location.organization_id = X (JOIN по всем Location всех Business)
```

### 8.2 Universal-метрики (доступны на Organization-уровне)

Revenue, Expenses, Profit, Payments, Refunds, Customers, Employees — считаются одинаково независимо от vertical дочерних Business, поэтому осмысленно суммируются даже когда под одной Organization одновременно HOSPITALITY и BEAUTY.

### 8.3 Vertical-specific KPI (только на Business-уровне, никогда — на Organization-уровне при смешанных vertical)

| Hospitality (Business.vertical=HOSPITALITY) | Beauty (Business.vertical=BEAUTY) |
|---|---|
| Occupancy | Appointments |
| ADR | Average ticket |
| RevPAR | Utilization |
| Room nights | No-show |
| Reservations | Repeat customers |
| — | Master utilization |

Правило: на Organization-дашборде эти метрики **не показываются и не суммируются** между собой (Occupancy% отеля и Utilization% салона нельзя честно сложить в одно число) — Organization-уровень видит только universal-метрики (§8.2); vertical-KPI доступны только при выборе конкретного Business (`scope=BUSINESS`).

### 8.4 Когда материализовывать (не сейчас)

Если объём данных сделает live-агрегацию по всем Location медленной (тот же класс проблемы, который уже однажды решался в проекте — `property-ref.ts`'s комментарий про восьмикратный лишний рейс в базу на дашборде до кэширования), тогда — и только тогда — вводятся материализованные таблицы `BusinessMetricsDaily`/`OrganizationMetricsDaily`, заполняемые плановой задачей из тех же исходных данных. Не строить заранее (YAGNI) — это оптимизация производительности, а не архитектурная необходимость на старте.

---

## 9. Management Finance (НОВЫЙ раздел, закрывает пункты 5, 6)

### 9.1 Почему текущий Folio/Payment — не управленческий Finance

`Folio`/`Charge`/`Payment`/`Refund` (`schema.prisma:663-761`) — это **операционный биллинг** одного проживания/визита (выставить счёт гостю/клиенту, принять оплату). Управленческий Finance компании — это P&L, расходы на аренду/ФОТ/маркетинг, которых в биллинге гостя никогда не будет. Это разные слои, не заменяющие друг друга.

### 9.2 Новые модели

```prisma
enum FinancialCategoryKind {
  REVENUE
  EXPENSE
}

model FinancialCategory {
  id             String @id @default(uuid()) @db.Uuid
  organizationId String @map("organization_id") @db.Uuid   // каталог категорий общий на всю организацию
  kind           FinancialCategoryKind
  name           String                                     // «Аренда», «ФОТ», «Маркетинг», «Проживание», «Услуги»
  parentId       String? @map("parent_id") @db.Uuid          // опциональная иерархия («ФОТ» → «ФОТ мастеров»)
  active         Boolean @default(true)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@map("financial_categories")
}

model ManagementFinanceEntry {
  id             String                @id @default(uuid()) @db.Uuid
  organizationId String                @map("organization_id") @db.Uuid   // всегда задано
  businessId     String?               @map("business_id") @db.Uuid       // nullable — расход на весь Business
  locationId     String?               @map("location_id") @db.Uuid       // nullable — расход на конкретный Location
  categoryId     String                @map("category_id") @db.Uuid
  kind           FinancialCategoryKind                                     // денормализовано от category.kind
  amount         BigInt                                                    // integer minor units, ADR-008 без исключений
  currency       String                @db.Char(3)                        // валюта операции как есть
  exchangeRate   Decimal?              @db.Decimal(18, 8)                  // курс на occurredAt, снимок (§9.3)
  reportingAmount BigInt?              @map("reporting_amount")            // сумма в Organization.reportingCurrency, снимок
  occurredAt     DateTime              @db.Date
  source         String                                                    // 'MANUAL' | 'AUTO_FOLIO' | 'AUTO_APPOINTMENT'
  note           String?
  createdBy      String?               @map("created_by") @db.Uuid
  createdAt      DateTime              @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization       @relation(fields: [organizationId], references: [id])
  business     Business?          @relation(fields: [businessId], references: [id])
  location     Location?          @relation(fields: [locationId], references: [id])
  category     FinancialCategory  @relation(fields: [categoryId], references: [id])

  @@index([organizationId, occurredAt])
  @@index([businessId])
  @@index([locationId])
  @@map("management_finance_entries")
}
```

Правило scope (буквально по заданию): `locationId` задан → запись на конкретный филиал; только `businessId` задан → на весь Business; ни то ни другое → на всю Organization (например, аренда головного офиса).

### 9.3 Revenue — не ручной ввод, а синхронизация с операционными таблицами

Чтобы не возникло двух не совпадающих источников правды по выручке (риск, прямо противоречащий культуре проекта — «расхождение допускается нулевое»): строки `kind=REVENUE` создаются **автоматически** фоновой синхронизацией — одна `ManagementFinanceEntry{source:'AUTO_FOLIO'}` на каждый закрытый `Folio` (Hospitality) и одна `{source:'AUTO_APPOINTMENT'}` на каждый оплаченный `Appointment` (Beauty, после §K v1). Ручной ввод (`source:'MANUAL'`) зарезервирован за `kind=EXPENSE` — у расходов (аренда, ФОТ, маркетинг) нет операционной таблицы-источника.

### 9.4 P&L и Cash Flow — вычисляемые представления, не отдельные таблицы

```
P&L(scope, period)      = Σ ManagementFinanceEntry.reportingAmount WHERE kind=REVENUE, occurredAt ∈ period, scope
                         − Σ ManagementFinanceEntry.reportingAmount WHERE kind=EXPENSE, occurredAt ∈ period, scope
CashFlow(scope, period) = та же формула, но по фактической дате движения денег (Payment.paidAt), не по occurredAt (accrual)
```

Обе — запросы поверх `ManagementFinanceEntry` (+`Payment.paidAt` для Cash Flow), не новые модели.

### 9.5 Multi-currency reporting (пункт 6)

```prisma
model Organization {
  ...
  reportingCurrency String @default("KZT") @db.Char(3)   // NEW
}

model ExchangeRate {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  fromCurrency   String   @db.Char(3)
  toCurrency     String   @db.Char(3)               // = organization.reportingCurrency на момент снимка
  rate           Decimal  @db.Decimal(18, 8)
  asOf           DateTime @db.Date
  source         String?                              // 'MANUAL' на MVP; 'NBRK'/др. — будущее расширение

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, fromCurrency, toCurrency, asOf])
  @@map("exchange_rates")
}
```

**Оригинальная операция не трогается** — `amount`+`currency` на `Charge`/`Payment`/`Appointment`/`ManagementFinanceEntry` остаются как записаны (source of truth). `exchangeRate`+`reportingAmount` на `ManagementFinanceEntry` — это снимок, посчитанный один раз (в момент синхронизации/ввода, по курсу `asOf ≈ occurredAt`) и закэшированный, а не пересчитываемый на лету при каждом просмотре дашборда (иначе один и тот же исторический платёж показывал бы разные суммы в отчёте в зависимости от дня просмотра — прямое нарушение принципа «нулевое расхождение»). На MVP курсы вводятся вручную владельцем/финансистом (`source:'MANUAL'`); автоматическая подгрузка курсов (нацбанк и т.п.) — явно отложенное расширение, не требуется для первого запуска сети в нескольких валютах.

---

## 10. Extension Model (обновляет v1 §H, закрывает пункт 10)

### 10.1 Разделение entitlement / activation

`OrganizationExtension` (`schema.prisma:1213-1244`) — без изменений формы, становится **entitlement**: «организация вообще купила/пробует эту возможность». Новая модель — **activation**:

```prisma
model ExtensionActivation {
  id         String        @id @default(uuid()) @db.Uuid
  extension  ExtensionKind
  businessId String?       @map("business_id") @db.Uuid
  locationId String?       @map("location_id") @db.Uuid
  // CHECK: ровно одно из businessId/locationId задано
  active     Boolean       @default(true)
  createdAt  DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)

  business Business? @relation(fields: [businessId], references: [id])
  location Location? @relation(fields: [locationId], references: [id])

  @@unique([extension, businessId, locationId])
  @@map("extension_activations")
}
```

Правило: `ExtensionActivation` для данного `extension` валидна только если у организации есть `OrganizationExtension{extension, status: TRIAL|ACTIVE}` (entitlement первичен). **Обратная совместимость по умолчанию:** отсутствие строк `ExtensionActivation` для купленного расширения = «включено везде в организации» — то есть сегодняшнее поведение `AI_SELLER` (одна организация, один флаг) продолжает работать без единой миграции данных; `ExtensionActivation`-строки нужны только когда владелец реально хочет включить расширение выборочно.

### 10.2 Пример по заданию

- `CHANNEL_MANAGER` — куплен на уровне Organization (entitlement), но `ExtensionActivation` создаётся только для Business/Location с `vertical=HOSPITALITY` (app-level валидация формы — Business с vertical=BEAUTY этот пункт вообще не предлагает, по аналогии с v1 §H).
- `AI_SELLER` — может быть включён на части Business/Location: например, «Luxx Hotels» использует ИИ-продавца, «Luxx Beauty» — ещё нет (владелец создаёт `ExtensionActivation{extension:'AI_SELLER', businessId:<Luxx Beauty>, active:false}` явно, либо просто не создаёт активацию для этого Business — оба варианта равнозначны при выбранном умолчании «нет строки = включено везде»; если нужно **явное «выключено именно здесь»** при том что остальная организация включена — используется `active:false`).

---

## 11. Navigation/Config (краткое обновление v1 §I)

Не меняется механизм (`verticals/hospitality.ts` / `verticals/beauty.ts`, выбор по активному `Business.vertical`, §5.2). Добавляется:

- **Business/Location switcher** в shell (виден только когда у Organization больше одного Business или у Business больше одного Location — для сегодняшнего Luxx он не появляется, поведение идентично v1).
- **Executive-навигация** — новый пункт верхнего уровня «Организация» (по аналогии с текущим «Платформа», но для Organization Owner, не для главного администратора платформы) — показывает Organization-scope дашборд (§8.2) и Management Finance (§9); виден только при `scope=ORGANIZATION`-доступе (Organization Owner).

---

## 12. Migration Plan v2 (обновляет v1 §L)

Вставка новой фазы и правка одной существующей; остальные фазы v1 (1, 3, 5, 7, 8, 9) — без изменений по существу, только с оговоркой, что «Location» в их описании теперь также подразумевает «через Business».

| Phase | Что меняется | Backfill | Тесты | Risk |
|---|---|---|---|---|
| **2 (было в v1)** — Location | Без изменений от v1: `Location`, `LocationVertical`, `Property.locationId` | Для Luxx — одна `Location` | Как в v1 | Низкий |
| **2.5 (НОВАЯ)** — Business | Schema: `Business`; `Location.businessId` (NOT NULL после backfill), `vertical` переносится с Location на Business как каноническое хранилище (Location сохраняет денормализованную копию) | Для каждой существующей `Location` (на сегодня — только у Luxx) создаётся ровно один `Business{vertical: <текущий Location.vertical>, name: <organization.name или "Основной бизнес">}`, `location.businessId` проставляется | `business-ref.ts` тесты по образцу `location-ref.ts`; весь Hospitality-сьют — зелёный без изменений (доказательство прозрачности, как и в v1 Фазе 2) | Низкий — 0 изменений поведения для Luxx |
| **3 (было в v1)** — Request context | + `businessId`/`scope` в `RequestActor` (§5.1) | — | Расширение тестов auth/session | Низкий |
| **4 (было в v1)** — Онбординг split | Дополнительно: шаг «создать первый Business» перед «создать первую Location» (вместо «Организация → Location» теперь «Организация → Business(vertical) → Location») | — | Тесты онбординга обновляются на новый промежуточный шаг; существующая логика `hotel/onboarding.ts` не трогается | Средний, как и в v1 (то же окно — `REGISTRATION_OPEN=0` на проде) |
| **5 (было в v1)** — Beauty-схема | Модели Beauty сразу проектируются в сетевой форме (§7): `Employee.businessId`+`EmployeeLocation`, `BeautyService.businessId`+`LocationService` — **не** проектируются сначала «на один Location» с последующей переделкой | — | Новые unit-тесты на оба уровня (Employee↔Business, Employee↔Location через EmployeeLocation) | Нет (инертное добавление схемы) |
| **6 (было в v1)** — Finance-решение | Без изменений от v1 §K (Folio/Appointment) — управленческий Finance (§9 этого документа) — отдельная, независимая фаза, ниже | — | — | Как в v1 |
| **6.5 (НОВАЯ)** — Management Finance + Multi-currency | Schema: `FinancialCategory`, `ManagementFinanceEntry`, `ExchangeRate`, `Organization.reportingCurrency`. Backend: sync-джоба `AUTO_FOLIO`/`AUTO_APPOINTMENT` | Разовая загрузка стартовых категорий (типовой план: Аренда/ФОТ/Маркетинг/Проживание/Услуги) | Тест на то, что Σ `AUTO_FOLIO`-записей = Σ закрытых Folio за период (нулевое расхождение, как того требует культура проекта) | Средний — новая синхронизация должна быть доказана на исторических данных Luxx до включения на проде |
| **7 (было в v1)** — Beauty backend+frontend | + `EmployeeLocation`/`LocationService` UI (выбор филиалов мастера, вкл/выкл услуги по филиалу) | — | Полный сьют, как в v1, плюс тест «нельзя записать мастера в филиал, где он не работает» | Средний, как в v1 |
| **8 (было в v1)** — IntegrationConnection + отказ от Luxx-фоллбэка | Без изменений от v1 | — | Как в v1 | Как в v1 |
| **9.5 (НОВАЯ)** — Extension split | Schema: `ExtensionActivation`. Поведение по умолчанию (нет строк = включено везде) сохраняет сегодняшнее поведение `AI_SELLER` без миграции данных | — | Тест на дефолтное поведение (нет активаций → доступно всей организации) + тест на явное сужение | Низкий — аддитивно, обратная совместимость по построению |
| **10 (НОВАЯ, опционально)** — Analytics rollup материализация | Только если производительность live-агрегации (§8.4) окажется недостаточной | — | — | Не начинается без измеренной необходимости |

Правило по всем новым фазам — то же, что в v1: только additive, никаких переименований существующих Hospitality-таблиц, каждая фаза — отдельный PR, откат — удаление добавленного.

---

## Итог

Вставка `Business` между `Organization` и `Location` — аддитивная операция, не требующая переписывания ни одной уже спроектированной в v1 части: `property-ref.ts`, `Property` и её связи, Hospitality bounded context, Booking/Resource-разделение остаются как есть. Главные новые архитектурные решения этого документа: (1) `vertical` переносится на `Business`, с денормализованной неизменяемой копией на `Location` по уже существующему в проекте паттерну; (2) `Employee`/`BeautyService` становятся сетевыми (Business-level) с явными join-таблицами (`EmployeeLocation`/`LocationService`) для филиального переопределения; (3) аналитика — вычисляемая агрегация, а не дублирующее хранилище; (4) управленческий Finance — новый слой поверх, а не замена операционного Folio/Payment, с автосинхронизацией выручки во избежание расхождения; (5) entitlement и activation расширений разведены с обратной совместимостью по умолчанию.
