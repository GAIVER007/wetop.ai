# WETOP + Channex staging: живой цикл брони канала (2026-09-15)

Снято 2026-09-15 12:21 UTC. Канал Booking.com (Booking CRS API, staging), категория `exely-5074688`,
ночь 2026-10-05, код WETOP-MU2N4Q4I, бронь PMS `BDC-WETOP-MU2N4Q4I`. Гость вымышленный, бронь отменена в конце цикла.

**RESULT: OK** — бронь канала прошла через PMS и экраны WETOP туда и обратно, остаток сходится.

| Шаг | Итог | Подробности |
|---|---|---|
| до брони: остаток PMS = Channex | ок | PMS 31, Channex 31 |
| бронь канала пришла в PMS | ок | BDC-WETOP-MU2N4Q4I за 12 с |
| карточка в API: канал и статус | ок | source OTA, channel Booking.com, status CONFIRMED, ячейка 5 |
| WETOP: карточка брони | ок | HTTP 200 |
| WETOP: бронь на шахматке | ок | HTTP 200 |
| WETOP: «Менеджер каналов» видит канал | ок | HTTP 200 |
| после брони: остаток PMS = Channex, на 1 меньше | ок | PMS 30, Channex 30, за 1 с |
| отмена из канала дошла до PMS | ок | статус CANCELLED за 12 с |
| после отмены: остаток вернулся, PMS = Channex | ок | PMS 31, Channex 31, за 1 с |
