# PMS и менеджеры каналов для малых отелей и хостелов: Казахстан, СНГ, мир

Дата сбора: 18.10.2026. Цены указаны в той валюте, в которой их показывает источник. Где данных нет, так и написано: «нет данных».

## Главное для WETOP

1. **На казахстанском рынке уже есть два прямых конкурента с тем же позиционированием «всё в одном + ИИ».**
   - **CheckInn** (checkinn.kz). Позиционирует себя как первую PMS, разработанную в Казахстане. В продукте есть модуль eQonaq, интеграции с WebKassa и Regula, менеджер каналов, модуль бронирования и ИИ-консьерж в WhatsApp и Telegram на казахском, русском и английском. Сайт crocos.kz/pms направляет на CheckInn. Компания CROCOS указана разработчиком самой eQonaq в реестре Казахстанской ассоциации IT-компаний ([reestr.itk.kz](http://reestr.itk.kz/reestr/293)). Значит, у CheckInn, скорее всего, есть прямой доступ к интеграции. Это вывод из косвенных данных, прямого подтверждения нет.
   - **Hotelling** (hotelling.io). Компания из Бишкека, работает в КР и РК. Цена от $59 в месяц (≈27 700 ₸) за все модули, 0% комиссии. Обещает фискализацию в КГД, Kaspi, Halyk, Forte и Freedom, ИИ-продавца, ресторанную кассу. Заявляет «регистрацию иностранцев», но eQonaq по имени не называет.
2. **eQonaq подключён в немногих продуктах.** Подтверждённые интеграции:
   - CheckInn;
   - Cross Hotel (тоже CROCOS);
   - Shelter, через хаб BMS. Бесплатно по линии Минтуризма, только для Shelter ([bmsys.net](https://bmsys.net/shelterEqonaq)).
   - Контур.Отель: на eqonaq.kz есть новость с заголовком «Интеграция с PMS Контур.Отель», но текст страницы не загрузился (страница рендерится скриптом). Детали по ней: нет данных.
   - У Bnovo, TravelLine, Exely и RealtyCalendar доказательств интеграции с eQonaq не нашлось.
   - Сам eQonaq принимает уведомления от PMS по API через «Smart Bridge» ([buhta.com](https://buhta.com/kz/ru/library/eqonaq)).
3. **Государство готовит свою PMS.** На kazakhstan.travel/en/hosts обещают национальную систему бронирования и PMS, синхронизация с eQonaq указана как «planned». Дашборд пока в разработке, цены не названы. Это потенциальный бесплатный конкурент.
4. **Рынок слабо автоматизирован**, если верить оценке самого CheckInn: PMS используют только 24% объектов в Казахстане, больше 3 200 объектов работают без неё ([блог CheckInn, 18.03.2026](http://checkinn.kz/en/blog/blog9)). Это утверждение вендора, независимой проверки нет.
5. **Общие жалобы на лидеров СНГ:** сбои синхронизации с OTA и овербукинги, медленная поддержка, минимальные платежи и доплаты за модули. Это прямо ложится на позиционирование WETOP.

## Сводная таблица (ранжирована по релевантности для WETOP)

| # | Продукт | Страна / рынок | В Казахстане | eQonaq | Менеджер каналов | Цена (публичная) | Рейтинги |
|---|---|---|---|---|---|---|---|
| 1 | CheckInn | KZ (Астана) | да, местный | да, модуль в PMS | встроен | нет данных («по размеру отеля», пробный период) | нет данных |
| 2 | Hotelling | KG + KZ | да, «работает» в Алматы | не назван (заявлен учёт иностранцев) | встроен | $59/мес до 15 номеров (≈27 700 ₸), $89 за 16–40, $129 за 41–80 | нет данных |
| 3 | Shelter (UCS) | RU, через партнёров в KZ (ATYSOFT, Pioner, r-keeper.kz, TS Автоматизация) | да | да, через хаб BMS | модуль, 40–50+ каналов | Cloud: PMS от 9 100 ₸/мес, менеджер каналов 12 600 ₸/мес (r-keeper.kz); от 8 000 ₸/мес за 10 номеров (ts-a.kz); Lite около 360 000 ₸ разово | нет данных |
| 4 | Exely (бывший TravelLine вне РФ) | международный, есть команда в KZ | да: exely.com/ru-kz, 3 сотрудника в KZ, Webkassa в PMS | нет данных | встроен, 100+ (заявлено 570+ OTA) | PMS от $36/мес (Capterra), менеджер каналов от $62 (GetApp), пример счёта $79 | HotelTechReport 4.9/5 по ~248 отзывам на менеджер каналов |
| 5 | TravelLine | RU (12 000+ клиентов) | офис в Алматы, ул. Рыскулова 69; отзыв отеля из Алматы на HotelTechReport | нет данных | встроен, 130+ | РФ: менеджер каналов 3 000 ₽/мес; междунар.: WebPMS $40, менеджер каналов $70, модуль 4% (мин. $50) | otzovik 4.2 (51 отзыв), pickTech 5.0 (27) |
| 6 | Bnovo | RU (16 000+ объектов) | слабое: приложение есть в App Store KZ, казахстанских платёжных шлюзов в списке нет | нет (только МВД РФ через Скала) | встроен: 6 OTA на «Старт», 50+ выше | 300/400/450 ₽ за номер в месяц, минимум 3 900/6 500/8 500 ₽ (−20% за год); «Максимум» +1% с модуля | crmindex: много жалоб; App Store KZ: 2 оценки |
| 7 | RealtyCalendar | RU, юрлицо в KZ (ТОО «Апартмент Системс») | да, realtycalendar.kz, цены в тенге | нет данных | встроен | от 405 ₸ в день (0–4 объекта) до 1 604 ₸ в день (31+) | a2is 4.9 (286) |
| 8 | Контур.Отель | RU | косвенно (новость на eqonaq.kz) | вероятно, детали: нет данных | модуль | РФ: годовые лицензии, например модуль бронирования до 30 номеров 11 000 ₽/год + % | нет данных |
| 9 | Cloudbeds | US, глобально, сильна в хостелах | нет данных | нет | встроен с плана One, 300+ | по запросу; по отчётам от ~$180–220/мес | Capterra: 56% негативных упоминаний цен, 68% негативных про сбои (тематическая разбивка) |
| 10 | Little Hotelier (SiteMinder) | AU, глобально | нет данных | нет | встроен, 450+ | Basics от $29–39, Pro около $109–179 (данные третьих сторон расходятся) + 1% | HTR 4.6 (1800+), Capterra 4.1 (236) |
| 11 | eZee Absolute (Yanolja) | IN, глобально | нет данных | нет | встроен, 130+ | от ~$23.86/мес за 5 номеров (только PMS) до ~$79.55 (все три модуля) | нет данных |
| 12 | Hotelogix | IN, глобально | нет данных | нет | на старших планах | от $3.99 за номер в месяц, установка $350 | нет данных |
| 13 | Mews | CZ/NL, глобально | нет данных | нет | встроен, 400 | по запросу (оценки ~€300+/мес) | нет данных |

Ниже по релевантности (цены не проверялись): RoomRaccoon (от ~£156–$300/мес, Европа), Sirvoy (4.7 и 4.8 на своём сайте, бесплатно 14 дней), Hostaway и Lodgify (посуточные квартиры, не отели), Frontdesk Anywhere (данные не собраны), Edelweiss (Эделинк, РФ, коробка: «Мини-отель» 198 353 ₽ разово, в KZ присутствия не найдено). Hotelka найти не удалось: нет данных.

## Заметки по продуктам

**CheckInn.** Сильные стороны: местный продукт, eQonaq, WebKassa, Regula, мобильное приложение, ИИ на трёх языках, облако или собственный сервер, членство в КАГиР. Слабые: цена не публикуется, отзывов не нашлось. По функциям ближе всех к WETOP.

**Hotelling.** Сильные стороны: одна цена в тенге за все модули, ресторан и склад, 1С, ИИ, кабинет гостя на 9 языках. Утверждает, что перевёл отель с Shelter за один день. Слабые: продукт из КР, отзывов нет, eQonaq прямо не назван.

**Shelter.** Самая широкая сеть партнёров в Казахстане. Есть Kaspi-терминалы, Web Kassa, учёт по койко-местам, eQonaq через BMS. На форуме отмечают медленную поддержку при стабильной системе: «Поддержка отвечает долго, это правда. Но сама система стабильная» ([pomogli.ru](https://pomogli.ru/question/kak-vybrat-crm-dlya-gostinichnogo-bizhnesa/)). Цена складывается из модулей, итог растёт.

**Exely.** Локальная команда, Webkassa в PMS (статья от 3.09.2026), сильный менеджер каналов, модуль бронирования за комиссию. Цены в USD или EUR. Про eQonaq: нет данных.

**TravelLine.** Офис в Казахстане есть, 130+ каналов. На otzovik жалуются на медленную шахматку и тарифы, на комиссию, на доплаты; есть отдельные конфликты из-за предоплаты. Казахстанских цен нет.

**Bnovo.** Самая массовая облачная PMS в РФ, цены прозрачные. Жалобы (crmindex, 2ГИС, Яндекс): ошибки выгрузки цен в OTA, овербукинги, поддержка отвечает неделями, проблемы при отключении. Казахстанской локализации (Kaspi, eQonaq) не видно.

**RealtyCalendar.** Сильна в посуточных квартирах: цена в тенге за день, залог, ссылка на оплату. Для хостела с койками релевантна слабо.

**Cloudbeds.** Глобальный лидер для хостелов. По Capterra: непрозрачные цены, сбои и слабая поддержка по почте. Казахстанской локализации нет.

**Little Hotelier, eZee, Hotelogix, Mews.** Цены в USD, сильный менеджер каналов, но нет казахстанской фискализации, Kaspi и eQonaq. Как прямые конкуренты в Казахстане слабы, полезны как ориентир по функциям.

## Что не подтверждено

- Цену CheckInn и есть ли у Hotelling именно eQonaq, лучше уточнить звонком (телефоны есть на их сайтах).
- Полный список PMS-партнёров eQonaq: страница eqonaq.kz/integration рендерится скриптом и не прочиталась.
- Какие системы реально используют отели Казахстана: статистики, кроме оценки CheckInn, не нашлось.

## Источники

- eQonaq: [kazakhstan.travel/en/hosts](https://kazakhstan.travel/en/hosts), [eqonaq.kz](https://eqonaq.kz/), [новость про Контур.Отель](https://eqonaq.kz/news-detail-67?lang=ru%2F), [реестр ITK](http://reestr.itk.kz/reestr/293), [buhta.com](https://buhta.com/kz/ru/library/eqonaq), [inform.kz](https://www.inform.kz/ru/v-kazahstane-usilili-kontrol-za-registratsiey-turistov-cherez-sistemu-eqonaq-8063db), [Google Play eQonaq](https://play.google.com/store/apps/details?hl=en_US&id=kz.eqonaq.app)
- CheckInn: [checkinn.kz](https://checkinn.kz/), [checkinn.kz/en](https://checkinn.kz/en), [блог про eQonaq](http://checkinn.kz/en/blog/blog9), [crocos.kz/cross-hotel](https://crocos.kz/cross-hotel), [crocos.kz/pms](https://crocos.kz/pms)
- Hotelling: [hotelling.io](https://hotelling.io/), [hotelling.io/pms-kazakhstan](https://hotelling.io/pms-kazakhstan/)
- Shelter: [bmsys.net](https://bmsys.net/shelterEqonaq), [atysoft.kz](https://atysoft.kz/), [r-keeper.kz калькулятор](https://r-keeper.kz/solutions/kalkulyator-shelter-cloud.php), [ts-a.kz](https://ts-a.kz/shelter/compare/), [shelter.ru/price-calc](https://shelter.ru/price-calc/)
- Exely: [exely.com/ru-kz](https://exely.com/ru-kz/), [Webkassa в Exely PMS](https://exely.com/ru/help/kb346895/), [Capterra](https://www.capterra.co.uk/software/1061053/exely-pms), [GetApp](https://www.getapp.com/hospitality-travel-software/a/exely/), [HotelTechReport](https://hoteltechreport.com/compare/exely-channel-manager-vs-roommaster-channel-manager)
- TravelLine: [travelline.pro/pricing](https://www.travelline.pro/pricing), [менеджер каналов РФ](https://www.travelline.ru/products/channel-manager/), [отзыв из Алматы](https://hoteltechreport.com/reviews/8l5m34d85x13), [otzovik](https://otzovik.com/reviews/travelline_ru-sistema_bronirovaniya_oteley/2/), [pickTech](https://picktech.ru/product/travelline-platforma-dlya-otelera/reviews/)
- Bnovo: [bnovo.ru/tarif](https://bnovo.ru/tarif/), [интеграции](https://bnovo.ru/integration/), [crmindex отзывы](https://crmindex.ru/products/bnovo/reviews), [2ГИС отзывы](https://2gis.ru/spb/firm/70000001007207934/tab/reviews), [App Store KZ](https://apps.apple.com/kz/app/bnovo/id1626268221)
- RealtyCalendar: [realtycalendar.kz](http://realtycalendar.kz/)
- Контур.Отель: [прайс РФ](https://kontur.ru/Files/userfiles/file/products/hotel/standart-zona-1.pdf)
- Edelweiss: [стоимость](https://support.edelink.ru/products/edelweiss/cost)
- Глобальные: [Cloudbeds на Capterra](https://www.capterra.com/p/158839/Cloudbeds/), [roommaster о ценах Cloudbeds](https://www.roommaster.com/blog/cloudbeds-pricing), [цены Mews](https://www.mews.com/en/pricing), [цены Little Hotelier](https://www.littlehotelier.com/pricing/), [Sirvoy](https://sirvoy.com/pricing/), [staysynq: сравнение](https://staysynq.com/best/hotel-pms-software), [hotelsmarters](https://hotelsmarters.com/blog/best-hotel-management-software), [codingclave India](https://codingclave.com/blog/best-hotel-management-software-india-2026)
