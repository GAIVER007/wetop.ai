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
- [x] **Gate 1 / Gate 2 закрыты числами 10.09.2026:** шахматка сходится с Exely на одну дату по всем категориям (двойной ввод RESULT OK на 08.09 и 10.09)
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
- [x] Q-080 — модель койки: **вариант А**, 07.09.2026 (ADR-013)
- [x] `DATA_MODEL.md` утверждён 07.09.2026 (§1–5, 7–10) и 09.09.2026 (§6 Folio)
- [x] **Q-091 — Folio на проживание** (закрыт 09.09.2026, ADR-014; Slice «Finance» сделан)
- [ ] БД для разработки: на машине нет Docker, PostgreSQL и Homebrew (07.09.2026) — выбор в `plans/slice-1-inventory.md` §6
- [x] Q-092 — отложен владельцем 07.09.2026: сверка по 88 как в Exely, собственная метрика после MVP
- [ ] Q-094 — правило назначения ячейки для OTA-броней (нужно до Slice 2)
- [x] `.claude/settings.json` — агенту закрыто чтение `.env` и реальных выгрузок, проверено (07.09.2026)

**Gate 0 — Readiness.** Другой разработчик открывает репозиторий и без чата отвечает:
что строим; что не строим; как устроен объект; что ещё неизвестно; какие решения приняты.

Единое определение (07.09.2026; до этого PLAN, таблица гейтов и ONBOARDING давали три разных).
Gate 0 пройден, когда одновременно: (1) тест выше проходит; (2) `DATA_MODEL.md` утверждён;
(3) опросник администраторов заполнен; (4) в `/docs/channex` лежит документация Channex.
Остальные пункты чеклиста недели 1 Gate 0 не блокируют, но блокируют гейты дальше
(календарь цен — Gate 2/3, eQonaq и fiscal docs — Gate 7, хостинг Q-070 — production).

---

## Неделя 2 — Inventory + read-only шахматка

**Slice 1 — Inventory.** Импорт реального номерного фонда.
Демонстрация: в интерфейсе ровно реальные 88 номеров/ресурсов.
План среза: [plans/slice-1-inventory.md](plans/slice-1-inventory.md) — подтверждается до кода.

**Slice 2 — Read-only chessboard.** Импорт future reservations **и истории броней
за август 2026**: без неё числа загрузки для Gate 2 не воспроизвести (до 07.09.2026
история в плане импорта отсутствовала). Историю за 12 месяцев — по Q-088.

**Gate 1 — Inventory / Chessboard.** Контрольные числа известны — аудит 07.09.2026.

> **Gate 1 по инвентарю пройден 08.09.2026:** `reports/inventory-2026-09-08.md` — diff 0 по всем строкам;
> страница `/inventory` показывает 88 единиц (e2e + скриншот). План и доказательства — `plans/slice-1-inventory.md`.
> Часть «Chessboard» (Gate 2) — Slice 2, `plans/roadmap-2026-09-08.md`. **09.09.2026:** шахматка работает на
> реальных бронях (279 будущих, анонимизированы): на 08.09 занято 78 / свободно 10 = Exely; e2e + скриншот.
> Загрузка августа по единицам — после дозагрузки броней августа.

### Фонд — должно совпасть точно

```
Единиц продажи                88
  ROOM                        16
  BED                         72
Максимум гостей               92
Физических комнат             20  (12 + 4 + 4 dorm × 18 — со слов владельца; Q-095 отложен, до списка PhysicalRoom импортируется 1:1)

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

> Знаменатель 2728 = 88 ячеек × 31 день — так считает Exely, и так ведётся сверка.
> Q-092 отложен владельцем 07.09.2026: считаем по 88, как Exely. Собственная метрика
> по местам или комнатам — после MVP, если понадобится.

> Внимание при сверке: «занято» и «оборот» считаются по разным базам и не должны
> совпадать. Единице-сутки — внутри августа; оборот и ADR — по заездам августа целиком,
> включая ночи, ушедшие в сентябрь. Делить оборот на «занято» нельзя.

---

## Неделя 3 — Тарифы + ручная бронь

**Rates:** rate plans; daily rates; restrictions; bulk edit диапазона дат.
Сезоны — вне MVP (DATA_MODEL §5, FINDINGS §4.4; SPEC §2 приведён в соответствие 07.09.2026).

**Manual reservation:** создать; изменить; cancel; assign room; assign bed.

**Gate 3 — Reservation.** Созданная бронь появляется в шахматке и изменяет availability.

> ✅ **Пройден 09.09.2026** живьём на dev-БД: e2e `tests/e2e/manual-reservation.spec.ts` — бронь со стойки создана через форму, видна в шахматке, свободных ячеек на даты стало на 1 меньше, после отмены — столько же, сколько было. Скриншоты `reports/screenshots/manual-reservation-*.png`. Цены — из календаря Exely (8 640 строк, diff 0).
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

> 🟡 **09.09.2026, через API живьём:** объект и 5 категорий созданы на staging, full sync ARI прочитан назад и сверен (35 клеток, diff 0), тестовая бронь new → modified → cancelled прошла через ленту ревизий в PMS и подтверждена. Обновление 09.09 (вечер): кнопки sync/pull/flush на `/channels`, сценарии сертификации 1–11 выполнены из интерфейса (протокол `reports/channex-certification-2026-09-09.md`). Осталось: форма и созвон (владелец), webhook живьём (публичный URL + секрет).

---

## Неделя 5 — Стойка, финансы, Казахстан

**Front desk:** check-in; check-out; room move; extend; early check-in; late checkout; no-show.
**Financial:** charges; services; payments; refunds; folio.
**Kazakhstan:** формы RU/KZ; eQonaq integration/test package; fiscal sandbox.

**Gate 4 — Front Desk.** Полный stay lifecycle проходит. ✅ 09.09.2026: бронь → заселение (гражданство и документ обязательны) → выезд; незаезд снимает ячейку — e2e `check-in-out.spec.ts`.
**Gate 6 — Finance.** Folio и оплаты сходятся. 🟡 09.09.2026: счёт на проживание, начисления/оплата/возврат/сторно сходятся в баланс — e2e `finance.spec.ts`; оплаченное из Exely переносится платежом `EXTERNAL`. Сверка балансов перенесённых проживаний с Exely — после полного импорта августа.
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
| 0 | Readiness | Контекст передаётся без чата; DATA_MODEL утверждён; опросник заполнен; docs Channex есть |
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
| 1 | **Dorm data model** — самый дорогой архитектурный промах | **Решён 07.09.2026:** ADR-013, койка = ячейка продажи, `PhysicalRoom` 1:1. Остаточный риск — Q-091 (уровень folio) и Q-094 (автоназначение) |
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
