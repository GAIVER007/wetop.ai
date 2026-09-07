# CUTOVER — переезд с Exely на Channex

Принцип: **по одному каналу**. Сначала минимальный по объёму, Booking.com — последним (ADR-012).
Следующий OTA не подключается, пока предыдущий не прошёл reconciliation с расхождением 0.

---

## Migration matrix (заполнить до первого переключения)

| Channel | Future bookings (Exely) | Can import automatically? | Manual import required? | Imported count | Exely count | Difference |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |

**Ноль расхождений — обязательный гейт.**

Известно: Booking.com имеет Pull Future Reservations; Expedia — аналогичную возможность.
Из этого **нельзя** делать вывод, что все восемь каналов импортируют старые брони.
Проверяется по каждому OTA (Q-032).

---

## Порядок переключения канала

1. Snapshot future bookings
2. Snapshot availability
3. Snapshot rates
4. Disable old connectivity
5. Connect Channex
6. Map
7. Import future reservations
8. Reconcile
9. Push initial ARI
10. Test modification
11. Monitor

---

## Чеклист канала (копировать на каждый OTA)

```
Channel:
Date:
Responsible:

[ ] Number of future reservations in Exely
[ ] Future reservations exported
[ ] External IDs saved
[ ] Current availability snapshot
[ ] Current prices snapshot
[ ] Restrictions snapshot
[ ] Existing provider disconnected
[ ] Channex authorised
[ ] Room mapping checked
[ ] Rate mapping checked
[ ] Future bookings imported
[ ] Duplicate check passed
[ ] Reservation count matches
[ ] Availability matches
[ ] Rates match
[ ] Restrictions match
[ ] Test event received
[ ] Monitoring active
```

---

## ROLLBACK

Rollback не означает «разберёмся, как вернуть». Он записан заранее.

```
1. STOP outgoing ARI worker.
2. Disable Channex channel.
3. Restore Exely as OTA connectivity provider.
4. Restore last verified Exely ARI.
5. Confirm connectivity.
6. Reconcile reservations received during migration window.
```

**Для каждого OTA отдельно проверить, действительно ли эти шаги технически возможны
именно в таком порядке.** Результат проверки записать здесь:

| Channel | Rollback проверен | Кем | Дата | Замечания |
|---|---|---|---|---|
| | | | | |

Rollback считается верифицированным только после реальной проверки шагов,
а не после их прочтения.
