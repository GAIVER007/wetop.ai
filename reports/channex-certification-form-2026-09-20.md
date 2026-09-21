# Анкета сертификации Channex — заполнено к отправке (20.09.2026)

Форма: https://forms.gle/xA8F3eSYBPBd8apYA (34 страницы, аккаунт `luxxaparts@gmail.com` уже подставлен).
Ниже — каждый вопрос формы и готовый ответ. Отправляет владелец; я форму не отправляю.

Источники ответов: `plans/channex-certification-pack-2026-09-11.md`, `reports/channex-certification-tasks.json`,
`reports/channex-ota-cycle-2026-09-11.md`, `reports/reset-and-channex-2026-09-20.md`, сопоставление Channex
прочитано прямым запросом к базе 20.09.2026.

## Страница 1. Контакты

| Поле | Ответ |
|---|---|
| Электронная почта | `luxxaparts@gmail.com` (подставлена формой) |
| Product name | `WETOP` |
| Contact Person Name | **уточнить**: с Channex переписывался Yuriy Zapoinov — если на проверочном созвоне будет он, писать его |
| Contact Person Email | **уточнить**: `zapoinov@bk.ru` — тот адрес, который Channex уже знает |

## Информация о возможностях PMS

| Вопрос | Ответ | Основание |
|---|---|---|
| Do you support multiple Room Types per Property | **Yes** | 5 категорий на объекте |
| Do you support multiple Rate Plans per Room Type | **Yes** | на каждой категории «Тариф для ОТА +35 %» и «Базовый тариф» |
| What restrictions is supported by your system | отметить **все восемь**: Availability, Rate, Min Stay Through, Min Stay Arrival, Max Stay, Closed To Arrival, Closed To Departure, Stop Sell | все восемь полей формирует `apps/api/src/channels/ari.ts`; проверено по коду 20.09 |
| Do you need credit card details with bookings? | **No** | блок `guarantee` вырезается из ревизии до записи, карты не хранятся |
| Are you PCI Certified? | **No** | третий вариант. Карты к нам не попадают вовсе, поэтому ни сертификация, ни токенизатор не нужны |

## Setup Testing Property — идентификаторы Channex staging

Объект на staging — зеркало реального: 5 категорий, KZT. Twin/Double из образцовой настройки Channex
у нас нет, поэтому подставлены две наши категории; это честно сказано в ответе к сценарию 2.

| Поле формы | Значение | Что это у нас |
|---|---|---|
| Property ID at Channex | `60fc6ef0-5cdc-4f53-a2ca-3f477964cb2a` | Luxx Aparts, staging |
| Twin Room ID at Channex | `1a9bd53b-1c5e-4063-b654-d377839125b3` | Двухместная комната |
| Twin Room Best Available Rate ID | `6ee98055-57cf-4831-a231-eba142307235` | Тариф для ОТА +35 % |
| Twin Room Bed & Breakfast Rate ID | `ea6bfd9a-0cf3-48f9-a9af-7dce2b8dffc0` | Базовый тариф |
| Double Room ID at Channex | `b0655bc0-f559-4abc-be1f-b9a241ddf036` | Одноместная комната с окном |
| Double Room Best Available Rate ID | `428d744c-0c7d-4469-9002-f323d4bf8cbe` | Тариф для ОТА +35 % |
| Double Room Bed & Breakfast Rate ID | `9e9795e6-3bc2-4866-85a9-b2b770b4eaaa` | Базовый тариф |

## Сценарии 1–10

На каждый сценарий форма спрашивает «Is this test case applicable?» — везде **Yes** — и поле «Test results».
Текст ниже вставляется в это поле целиком.

### Test case #1. Full Sync

```
Applicable: yes. Full sync is triggered by the "Full push" button in our PMS UI and also runs
automatically once a day after 03:00 Asia/Almaty if it was not run manually during the day.
Depth 500 days, sent in two calls, both rate plans included.
Task IDs: 69a1b03d-7518-45fc-b890-0a6bbc7760b2 (availability),
d08e9381-5c3f-4e98-8e2f-46a9fc4c58b7 (restrictions). Sent 2026-09-13.
Note: prices are loaded 361 days ahead, so beyond that date we push availability without rate.
```

### Test case #2. Single Date Update for Single Rate

```
Applicable: yes. Task ID 71158774-3edc-4c2c-8636-badd12458ab6, sent 2026-09-14 07:40:23 UTC.
Note on property setup: our property is a hostel in Almaty with 5 room types and one rate plan
per room type sold to OTAs, so we did not create the sample Twin/Double property. Scenarios that
ask for multiple rate plans were run on several room types with the mapped rate plans listed in
the setup section above. Values follow the certification document tables but in KZT.
```

### Test case #3. Single Date Update for Multiple Rates

```
Applicable: yes. Task ID 8fcb165d-49d2-4a1b-93ed-54b1f3ae15ca, sent 2026-09-14 07:40:34 UTC.
```

### Test case #4. Multiple Date Update for Multiple Rates

```
Applicable: yes. Task ID 57d1d082-e040-46fc-af70-d2d596e46bea, sent 2026-09-14 07:40:45 UTC.
```

### Test case #5. Min Stay Update

```
Applicable: yes. Task ID 1c90df9f-3d72-43dc-a24c-9436f2a74b2f, sent 2026-09-14 07:40:56 UTC.
We send the same value to both min_stay_arrival and min_stay_through.
```

### Test case #6. Stop Sell Update

```
Applicable: yes. Task ID 34bbbed6-6792-40d1-a36c-73b593059869, sent 2026-09-14 07:41:13 UTC.
```

### Test case #7. Multiple Restrictions Update

```
Applicable: yes. Task ID 0e9a0030-126c-4504-9701-012d4ab804c9, sent 2026-09-14 07:41:25 UTC.
Restrictions sent together: rate, availability, min_stay_arrival, min_stay_through, max_stay,
stop_sell, closed_to_arrival, closed_to_departure.
```

### Test case #8. Half-year Update

```
Applicable: yes. Task ID 98a080ab-c697-4967-9859-1cb3edb90206, sent 2026-09-14 07:41:38 UTC.
```

### Test case #9. Single Date Availability Update

```
Applicable: yes. Task ID bb73dfa3-1aae-4171-a3f3-65db902b1143, sent 2026-09-14 07:41:58 UTC.
Availability change was caused by creating a booking in the PMS UI, not by a script.
```

### Test case #10. Multiple Date Availability Update

```
Applicable: yes. Task ID 525211f9-ca7d-4731-9ea3-f96b8dd07e57, sent 2026-09-14 07:42:20 UTC.
Availability change was caused by cancelling a booking in the PMS UI.
```

## Сценарий 11. Booking Receiving — четыре поля, три заполняются после прогона

| Поле формы | Значение |
|---|---|
| Booking ID | `a3499b4d-9b4a-4ceb-9514-7ea26f948610` (прогон 20.09) |
| Booking Revision ID for New Revision | `dca2cc80-536d-476e-8240-1c3f7919e928` |
| Booking Revision ID for Modified Revision | **нет: в прогоне 20.09 не было изменения** |
| Booking Revision ID for Cancelled Revision | `1140603a-23d6-4a97-8b1c-aa79d1420474` |

Изменение брони PMS обрабатывает — это доказано прогоном 11.09 по шести каналам
(`reports/channex-ota-cycle-2026-09-11.md`: создание → перенос дат → отмена, 18 ревизий).
Но база 19.09 обнулена, и идентификаторов тех ревизий в ней не осталось, а форме нужны именно
идентификаторы Channex.

**Как закрыть — одна команда владельца.** Цикл дополнен шагом «изменение» и печатает все ревизии:

```
cd ~/Desktop/Проекты/WETOP
npx tsx scripts/reconciliation/src/cli-channex-wetop-cycle.ts
```

В конце вывода будет блок «Для формы сертификации, сценарий 11» — Booking ID и по ревизии на статус
`new`, `modified`, `cancelled`. Их и вписать вчетвером вместо таблицы выше: одна бронь, три ревизии
выглядят для проверяющего честнее, чем склейка из двух прогонов. Ключ Channex берётся из `.env`,
мне он не нужен и не показывается.

## Rate Limits and Update logic

| Вопрос | Ответ |
|---|---|
| Can you stay in rate limits? | **Yes** |
| Do you agree to only send updated changes to Channex? | **Yes** |

Если рядом будет поле для пояснения:

```
Outgoing updates go through a queue with throttling: at most one call per 6 seconds per data type
(Channex limit is 10 per minute per endpoint); everything accumulated in that window is sent in one
call. On error we retry with growing delay from 1 minute up to 6 hours, six attempts, then the
event is marked FAILED and shown on the channels screen. No Channex calls are made directly from
save handlers.

Only changes are sent event by event (availability, rate and restriction deltas through the queue).
Full sync runs three ways and never on a short timer: on the administrator's button; automatically
once a day after 03:00 Asia/Almaty if it was not run during the day; and after a bulk import.
Scheduled full sync is at most once per day.
```

## Расхождение, о котором надо знать до отправки

Task ID сценариев 2–10 записаны дважды: в `plans/channex-certification-pack-2026-09-11.md` — прогон
10.09, в `reports/channex-certification-tasks.json` — прогон 14.09. Выше взяты **14.09**: они свежее,
и это последний зафиксированный прогон. Если хочется, чтобы все одиннадцать сценариев были одного дня,
их надо прогнать заново — это отдельный вечер, и на результат проверки, скорее всего, не влияет:
Channex смотрит задачи у себя, а они обе есть.

## Чего в форме нет, но спросят на созвоне

Живой показ экрана идёт по чеклисту `plans/channex-certification-pack-2026-09-11.md`, раздел
«Показ экрана: порядок действий» — восемь шагов и подготовка за час. Он актуален.

---

## Заполнено в форме 20.09.2026, 19:20 UTC

Все 34 страницы пройдены, форма стоит на последней с кнопкой «Отправить», черновик сохранён Google.
Отправку делает владелец.

Сценарий 11 закрыт одной бронью — прогон живого цикла на сервере в 19:20 UTC
(`WETOP-MUA7B9SM`, создание → перенос дат → отмена, каждый шаг дошёл до PMS за 5–6 секунд,
остаток вернулся):

| Поле | Значение |
|---|---|
| Booking ID | `6e28ce4b-f6e6-417d-817a-f49e8b296396` |
| New Revision | `fa4184ff-b882-4af6-8951-585ae5a73f30` |
| Modified Revision | `a6dc5f60-a5e8-484b-97d9-c8dd8a526547` |
| Cancelled Revision | `3e1054b6-1035-4df7-83ef-6dde7ffcfcae` |

Прежние значения из таблицы выше (бронь `a3499b4d…`) больше не нужны: они были склейкой двух
прогонов, а теперь все четыре поля от одной брони.

## Отправлено

Владелец отправил форму 20.09.2026 (Google ответил «Your response has been recorded»).
Дальше по письму Channex от 20.09: они читают анкету, сверяют task ID у себя, потом назначают живую
проверку — созвон с показом экрана **или запись видео**, где действия выполняются в нашем интерфейсе.
Срока у них нет. Staging остаётся бесплатным до прохождения, production открывают только после.

Что это значит для нас: ждать созвон необязательно. Если ожидание затянется, восемь шагов показа
(`plans/channex-certification-pack-2026-09-11.md`, «Показ экрана: порядок действий») можно записать
видео и отправить — это снимает зависимость от их календаря.
