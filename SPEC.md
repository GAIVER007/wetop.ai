# PMS MVP SPEC

## Objective

Заменить ежедневную работу стойки существующего объекта размещения
и принять OTA connectivity через Channel Manager.

## Success Definition

Один полный операционный день проходит в новой PMS.

Все arrivals, departures, in-house guests, new reservations, modifications,
cancellations, room moves, payments, services, OTA reservations — совпадают с Exely.

**Ни одна бронь не потеряна.**

Система считается готовой не тогда, когда написан код, а когда данные новой PMS
полностью сходятся с Exely на реальном объекте и операционный день проходит
без возврата сотрудников в старую PMS.

---

## In Scope

### 1. Номерной фонд
объект размещения; здания; этажи; категории размещения; обычные номера; апартаменты;
dorm rooms; отдельные койко-места; вместимость; статус номера; статус уборки;
временная блокировка; ремонт.

### 2. Тарифы
тарифные планы; цена по датам; цена по категории; сезоны; minimum stay;
maximum stay (если используется); stop sell; closed to arrival; closed to departure;
доступность; ручное изменение цены; массовое изменение диапазона дат.

### 3. Шахматка
Видеть: номер/койку; даты; бронирования; блокировки; ремонт; заселённого гостя;
выезжающего гостя; будущего гостя.
Действия: открыть бронь; перетащить; переселить; изменить даты; заблокировать номер.

### 4. Бронирования
Источники: стойка; телефон; WhatsApp; walk-in; OTA через Channex.
Операции: создание; изменение; аннуляция; no-show; переселение; продление;
сокращение проживания; назначение физического номера; назначение койки;
групповая бронь; бронь всего dorm; несколько гостей в одной брони.

### 5. Гости
ФИО; дата рождения; гражданство; телефон; email; пол; документ; номер документа;
дата выдачи; срок действия; страна выдачи; история проживаний; комментарии.
Паспортные данные — защищаемые персональные данные (см. `SECURITY.md`).

### 6. Стойка
ожидает заезда; check-in; in-house; room move; extend; early check-in; late checkout;
check-out; no-show.

### 7. Folio / счёт гостя
проживание; завтрак; трансфер; minibar/доп. услуги; ранний заезд; поздний выезд;
скидка; корректировка; оплата; частичная оплата; несколько способов оплаты;
refund; закрытие folio.

### 8. Channel Manager
Первый provider — Channex. Бизнес-логика PMS не зависит от Channex напрямую:

```
PMS → Channel Provider Adapter → Channex → OTA
```

### 9. Казахстан
eQonaq; уведомление о прибытии иностранца; статус отправки; статус ошибки;
повторная отправка; фискальный чек; печатные формы; русский язык; казахский язык.

---

## Out of Scope

Запрещено самостоятельно расширять scope следующим:

1. SaaS
2. Multi-tenant / multi-property UI
3. Отдельный кабинет владельца
4. Мобильное приложение
5. AI-ассистент / AI-консьерж
6. Booking engine для сайта
7. Конкурентная аналитика
8. Dynamic pricing
9. CRM продаж
10. Маркетинг
11. Программа лояльности
12. Housekeeping mobile app
13. Marketplace
14. Турагентства
15. Бухгалтерия полного цикла

Это отдельные продукты/этапы.

### Но архитектуру не делаем тупиковой

Не строим SaaS сейчас. Однако база не должна содержать предположение
«в мире существует только один отель». Поэтому сущность `Property` сохраняется,
но интерфейс MVP работает только с одним property.

---

## Non-functional requirements

- audit trail;
- role-based access;
- no lost bookings;
- idempotent external events;
- retryable integrations;
- backups;
- guest data protection;
- responsive desktop interface;
- observability without PII leakage.

---

## Definition of Done всего MVP

MVP готов только при одновременном выполнении:

- inventory reconciled
- bookings reconciled
- availability reconciled
- rates reconciled
- restrictions reconciled
- guest lifecycle works
- dorm workflow works
- folio works
- payments work
- refunds work
- Channex production works
- no duplicate OTA reservations
- no lost OTA reservations
- eQonaq workflow works
- fiscal workflow works
- RU/KZ forms work
- parallel day matches Exely
- rollback verified
- staff can run a shift without opening Exely

Только после этого можно говорить о SaaS, AI, втором объекте и остальных продуктах.
