# WETOP — архитектура платформы (ЗАМОРОЖЕНА 27.09.2026)

**Статус:** утверждена владельцем 27.09.2026 («Архитектуру в целом утверждаю») с четырьмя финальными
решениями ниже — ADR-100. Базовая иерархия после этого **не пересматривается**; работа переходит к
реализации Phase 1 плана миграции.

**Полные документы** (этот файл — краткая замороженная сводка, не замена):
- `reports/beauty-vertical-audit-2026-09-27.md` — аудит AS-IS;
- `reports/hospitality-beauty-target-architecture-2026-09-27.md` — целевая архитектура v1;
- `reports/hospitality-beauty-target-architecture-v2-2026-09-27.md` — v2 (действующая редакция);
- `DATA_MODEL.md` §17 — что это значит для модели данных; детальные спецификации таблиц
  добавляются туда пофазно перед каждой миграцией (AGENTS.md §2).

---

## Базовая иерархия (заморожена)

```
WETOP (платформа)
  → Partner/Organization   — арендатор/workspace владельца бизнеса («партнёр» в терминах Q-141/Q-143)
    → Business             — направление/бренд (сеть отелей, сеть салонов); vertical живёт здесь
      → Location           — конкретный филиал/объект (адрес, таймзона, валюта)
        → Vertical Domain  — HOSPITALITY: Property и весь существующий контур (не переписывается);
                             BEAUTY: Customer/Employee/BeautyService/Appointment (строится параллельно)
```

Четыре слоя продукта: **Platform Core** (Organization/Business/Location, учётные записи, финансы-ядро,
аналитика, уведомления, дизайн-система) → **Vertical** (HOSPITALITY | BEAUTY) → **Extensions**
(entitlement на Organization + activation на Business/Location) → **Client Configuration/Data**
(конкретные строки: Luxx Aparts — это только данные четвёртого слоя, не логика).

**Главный инвариант безопасности перехода:** `Property` не переименовывается и не переписывается.
Она остаётся Hospitality-сущностью, получает `Location` как нового родителя через одну nullable-колонку,
и все её существующие FK (`Reservation`/`InventoryUnit`/`RatePlan`/`ChannelMapping`/…) не трогаются.
Hotel-enum'ы (`InventoryUnitKind`, `AccommodationKind`) не расширяются значениями других вертикалей.
`Reservation` (Hospitality) и `Appointment` (Beauty) — разные таблицы; общее — только domain-примитивы.

---

## Четыре финальных решения владельца (27.09.2026, ADR-100)

### 1. RLS / регистрация

До публичного self-service подключения внешних организаций **PostgreSQL Row Level Security —
обязательный gate**. До его реализации разрешены только вручную подключённые Partner/пилоты, и только
после закрытия текущего P0-долга изоляции (Phase 1 плана: tenant-scope у `Guest`/`AuditLog`/
`ExternalEvent`/`ChannelOutbox`, ключи интеграций per organization, снятие Luxx-фоллбэка).
Публичная регистрация до выполнения этого условия не открывается (`REGISTRATION_OPEN=0` на рабочем
сервере остаётся в силе; согласуется с ADR-056/ADR-061/ADR-099).

### 2. Customer

Канонический `Customer` хранится на уровне **Organization** (один клиент группы). Связь и видимость
клиента в конкретном Business — отдельной join-сущностью **`CustomerBusiness`**
(`customer_id + business_id`, создаётся при первом обращении клиента в этот Business).
Business-scoped сотрудники видят только клиентов со строкой `CustomerBusiness` своего Business;
Organization Owner видит канонического клиента целиком. Так один человек — один клиент группы,
но операционные данные разных Business не смешиваются. Существующий Hospitality `Guest` не ломается
(переход Hospitality на Customer — отдельное будущее решение, additive, вне текущего плана).

### 3. Exchange Rates

`reportingCurrency` и политика курсов принадлежат **Organization**. На MVP `ExchangeRate` вводится
вручную и используется всеми Business организации для консолидированной отчётности. Исторический
`reportingAmount` фиксируется **снимком по курсу на дату операции** и не пересчитывается при
просмотре (принцип «нулевое расхождение»: одна и та же историческая операция всегда показывает одну
и ту же сумму). Оригинальные `amount`+`currency` операции неприкосновенны.

### 4. Management Revenue idempotency

Автоматические `ManagementFinanceEntry` (выручка из закрытых Folio / оплаченных Appointment)
**обязаны** хранить ссылку на исходную операционную сущность: `sourceType` (`FOLIO` |
`APPOINTMENT` | `MANUAL`) + `sourceId`, с уникальным ограничением `UNIQUE(source_type, source_id)` —
повторный запуск sync-job не создаёт дубль Revenue (для `MANUAL`-записей `sourceId` пуст; NULL в
Postgres не конфликтует в UNIQUE, поэтому ручных записей может быть сколько угодно).

---

## Что «заморожено» означает практически

- Иерархия `WETOP → Partner/Organization → Business → Location → Vertical Domain` не пересматривается.
- Изменения внутри слоёв (новые поля, новые вертикали, новые расширения) идут обычным порядком:
  правка `DATA_MODEL.md` → утверждение владельцем → миграция (AGENTS.md §2, §15) — но не трогают саму иерархию.
- Реализация идёт по фазам плана миграции (`reports/hospitality-beauty-target-architecture-v2-2026-09-27.md`
  §12): Phase 1 — P0-изоляция; каждая фаза — additive, со своими тестами и откатом.
