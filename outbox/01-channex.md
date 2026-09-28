# → Channex

**Статус:** владелец написал в Channex сам (вне этого черновика) и получил ответ — 11.09.2026 сообщил в чате
**Дата отправки:** до 10.09.2026 (владелец)
**Кому:** Channex
**Ответ получен:** да. Суть: (9) Sandbox — staging.channex.io, регистрация самостоятельно, бесплатно и без ограничений, Channel API на staging уже включён; (10) Сертификация — формальный путь из 14 пунктов и 5 этапов (docs.channex.io/api-v.1-documentation/pms-certification-tests), форма forms.gle/xA8F3eSYBPBd8apYA; staging бесплатен до прохождения, платный production не открывают, пока сертификация не пройдена. Вопрос «подтягивают ли брони, созданные до подключения» — ответ получен 11.09.2026 (Evan, Channex): подтягиваются Booking.com, Expedia, Airbnb, Trip.com/Ctrip; не подтягиваются Agoda, Hostelworld, Ostrovok/ETG, Vrbo. Срок созвона: SLA нет; после формы они проверяют task ID и результаты, затем организуют verification (screenshare, иногда принимают запись видео). Записано в CUTOVER.md

---

**Subject:** PMS Integration — Sandbox, Certification and Existing Reservations

Hello,

We are currently developing a PMS for our own hospitality property and would like to
integrate Channex as the channel connectivity layer.

The PMS is currently being prepared for a live migration from архивный источник.

Could you please clarify the following before we begin the integration:

1. How can we obtain staging/sandbox credentials for PMS development?

2. What is the current PMS certification process and what scenarios must be
   demonstrated from our PMS UI?

3. After we are technically ready, what is the typical process for scheduling the
   certification/review call?

4. We currently have existing future reservations in our OTA channels.
   Can Channex import reservations that were created before the channel was connected
   to Channex? We need confirmation **for each of our eight channels**, with the
   current volume of future reservations we would need to migrate:

   | Channel | Property ID in channel | Future reservations |
   |---|---|---|
   | Booking.com | 14087887 | 72 |
   | Trip.com Group | 132059275 | 75 |
   | Agoda | 77196946 | 19 |
   | Expedia / Hotels.com | 131927054 | 10 |
   | Ostrovok.ru (Emerging Travel Group) | 326506274 | 4 |
   | Hostelworld | 335147 | 2 |
   | Bronevik.com | 738372 | 0 |
   | OneTwoTrip | 41647 | 0 |

   Total: 182 future reservations, of which 96.5% are unpaid — a lost reservation
   costs us the full amount, not a remaining balance.

5. For channels where existing future reservations cannot be imported automatically,
   what migration procedure do you recommend?

6. When switching an OTA from our existing channel manager to Channex, what is the
   safest recommended cutover procedure to prevent lost reservations or incorrect
   availability?

7. Is there a recommended reconciliation procedure before sending the first full
   availability update?

8. Our property is a hostel: 88 sellable units = 16 private rooms + 72 dorm beds,
   sold as 5 accommodation types. Dorm beds are sold individually and are split by
   gender into two separate accommodation types. Please confirm this maps cleanly
   in Channex, and how a multi-bed reservation (one booking, several beds) is
   delivered to the PMS.

9. Our channel pricing is implemented as **a separate rate plan per channel**, not
   as a markup. Please confirm this is supported and describe the recommended
   mapping approach (separate rate plans vs. `derived_option` on the channel mapping).

10. Please confirm that channel adapters exist for **Trip.com Group, Hostelworld,
    Bronevik.com and OneTwoTrip** (we could not find channel guides for them in the
    documentation), and whether `load_future_reservations` is available for each
    of our eight channels.

Thank you.

We would also appreciate links/files for the current PMS API documentation,
certification checklist and sandbox documentation.

---

## Куда пойдут ответы

| Вопрос письма | ID в QUESTIONS.md |
|---|---|
| 1, 2, 3 | Q-030, Q-031 |
| 4, 10 (load_future_reservations) | Q-032 |
| 10 (адаптеры) | Q-096 |
| 5 | Q-034 |
| 6 | Q-035 |
| 7 | Q-033 |

Документацию сложить в `docs/channex/`.
