# WETOP + Channex staging: живой цикл брони канала (2026-09-14)

Снято 2026-09-14 08:11 UTC. Канал Booking.com (Booking CRS API, staging), категория `retired-source-5074688`,
ночь 2026-10-04, код WETOP-MU0YRKY4, бронь PMS `BDC-WETOP-MU0YRKY4`. Гость вымышленный, бронь отменена в конце цикла.

**RESULT: OK** — бронь канала прошла через PMS и экраны WETOP туда и обратно, остаток сходится.

| Шаг | Итог | Подробности |
|---|---|---|
| до брони: остаток PMS = Channex | ок | PMS 32, Channex 32 |
| бронь канала пришла в PMS | ок | BDC-WETOP-MU0YRKY4 за 12 с |
| карточка в API: канал и статус | ок | source OTA, channel Booking.com, status CONFIRMED, ячейка 5 |
| WETOP: карточка брони | ок | HTTP 200 |
| WETOP: бронь на шахматке | ок | HTTP 200 |
| WETOP: «Менеджер каналов» видит канал | ок | HTTP 200 |
| после брони: остаток PMS = Channex, на 1 меньше | ок | PMS 31, Channex 31, за 1 с |
| отмена из канала дошла до PMS | ок | статус CANCELLED за 12 с |
| после отмены: остаток вернулся, PMS = Channex | ок | PMS 32, Channex 32, за 1 с |
