# PLAN — 8 недель

Правило: срез не закрывается словом "done". Нужно доказательство (AGENTS.md §10).

---

## Неделя 1 — Readiness. Production feature code = 0

**Делаем:**

- [ ] Channex: заявка, sandbox, запрос certification (`outbox/01-channex.md`)
- [ ] eQonaq: запрос API / Smart Bridge (`outbox/02-eqonaq.md`)
- [ ] Exely: запрос полных выгрузок (`outbox/03-exely.md`)
- [ ] Скриншоты Exely — 23 экрана (`project-input/exely-screens/`)
- [ ] Интервью с управляющим (`templates/manager-interview.md`)
- [ ] Разбор 88 номеров (`templates/inventory-breakdown-template.md`)
- [ ] Скачать vendor docs локально в `/docs`
- [ ] Репозиторий + AGENTS/SPEC/DECISIONS/QUESTIONS/GLOSSARY/SECURITY
- [ ] Решение по хостингу персональных данных в Казахстане (Q-070)
- [ ] Stack decision — зафиксирован в ADR-011

**Gate 0 — Readiness.** Другой разработчик открывает репозиторий и без чата отвечает:
что строим; что не строим; как устроен объект; что ещё неизвестно; какие решения приняты.

---

## Неделя 2 — Inventory + read-only шахматка

**Slice 1 — Inventory.** Импорт реального номерного фонда.
Демонстрация: в интерфейсе ровно реальные 88 номеров/ресурсов.

**Slice 2 — Read-only chessboard.** Импорт future reservations.

**Gate 1 — Inventory / Chessboard.** На одну контрольную дату сравнить с Exely:

```
Всего:        физические номера, койки, заняты, свободны, blocked, out of order
По категории: то же самое
Брони:        arrivals, departures, in-house, future
```

Допустимое расхождение: **0**. Не 99.5%. Ноль.

---

## Неделя 3 — Тарифы + ручная бронь

**Rates:** rate plans; daily rates; restrictions; сезоны; bulk edit диапазона дат.

**Manual reservation:** создать; изменить; cancel; assign room; assign bed.

**Gate 3 — Reservation.** Созданная бронь появляется в шахматке и изменяет availability.
Доказательство: тест + скриншот до/после.

---

## Неделя 4 — Channex Sandbox

Только через UI PMS (никаких «мы проверили в Postman»):

1. Full ARI sync
2. Receive booking
3. Save booking
4. Acknowledge
5. Update availability
6. Modification
7. Cancellation
8. Change price
9. Push rate
10. Push restrictions

**Gate 5 — Channex Sandbox.** Booking lifecycle + ARI работает из интерфейса PMS.

---

## Неделя 5 — Стойка, финансы, Казахстан

**Front desk:** check-in; check-out; room move; extend; early check-in; late checkout; no-show.
**Financial:** charges; services; payments; refunds; folio.
**Kazakhstan:** формы RU/KZ; eQonaq integration/test package; fiscal sandbox.

**Gate 4 — Front Desk.** Полный stay lifecycle проходит.
**Gate 6 — Finance.** Folio и оплаты сходятся.
**Gate 7 — Kazakhstan.** eQonaq + fiscal тестовый контур работает.

---

## Неделя 6 — Репетиция и параллельный день

**Certification rehearsal:** самостоятельно пройти полный сценарий Channex.

**Parallel mode:** один операционный день. Exely + новая PMS. Все действия вводятся параллельно.

**Gate 8 — Parallel Day.** В конце суток:

```
New bookings        = Exely
Cancellations       = Exely
Modifications       = Exely
Arrivals            = Exely
Departures          = Exely
In-house            = Exely
Revenue             = Exely
Payments            = Exely
Available inventory = Exely
```

Difference: **0**.

---

## Недели 7–8 — Миграция OTA

OTA переключаются **по одному**. Сначала канал с минимальным объёмом.
Booking.com — последним (ADR-012).

Для каждого канала — чеклист из `CUTOVER.md`.
Следующий OTA не подключается, пока предыдущий не прошёл reconciliation.

**Gate 9 — OTA Migration.** Первый малый OTA работает в production.
**Gate 10.** Все OTA мигрированы, Booking.com последним.

---

# Гейты проекта

| Gate | Название | Критерий |
|---|---|---|
| 0 | Readiness | Все исходные данные собраны |
| 1 | Inventory | 88 номеров/ресурсов сходятся |
| 2 | Chessboard | Загрузка совпадает с Exely |
| 3 | Reservation | Ручная бронь правильно влияет на availability |
| 4 | Front Desk | Полный stay lifecycle проходит |
| 5 | Channex Sandbox | Booking lifecycle + ARI работает |
| 6 | Finance | Folio и оплаты сходятся |
| 7 | Kazakhstan | eQonaq + fiscal test контур работает |
| 8 | Parallel Day | Exely = New PMS |
| 9 | OTA Migration | Первый малый OTA работает в production |
| 10 | Full migration | Все OTA мигрированы, Booking последним |

---

# Критические риски

| № | Риск | Митигация |
|---|---|---|
| 1 | **Dorm data model** — самый дорогой архитектурный промах | Решить до кода. ADR-005. Не давать агенту придумывать модель dorm |
| 2 | Existing future reservations | Migration matrix по каждому OTA (`CUTOVER.md`) |
| 3 | Personal data | Data residency + access + backups (`SECURITY.md`, ADR-009) |
| 4 | Financial logic | Не смешивать `Reservation.total` и folio balance |
| 5 | OTA duplicate reservations | Idempotency обязательна (ADR-007) |
| 6 | Availability race conditions | Изменение inventory — транзакционно |
| 7 | Vendor downtime | Channex/eQonaq/fiscal — через retry queues |
| 8 | Cutover | Нельзя переключать все OTA одновременно (ADR-012) |

---

# Чего НЕ делаем

Не начинаем с: красивого dashboard; AI; SaaS billing; мобильного приложения;
Booking Engine; 30 отчётов; копирования Exely экран в экран; microservices.

Не позволяем агенту самому придумать модель dorm.
Не отправляем реальные данные гостей в Claude/ChatGPT/Codex.
Не подключаем Booking.com первым.
