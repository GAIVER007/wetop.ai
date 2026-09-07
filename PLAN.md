# PLAN — 8 недель

Правило: срез не закрывается словом "done". Нужно доказательство (AGENTS.md §10).

---

## Неделя 1 — Readiness. Production feature code = 0

**Делаем:**

- [x] Репозиторий + AGENTS/SPEC/DECISIONS/QUESTIONS/GLOSSARY/SECURITY
- [x] Stack decision — зафиксирован в ADR-011
- [x] ТЗ на аудит — [TZ-EXELY-AUDIT.md](TZ-EXELY-AUDIT.md)
- [x] **Аудит Exely проведён 07.09.2026** → [OBJECT.md](OBJECT.md), [FINDINGS.md](FINDINGS.md)
- [x] Разбор 88 единиц (разделы 5–6 ТЗ) — 88 = 16 номеров + 72 койки
- [x] **Контрольный срез** (раздел 23 ТЗ) — база для Gate 1 и Gate 2 готова
- [ ] **Опросник администраторов** — `templates/oprosnik-administratory.md` (разделы 11, 13, 14, 16, 17, 19, 20 ТЗ)
- [ ] Скриншоты Exely — 23 экрана (`templates/exely-screens-guide.md`)
- [ ] 8 процессов по шагам (там же)
- [ ] Календарь цен на 12 месяцев — «Экспорт в Excel» на странице «Тарифы»
- [ ] Отчёт по отменам за 01–31.08.2026
- [ ] Channex: заявка, sandbox, запрос certification (`outbox/01-channex.md`)
- [ ] eQonaq: запрос API / Smart Bridge (`outbox/02-eqonaq.md`)
- [ ] Exely: запрос выгрузок либо доступ к API (`outbox/03-exely.md`, Q-088)
- [ ] Скачать vendor docs локально в `/docs`
- [ ] Решение по хостингу персональных данных в Казахстане (Q-070)
- [ ] **Три решения владельца, блокирующие DATA_MODEL: Q-080, Q-091, Q-092**

**Gate 0 — Readiness.** Другой разработчик открывает репозиторий и без чата отвечает:
что строим; что не строим; как устроен объект; что ещё неизвестно; какие решения приняты.

---

## Неделя 2 — Inventory + read-only шахматка

**Slice 1 — Inventory.** Импорт реального номерного фонда.
Демонстрация: в интерфейсе ровно реальные 88 номеров/ресурсов.

**Slice 2 — Read-only chessboard.** Импорт future reservations.

**Gate 1 — Inventory / Chessboard.** Контрольные числа известны — аудит 07.09.2026.

### Фонд — должно совпасть точно

```
Единиц продажи                88
  ROOM                        16
  BED                         72
Максимум гостей               92

По категориям:
  Одноместная с окном          4
  Одноместная без окон         8
  Двухместная                  4
  Общая мужская (койка)       36
  Общая женская (койка)       36
```

### Состояние на 07.09.2026

```
Занято                        78
Свободно                      10
Заблокировано / в ремонте      0
Заездов                       23
Выездов                       24
No-show                        9
Будущих проживаний           209  (4 743 535 ₸)
```

### Загрузка за август 2026 — для Gate 2

```
Всего            2174 / 2728 ед.-суток   79,7%
Одноместная с окном   122 / 124          98,4%
Одноместная без окон  245 / 248          98,8%
Двухместная           121 / 124          97,6%
Общая мужская         996 / 1116         89,2%
Общая женская         690 / 1116         61,8%
```

Допустимое расхождение: **0**. Не 99.5%. Ноль.

> Внимание при сверке: «занято» и «оборот» считаются по разным базам и не должны
> совпадать. Единице-сутки — внутри августа; оборот и ADR — по заездам августа целиком,
> включая ночи, ушедшие в сентябрь. Делить оборот на «занято» нельзя.

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

Ориентиры дня по данным августа: ~34 заезда, ~33 выезда, ~70 занятых единиц,
~47 финансовых операций, оборот проживания ~506 000 ₸.

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
| 1 | **Dorm data model** — самый дорогой архитектурный промах | **Обострился:** в Exely физической планировки нет вообще, `PhysicalRoom` нечем заполнить. Решение Q-080 / ADR-013 |
| 2 | Existing future reservations | 209 проживаний на 4,74 млн ₸, из них **96,5% не оплачено** — потеря брони стоит всей суммы. Matrix в `CUTOVER.md` |
| 3 | Personal data | Data residency + access + backups (`SECURITY.md`, ADR-009) |
| 4 | Financial logic | Не смешивать `Reservation.total` и folio balance. На объекте разница видна: приход 17,6 млн ₸ против оборота заездов 15,7 млн ₸. Плюс открыт Q-091 — уровень привязки Folio |
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
