# WETOP Target Architecture v3

> **СТАТУС: УТВЕРЖДЁН владельцем 27.09.2026 и ЗАМОРОЖЕН** («ТЗ на Главную утверждаю… архитектура v3
> уже утверждена и заморожена»; в поручении решение названо прежним номером ADR-100 — при слиянии с `main`
> оно перенумеровано дважды — итоговый номер ADR-104, политика ADR-052). Архитектурная модель зафиксирована; изменения — только
> новой версией документа через решение владельца.
> Основание — задача владельца от 27.09.2026: до начала реализации Beauty и до изменения существующих
> продуктовых модулей зафиксировать архитектуру WETOP как платформы, к которой подключаются независимые
> бизнесы-партнёры. Модель данных — `DATA_MODEL.md` §18–§19 (v2.0, утверждена тем же решением; §17 занял RLS,
> v1.13), решение — `DECISIONS.md` ADR-104. Развилки Q-197 и Q-198 закрыты 27.09 freeze-решениями владельца
> (ветка `claude/hopeful-thompson-2v8v8a`): курсы — вручную на Organization со снимком на дату операции;
> Customer — на Organization со связкой `CustomerBusiness` (§19 приводится к этому при плане фазы Beauty).
> Реализация — по фазам (§20); первым идёт этап А ТЗ Главной (`plans/tz-today-2026-09-27.md`).
>
> Версии v1–v2 целевой архитектуры жили в обсуждениях владельца вне репозитория. Это первая редакция
> документа в репозитории; номер v3 продолжает счёт владельца.
>
> **Единственная корневая редакция (27.09.2026).** Параллельная сессия (ветка `claude/hopeful-thompson-2v8v8a`,
> PR #98) вела свой корневой `ARCHITECTURE.md` — краткую замороженную сводку тех же иерархии и решений
> (ADR-100-заморозка). По указанию владельца от 27.09 обе редакции сведены в этот файл: сводка встроена ниже
> разделом «Замороженные решения», второй корневой файл упразднён. Полные документы той линии остались в
> `reports/`: аудит AS-IS (`beauty-vertical-audit-2026-09-27.md`), целевая архитектура v1 и v2
> (`hospitality-beauty-target-architecture{,-v2}-2026-09-27.md` — там же пофазный план миграции, §12).

---

## Замороженные решения владельца (27.09.2026, ADR-100-заморозка)

Четыре финальных решения, зафиксированные при утверждении («Архитектуру в целом утверждаю») — из сводки
линии `claude/hopeful-thompson-2v8v8a`, дословно по смыслу. При расхождении деталей разделов ниже с этим
блоком прав этот блок.

### Решение 1 — RLS / регистрация (gate)

До публичного self-service подключения внешних организаций **PostgreSQL Row Level Security — обязательный
gate**. До его включения разрешены только вручную подключённые Partner/пилоты, и только после закрытия
текущего P0-долга изоляции (Phase 1: tenant-scope у `Guest`/`AuditLog`/`ExternalEvent`/`ChannelOutbox` —
закрыта 27.09.2026, миграция применена на рабочей базе; остаток P0: ключи интеграций per organization,
снятие Luxx-фоллбэка). Публичная регистрация до выполнения условия не открывается (`REGISTRATION_OPEN=0`
в силе; согласуется с ADR-056/ADR-061/ADR-099 и ADR-102 п.4).

### Решение 2 — Customer / CustomerBusiness

Канонический `Customer` хранится на уровне **Organization** (один клиент группы). Связь и видимость клиента
в конкретном Business — join-сущность **`CustomerBusiness`** (`customer_id + business_id`, создаётся при
первом обращении клиента в этот Business). Business-scoped сотрудники видят только клиентов со строкой
своего Business; Organization Owner — канонического клиента целиком. Существующий Hospitality `Guest`
не ломается; переход Hospitality на Customer — отдельное будущее решение, additive.

### Решение 3 — Exchange Rates

`reportingCurrency` и политика курсов принадлежат **Organization**. На MVP `ExchangeRate` вводится вручную
и используется всеми Business организации. Исторический `reportingAmount` фиксируется **снимком по курсу
на дату операции** и не пересчитывается при просмотре. Оригинальные `amount`+`currency` операции
неприкосновенны (ADR-008 — деньги integer minor units, включая `reporting_amount`).

### Решение 4 — Management Revenue idempotency

Автоматические `ManagementFinanceEntry` (выручка из закрытых Folio / оплаченных Appointment) обязаны нести
`sourceType` (`FOLIO` | `APPOINTMENT` | `MANUAL`) + `sourceId` с `UNIQUE(source_type, source_id)` — повторный
запуск sync-job не создаёт дубль Revenue (у `MANUAL` `sourceId` пуст; NULL в Postgres не конфликтует в UNIQUE).

### Что «заморожено» означает практически

- Иерархия `WETOP → Partner/Organization → Business → Location → Vertical Domain` не пересматривается.
- Изменения внутри слоёв идут обычным порядком: правка `DATA_MODEL.md` → утверждение владельцем → миграция
  (AGENTS.md §2, §15) — но не трогают саму иерархию.
- Главный инвариант перехода: `Property` не переименовывается и не переписывается, получает `Location`
  родителем через одну nullable-колонку; существующие FK не трогаются; hotel-enum'ы (`InventoryUnitKind`,
  `AccommodationKind`) не расширяются значениями других вертикалей; `Reservation` (Hospitality) и
  `Appointment` (Beauty) — разные таблицы.
- Реализация — по фазам (§20 и план v2 §12): Phase 1 — P0-изоляция (закрыта 27.09.2026); каждая фаза —
  additive, со своими тестами и откатом.

---

## 1. WETOP vs Partner vs Business vs Location

Раздел, ради которого термины больше нигде в проекте не смешиваются. При любом расхождении с другим
документом прав этот раздел.

| Термин | Что это | Чем НЕ является |
|---|---|---|
| **WETOP Platform** | Сама SaaS-платформа. Управляется Platform Admin (главным администратором, `platform_admins`) | Не гостиница, не салон, не Luxx Aparts, не одна из Organization |
| **Partner / Партнёр** | Внешняя компания-клиент, подключённая к WETOP: Luxx Group, Beauty Holding, Hotel Company X. Для самого клиента это «Компания» | Не отдельная таблица: в базе это `Organization` |
| **Business / Бизнес** | Направление или бренд внутри партнёра: Luxx Hotels, Luxx Beauty. Именно Business определяет вертикаль (`Business.vertical`) | Не объект и не филиал; не часть Hospitality-домена |
| **Location / Филиал** | Конкретный филиал бизнеса: Almaty, Astana, Marina | Не носитель вертикали: вертикаль у Business |
| **Vertical / Вертикаль** | Какой домен использует Business: `HOSPITALITY` или `BEAUTY` | Не расширение (§14) и не свойство Organization |

Соответствие слоёв — зафиксировано, дублирующих сущностей не заводим:

```
Product UI:              Partner  (для клиента — «Компания»)
Backend/DB:              Organization
Technical architecture:  Tenant / Organization
```

Правила, следующие из задачи владельца (§1, §3, §13, §23):

- отдельная таблица `Partner` поверх `Organization` **не создаётся**;
- `vertical` хранится на `Business` — не на `Organization` и не как главное свойство `Location`;
- `Organization` не привязана к одной вертикали: у одного партнёра могут быть и отели, и салоны;
- пример разложения: партнёр Alma Group → Business «Alma Hotels» (HOSPITALITY, филиалы Almaty и Astana)
  и Business «Alma Beauty» (BEAUTY, филиалы Marina и Downtown).

---

## 2. Продуктовая модель (Product Model)

Итоговая иерархия:

```
WETOP PLATFORM
│
├── Partner / Organization
│   │
│   ├── Business
│   │   ├── vertical
│   │   └── Locations[]
│   │
│   └── Business
│       ├── vertical
│       └── Locations[]
│
└── Partner / Organization
    └── ...
```

Короче: `WETOP → Partner/Organization → Business → Location → Vertical-specific domain`.

Что живёт на каждом уровне:

**WETOP Platform** — партнёры, подписки, планы, расширения, платежи WETOP, поддержка, состояние системы,
журнал платформы. Экраны — раздел «Платформа» (§17).

**Partner / Organization** — компания-клиент целиком: её бизнесы, её пользователи (`users` через
`memberships`), её расширения (`organization_extensions`), её отчётная валюта (§12).

**Business** — направление с вертикалью. Пример: партнёр Yuri Group ведёт Business «Luxx Hotels»
(`vertical = HOSPITALITY`) и Business «Luxx Beauty» (`vertical = BEAUTY`).

**Location** — филиал: Luxx Hotels → Almaty, Astana, Dubai; Luxx Beauty → Marina, Downtown, JVC.
На Location живёт операционная работа конкретного объекта.

**Vertical domain** — предметные сущности вертикали: у HOSPITALITY — `Property` и весь действующий
контур PMS; у BEAUTY — свой домен (§9). Домены не обобщаются в одну таблицу (§19).

---

## 3. Архитектурная схема (Architecture Diagram)

```
┌────────────────────────────────────────────────────────────────────────┐
│  WETOP PLATFORM                                                        │
│  Platform Admin: Обзор · Партнёры · Тарифы/подписки · Расширения ·     │
│  Платежи WETOP · Поддержка · Состояние системы · Журнал платформы      │
├────────────────────────────────────────────────────────────────────────┤
│  Partner / Organization  (изоляция арендаторов: ADR-061, ADR-099 → RLS)│
│  │                                                                     │
│  ├── Business (vertical = HOSPITALITY)                                 │
│  │   └── Location ── Property ── брони, фонд, тарифы, каналы, счета    │
│  │                                (существующий контур, без изменений) │
│  └── Business (vertical = BEAUTY)                                      │
│      └── Location ── записи, клиенты, мастера, услуги (§9, целевой)    │
├────────────────────────────────────────────────────────────────────────┤
│  Приложения (apps/README.md): web — стойка и платформа; api — одно API │
│  с контекстом запроса (§6); site — главная; ai-seller — боты.          │
│  Расширения (AI_SELLER, …) подключаются на уровне Organization (§14).  │
└────────────────────────────────────────────────────────────────────────┘
```

Стиль не меняется: модульный монолит (ADR-002), PostgreSQL — источник правды (ADR-003), деньги —
integer minor units (ADR-008), каналы — только через адаптер (ADR-004).

---

## 4. Схема базы данных (Database Diagram)

Существующие таблицы — как есть; новое отмечено `← v2.0`.

```
organizations ─────< businesses ─────< locations          ← v2.0: два новых уровня
      │                  │                  │
      │ memberships      │ vertical         │ timezone, currency (операционная)
      │ (role, §16 DM)   │ (HOSPITALITY     │
      │                  │  | BEAUTY)       │
      │                  │                  │
      │ (v1.6, ADR-061)  │                  │
      └──< properties ───┼──────────────────┘             ← v2.0: properties.location_id
               │         │                                   (сам Property не меняется)
               │         │
   Hospitality-домен     │  Beauty-домен (целевой, §9):
   (без изменений):      │
   accommodation_types   ├──< customers, employees, beauty_services   (на Business)
   inventory_units       │         │
   reservations          │         ├── employee_locations >── locations
   reservation_items     │         ├── employee_services  >── beauty_services
   allocations           │         └── working_hours (с location), time_off
   rate_plans/daily_rates│
   folios/charges/       └────────< appointments >── locations
   payments/refunds
   channel_mappings, …

platform_admins, organization_extensions, users, sessions — как в DATA_MODEL §13, §16.
```

Модели `Business` и `Location` — поля и обоснования в `DATA_MODEL.md` §17 (v2.0). Кратко:

```
Business                          Location

id                                id
organizationId                    businessId
name                              name
vertical                          address
status                            phone
createdAt                         email
updatedAt                         timezone
                                  currency
                                  status
                                  createdAt
                                  updatedAt
```

Business принадлежит одной Organization; Organization имеет N Business; Business имеет N Location.
`organizationId` на `Location` **не заводится**: организация выводится через Business, ограничений базы,
которым нужна эта колонка, нет, а вторая колонка-правда потребовала бы составного FK, чтобы не разъехаться.
Если Row Level Security (путь Б из ADR-061) потребует `organization_id` на каждой строке — колонка
добавится тогда, с составным FK `(business_id, organization_id) → businesses(id, organization_id)`.
Разбор — `DATA_MODEL.md` §17.3.

---

## 5. Current → Target

| Область | Сейчас (27.09.2026) | Цель v3 |
|---|---|---|
| Арендатор | `organizations` (§13 DM), членства с ролью OWNER/STAFF (§16 DM) | То же; в UI платформы называется «Партнёр». Плюс `reporting_currency` (§12) |
| Уровни владения | Organization → Property напрямую (`properties.organization_id`, ADR-061) | Organization → Business → Location → Property; `properties.organization_id` остаётся на миграционный период (§18) |
| Вертикали | Одна, неявная: всё — гостиница | `Business.vertical`: HOSPITALITY, BEAUTY; домены раздельны |
| Изоляция | Замок в приложении (`property-ref.ts`, ADR-061; гарды ADR-099) + tenant-колонки Phase 1 (`guests/audit_logs.organization_id`, `external_events/channel_outbox.property_id` — применены на рабочей базе) + **RLS реализован** (ADR-103: роли `wetop_app`/`wetop_service`, `app.org_id`, 41 политика; включает владелец через `DATABASE_APP_URL`) | Замок и политики понимают Business/Location; политика по `organization_id` через одну связку |
| Контекст запроса | `AsyncLocalStorage`: человек + организация | RequestActor c businessId/locationId/scope (§6) |
| Платформенный уровень | `platform_admins`, «Платформа → Организации/Техподдержка» (ADR-083, ADR-084) | Полный раздел «Платформа» (§17): партнёры, подписки, расширения, платежи, журнал |
| Расширения | `organization_extensions` (AI_SELLER), включает главный администратор (Q-183) | То же как entitlement; позже — активация на Business/Location (§14) |
| Beauty | Нет | Свой домен (§9), реализация после утверждения v3 — фазами (§20) |
| Управленческие финансы | Нет (Q-084 открыт: люди вели расходы в Exely) | Целевая модель §11; сейчас не реализуется |
| Onboarding | Регистрация → Organization + пустой Property → онбординг фонда | Регистрация → Organization + Business + Location (+ Property для HOSPITALITY), для маленького клиента — автоматически (§16) |

Ни один существующий ID (брони, номера, платежи, гости, тарифы, каналы) при переходе не меняется — §18.

---

## 6. Контекст запроса (Request Context)

Система поддерживает три уровня рабочего контекста: `ORGANIZATION`, `BUSINESS`, `LOCATION`.

Целевой RequestActor / session context:

```
userId
organizationId

businessId?          ← выбранный бизнес (для scope BUSINESS и LOCATION)
locationId?          ← выбранный филиал (для scope LOCATION)

vertical?            ← вертикаль выбранного бизнеса, выводится из Business

scope                ORGANIZATION | BUSINESS | LOCATION

role                 ← роль в организации (memberships.role; дальше — §13)
platformAdmin        ← действующая отметка platform_admins
```

Как это ложится на существующее: перехватчик учётных записей уже кладёт человека и организацию в
`AsyncLocalStorage` (`apps/api/src/accounts/actor.ts`, ADR-061). RequestActor расширяет тот же контекст,
не заменяя его. Переходное правило: пока сессия не несёт businessId/locationId, scope считается
`ORGANIZATION`, и единственный Property организации разрешается как сегодня (`property-ref.ts`) — ни один
действующий сценарий не ломается. Служебные ходоки (сторож, импорт, скрипты владельца) остаются
служебными, как в ADR-061.

Что показывает WETOP на каждом уровне:

- **ORGANIZATION** — вся компания: все бизнесы и филиалы; Total Revenue / Expenses / Profit, Customers,
  Employees, Payments (агрегаты §10);
- **BUSINESS** — все филиалы одного бизнеса и KPI его вертикали (Luxx Hotels — гостиничные, Luxx Beauty —
  салонные);
- **LOCATION** — полноценная операционная система объекта. Hospitality: Сегодня, Шахматка, Брони, Гости,
  Номерной фонд, Тарифы, Каналы. Beauty: Сегодня, Расписание, Записи, Клиенты, Мастера, Услуги.

Экран «Главная» (`/today`) — один маршрут на все три уровня: операционный рабочий экран на LOCATION,
дашборд сети на BUSINESS, универсальные показатели на ORGANIZATION. Подробное ТЗ, порядок блоков и
этапы — `plans/tz-today-2026-09-27.md` (ADR-105).

---

## 7. Tenant Model

- Арендатор (tenant) = `Organization` = Partner. Один уровень аренды; Business и Location — уровни
  владения внутри арендатора, не отдельные арендаторы.
- Одна база, общие таблицы; изоляция — замок в приложении на пути «имя → объект» (ADR-061) и гарды
  ADR-099, целевое состояние — Row Level Security (путь Б из ADR-061, отдельный срез). Новые таблицы
  (`businesses`, `locations`, Beauty-домен) проектируются так, чтобы политика RLS писалась по
  `organization_id` через одну связку: Location → Business → Organization.
- Тест изоляции обязателен для каждого нового уровня: запрос под чужой организацией возвращает пусто,
  красный до правки (`tests/integration/organization-isolation.test.ts` расширяется).
- Ключи интеграций (Channex, почта) сегодня лежат на установку (`.env`, ADR-056); перенос их на уровень
  Organization/Business — отдельное решение при первом партнёре с каналами, здесь не проектируется
  (CLAUDE.md §3).

---

## 8. Hospitality

Существующий `Property` **не переименовывается и не переписывается**. Целевая цепочка:

```
Organization → Business → Location → Property
```

`Property` остаётся Hospitality-специфичной сущностью. Все существующие связи — `Reservation`,
`ReservationItem`, `Allocation`, `InventoryUnit`, `AccommodationType`, `RatePlan`, `ChannelMapping`,
Channex, шахматка — остаются привязаны к `Property` как сейчас. Единственное изменение —
`properties.location_id` (nullable на миграционный период, §18).

Принцип безопасности прежних редакций сохраняется дословно: **Property получает родителя Location,
но существующий Hospitality-контур не переписывается.**

---

## 9. Beauty Model

Целевая цепочка: `Organization → Business (vertical = BEAUTY) → Location → Beauty-домен`.

Состав домена (поля и обоснования — `DATA_MODEL.md` §18, v2.0):

| Сущность | Принадлежит | Зачем |
|---|---|---|
| `Customer` | **Organization** + связка `CustomerBusiness` (freeze-решение №2, закрыло Q-198) | один клиент группы; Business видит только своих |
| `Employee` | **Business**, не Location | мастер — сотрудник сети |
| `EmployeeLocation` | Employee × Location | один мастер работает в нескольких салонах |
| `BeautyService` | **Business** | единый каталог услуг сети |
| `LocationService` | Location × BeautyService | `enabled`, `priceOverride?`, `durationOverride?` — свои цены и доступность филиала |
| `EmployeeService` | Employee × BeautyService | что мастер умеет |
| `WorkingHours` | Employee × Location | график всегда в контексте филиала |
| `TimeOff` | Employee | отпуска и отсутствия |
| `Appointment` | Location | запись клиента к мастеру на услугу |

Исправление прежней целевой архитектуры (задача §14): Employee больше **не** привязан навсегда к одной
Location — связь с филиалами ведёт `EmployeeLocation`, а `WorkingHours` обязаны нести Location context.
Каталог услуг (задача §15) — на Business, филиалы не копируют его, а переопределяют через
`LocationService`: сеть имеет единый каталог, каждый филиал — свои цены и доступность.

Beauty **не использует**: `Property`, `Reservation`, `InventoryUnit`, `RatePlan`, шахматку.
Пересечение записей одного мастера по времени запрещает база — exclusion constraint, тот же механизм,
что `allocations_no_overlap_per_unit` (DATA_MODEL §2), но своя таблица: общей таблицы броней и общего
«ресурса» у вертикалей нет (§19).

Деньги Beauty — integer minor units (ADR-008), время записей — UTC `timestamptz`, показ — в часовом
поясе Location (AGENTS.md §13).

---

## 10. Analytics

Универсальные показатели агрегируются снизу вверх: `Location → Business → Organization`.

```
Luxx Hotel Almaty   Revenue 10m ┐
Luxx Hotel Astana   Revenue  8m ┤→ Luxx Hotels TOTAL 18m ┐
                                                          ├→ Organization TOTAL 25m
Luxx Beauty                              7m ──────────────┘
```

Vertical-specific KPI не смешиваются и не суммируются между вертикалями:

- **Hospitality:** Occupancy, ADR, RevPAR, room nights, reservations;
- **Beauty:** appointments, utilization, average ticket, no-show, repeat rate, master utilization.

На уровне Organization сводятся только универсальные величины (§6): выручка, расходы, прибыль, клиенты,
сотрудники, платежи. Разные операционные валюты филиалов сводятся через отчётную валюту (§12).

---

## 11. Управленческие финансы (Management Finance)

Отдельно от клиентского контура Folio/Charge/Payment (DATA_MODEL §6): тот считает деньги гостя по счёту,
этот — деньги бизнеса для владельца. **Сейчас не реализуется** — целевая модель фиксируется здесь;
раздел в `DATA_MODEL.md` появится своей версией перед реализацией. Спрос подтверждён аудитом: статьи
расходов всего бизнеса люди вели прямо в Exely (FINDINGS §2 п. 12, Q-084).

Целевая запись `FinancialRecord`:

```
id
organizationId        NOT NULL
businessId?           ← расход/доход всего бизнеса
locationId?           ← или конкретного филиала; задан locationId → задан и businessId (CHECK)
type                  REVENUE | EXPENSE
categoryId            → FinanceCategory (справочник организации: категории доходов и расходов)
occurredOn            DATE
originalAmount        integer minor units
originalCurrency
exchangeRate
reportingAmount       integer minor units
reportingCurrency
note, createdBy, createdAt
```

Scope записи — ровно три варианта: вся Organization (businessId и locationId пусты), весь Business
(locationId пуст), конкретный Location. Возможности: доходы, расходы, категории, P&L, Cash Flow, Profit;
Budgets — позже. Курс — вручную на Organization, снимок на дату операции (freeze-решение №3, закрыло Q-197); автоматические записи выручки несут sourceType+sourceId с UNIQUE (freeze-решение №4).

---

## 12. Мультивалютность

- `Organization.reportingCurrency` — отчётная валюта партнёра (DATA_MODEL §18.4; без умолчания в базе —
  backfill по валюте объектов организации, новым партнёрам выберет онбординг; уточнение владельца 27.09);
- `Location.currency` — операционная валюта филиала (у Luxx — KZT, у филиала в Dubai — AED);
- финансовая аналитика хранит обе стороны пересчёта: `originalAmount` + `originalCurrency`,
  `exchangeRate`, `reportingAmount` + `reportingCurrency` — филиалы в KZT/AED/USD корректно
  складываются в Total, и всегда видно, по какому курсу.

Клиентский контур (Folio) уже мультивалютный по факту: валюта счёта — валюта тарифа (KZT и USD-тариф,
DATA_MODEL §6); его правила не меняются. Курс для отчётной валюты — вручную на Organization, снимок на дату
операции (freeze-решение №3); исходные amount+currency неприкосновенны.

---

## 13. Access Model

Целевые уровни доступа — модель данных не должна им мешать, полный granular RBAC сейчас не строится:

| Уровень | Видит |
|---|---|
| Platform Admin | раздел «Платформа»; брони, гости, счета и переписка чужих гостиниц не видны (ADR-083, Q-184) |
| Organization Owner | всю компанию: все бизнесы и филиалы |
| Business Manager | свой Business и все его Location (Luxx Hotels — да, Luxx Beauty — нет) |
| Location Manager | конкретный филиал |
| Staff | рабочие экраны в разрешённом контексте |
| Employee / Self | свой рабочий контекст: расписание, свои записи |

Сейчас есть два края этой лестницы: `platform_admins` и `memberships.role` OWNER/STAFF (DATA_MODEL §16,
ADR-083); на стойке сотрудники равноправны (ADR-023). Business Manager и Location Manager появятся как
привязка членства к Business/Location — отдельная связка (`membership_scopes`: membership × business?/
location?), которая добавляется без изменения существующих таблиц. Заводить её сейчас не нужно; важно,
что `businesses` и `locations` дают точки привязки. Состав прав каждой роли — решение владельца, когда
роли понадобятся (Q-140 частично закрыт, ADR-023 в силе).

---

## 14. Extension Model

Vertical и Extension — разные понятия:

- **Vertical** — какой домен использует Business: `HOSPITALITY`, `BEAUTY`. Определяет операционные
  экраны и предметные таблицы.
- **Extension** — платная возможность поверх вертикали: `AI_SELLER`, `CHANNEL_MANAGER`,
  `ONLINE_BOOKING`, `ADVANCED_ANALYTICS`, …

Уровни подключения:

1. **Organization entitlement** — партнёр купил расширение. Уже существует:
   `organization_extensions` (DATA_MODEL §16.3), включает главный администратор, статусы
   TRIAL/ACTIVE/OFF, срок действия (Q-183).
2. **Business / Location activation** — будущее: партнёр купил AI Seller, а включил только для
   конкретного бизнеса или филиала. Целевая связка `extension_activations`
   (organization_extension × business?/location?) добавляется без изменения `organization_extensions`;
   пока активаций нет, entitlement действует на всю организацию — как сегодня.

Enum `ExtensionKind` расширяется значениями по мере появления расширений; сегодня в нём один
`AI_SELLER`, и это не меняется данной задачей.

---

## 15. Onboarding нового партнёра

Целевой поток:

```
Create Organization / Partner
↓
Create Business
↓
Choose Vertical
↓
Create first Location
↓
Vertical-specific onboarding
```

Vertical-specific шаги:

- **Hospitality:** Property → номера/койки → категории → тарифы → каналы (существующий онбординг
  `/onboarding` встраивается сюда без переделки);
- **Beauty:** мастера → услуги → рабочие часы → записи → онлайн-запись.

---

## 16. UX для простого клиента

Владелец одного салона или одного маленького отеля не обязан думать об архитектурных терминах.
Регистрация «один салон» автоматически создаёт всю цепочку:

```
Organization  (название = как назвался человек)
Business      (то же название, выбранная вертикаль)
Location      (то же название)
```

— и человек сразу попадает в работу, как сегодня регистрация сразу заводит Organization и Property
(ADR-046, ADR-098). Второй филиал позже — структура уже готова: добавляется Location, ничего не
переносится. Термины Partner/Business/Location маленький клиент впервые видит только тогда, когда
они ему нужны.

---

## 17. WETOP Platform Admin

Отдельный platform-level интерфейс владельца WETOP — развитие существующего раздела «Платформа»
(ADR-083: организации и расширения; ADR-084: техподдержка). Минимальные разделы:

```
Обзор · Партнёры · Тарифы / подписки · Расширения · Платежи WETOP ·
Поддержка · Состояние системы · Журнал платформы
```

Раздел «Партнёры» — список Organization как партнёров:

```
Luxx Aparts      Hospitality           1 бизнес    1 филиал    Active
Beauty Group     Beauty                1 бизнес    4 филиала   Active
Holding X        Hospitality + Beauty  2 бизнеса   8 филиалов  Active
```

Карточка партнёра: название; статус; дата подключения; тариф; количество Businesses / Locations / Users;
активные вертикали; расширения; интеграции; последняя активность; ошибки и incidents; billing status.
Границы прежние: брони, гости, счета и переписка гостей партнёров главному администратору не видны
(ADR-083); деньги (цены, оплата подписок) — после Q-141 и Q-143.

---

## 18. Migration / Backfill план для Luxx

Luxx Aparts — **первый Partner WETOP**. Luxx Aparts не является WETOP и не является Platform Core;
это подключённый партнёр, такой же, как будущие.

```
AS IS                                TARGET

Organization Luxx                    Organization Luxx        = Partner
↓ properties.organization_id         ↓
Property Luxx                        Business «Luxx Aparts»   vertical = HOSPITALITY   ← новая строка
                                     ↓
                                     Location «Luxx Aparts Almaty»                     ← новая строка
                                     ↓ properties.location_id                          ← новый FK
                                     Property Luxx — существующая строка
                                     ↓
                                     существующие Rooms, Beds, Reservations, Rates,
                                     Channels, Payments, Guests — без изменений
```

Порядок (одна additive-миграция схемы + backfill; на рабочей базе применяет владелец, AGENTS.md §15):

1. **Схема:** создать `businesses` и `locations`; добавить `properties.location_id uuid NULL → locations`;
   добавить `organizations.reporting_currency` **NULL, без DEFAULT** (уточнение владельца 27.09, DATA_MODEL
   v2.2: слепой `'KZT'` создал бы ложные данные организации с объектом в другой валюте; заполнение — только
   backfill ниже). Ничего не удаляется и не переименовывается.
2. **Backfill (данными, не схемой), строго по Organization** (уточнение владельца 27.09): для каждой
   организации, у которой есть объект, — ровно **один** Business (**название = название организации,
   текущий бренд** — не имя объекта; `vertical = HOSPITALITY`, `status = ACTIVE`), и Location на каждый
   её объект (название, адрес, телефон, почта, часовой пояс и валюта — из записи `Property`);
   `properties.location_id` проставляется; никакой идентификации по совпадению названий — только по
   строкам `properties` и FK. `reporting_currency`: у всех объектов организации одна валюта — берётся она
   (Luxx → KZT); иначе NULL + строка в отчёте миграции. Для Luxx конкретно: Business «Luxx Aparts» →
   Location «Luxx Aparts Almaty» → существующая строка Property. Организации без объекта
   (зарегистрировались и не прошли онбординг) не получают ничего: их цепочка создастся онбордингом.
3. **Что остаётся временно nullable:** `properties.location_id` — NOT NULL **не объявляется заранее**
   (уточнение владельца 27.09): перед будущей NOT NULL-миграцией — gate
   `SELECT count(*) FROM properties WHERE location_id IS NULL` = 0 либо явное решение владельца по каждой
   оставшейся строке; `properties.organization_id` остаётся как есть на миграционный период —
   замок ADR-061 продолжает работать без единой правки кода. Снятие этой денормализации (организация
   через Location → Business) — отдельное решение после перевода замка на новую цепочку, не раньше.
4. **Старые связи сохраняются все:** каждая Hospitality-таблица ссылается на `Property` как сейчас;
   ни один ID существующих броней, номеров, платежей, гостей и других Hospitality-сущностей не меняется;
   `down.sql` — снять колонку и обе таблицы.

**Проверки, доказывающие отсутствие изменения данных:**

- число строк всех существующих таблиц до и после миграции совпадает (единственный UPDATE —
  `properties.location_id`);
- четыре сверки заново в ноль на новой схеме: фонд 88/88, двойной ввод суток, цены 8 640,
  балансы 1 449/1 449 (`npm run test:record`, как велит TESTING.md);
- связность: у каждого `Property` есть Location, у каждого Location — Business,
  `businesses.organization_id` = `properties.organization_id` его объекта (запрос в миграционном отчёте);
- изоляция: тест организации-соседа по-прежнему возвращает пусто.

---

## 19. Что НЕ делаем

Зафиксировано задачей владельца (§23) и обязательно к соблюдению:

- **не** создавать отдельную таблицу `Partner` поверх `Organization`;
- **не** переносить существующие Hospitality ID;
- **не** переименовывать `Property`;
- **не** делать `Business` частью Hospitality-домена;
- **не** привязывать `Organization` к одной вертикали;
- **не** делать одну таблицу Booking для Hospitality и Beauty;
- **не** делать одну Resource-таблицу для Room/Bed/Master — это же говорил ментор в ADR-019:
  обобщённый «ресурс» не проектируем, у каждой вертикали всё трудное своё;
- **не** оставлять Luxx-константы как platform business logic (продолжение работы ADR-061/ADR-099:
  оставшиеся служебные пути, знающие Luxx по имени, уходят вместе с переводом на Location-цепочку).

---

## 20. Фазы реализации (после утверждения v3)

> **Именование этапов (владелец, 27.09.2026, ADR-107):** фаза 1 ниже = **Platform P1** (Business +
> Location, `plans/phase-business-location-2026-09-27.md`); фаза 2 = **Platform P2** (RequestActor /
> scope, `plans/platform-p2-request-context-2026-09-27.md`) плюс **Platform P3** (переключатель +
> онбординг цепочки + «Партнёры»). P2 стартует только когда P1 в `main` и применён на рабочей базе
> с проверкой в ноль; P3 — после среза К1 этапа P2.

Код не пишется, пока владелец не утвердил этот документ и `DATA_MODEL.md` v2.0. Дальше — по фазам,
каждая со своим планом (AGENTS.md §1), тестами red-before-green и сверками:

1. **Фаза 1 — уровни владения.** Миграция §18 (Business, Location, backfill, Luxx как первый партнёр);
   четыре сверки в ноль; изоляция.
2. **Фаза 2 — контекст.** RequestActor со scope, переключатель контекста в стойке, раздел «Партнёры»
   в «Платформе» (§17).
3. **Фаза 3 — Beauty.** Домен §9 по утверждённому `DATA_MODEL.md` §19, онбординг Beauty, экраны
   Location-уровня.
4. **Фаза 4 — аналитика и финансы.** Агрегация §10; управленческие финансы §11 — по freeze-решениям №3–№4
   и собственного раздела в DATA_MODEL.
5. **Отдельно, без привязки к фазам:** RLS — реализован (ADR-103), включение ролей за владельцем; регистрация внешних партнёров — только после включённого RLS (ADR-102 п.4, freeze-решение №1); granular RBAC (§13), активация расширений
   на Business/Location (§14).

---

## 21. Acceptance Criteria

Архитектура v3 считается реализованной (по фазам 1–3), когда одновременно:

- [ ] в базе есть `businesses` и `locations`; Luxx разложен ровно как в §18; `properties.location_id`
      NOT NULL;
- [ ] четыре сверки дают ноль на новой схеме; ни один существующий ID не изменился (проверка §18);
- [ ] тест изоляции проходит для каждого уровня: чужая организация не видит Business, Location,
      Beauty-данные соседа;
- [ ] RequestActor несёт organizationId / businessId? / locationId? / scope; служебные ходоки работают;
- [ ] в UI термины употребляются по §1: «Партнёр» — только в разделе «Платформа», клиент видит
      «Компания / Бизнес / Филиал»;
- [ ] регистрация одного салона/отеля создаёт Organization + Business + Location одним шагом (§16);
- [ ] Beauty-филиал работает без единой ссылки на Property/Reservation/RatePlan;
- [ ] KPI вертикалей не смешиваются; Organization TOTAL сходится с суммой по Business (§10);
- [ ] `grep` по коду не находит новых мест, где Luxx зашит именем (§19).

---

## 22. Открытые вопросы

| Вопрос | Статус |
|---|---|
| Источник курса валют для `reportingAmount` | ~~Q-197~~ закрыт: вручную на Organization, снимок на дату операции (freeze №3) |
| Клиентская база Beauty | ~~Q-198~~ закрыт: Customer на Organization + `CustomerBusiness` (freeze №2) |

Остальные развилки закрыты самой задачей владельца от 27.09.2026 (иерархия, термины, место vertical,
раздельные домены) — записаны в ADR-104; четыре freeze-решения владельца (RLS-ворота, Customer, курсы, идемпотентность выручки) — в `ARCHITECTURE.md` ветки `claude/hopeful-thompson-2v8v8a` (ADR-100 той линии), редакции сводятся при её слиянии.
