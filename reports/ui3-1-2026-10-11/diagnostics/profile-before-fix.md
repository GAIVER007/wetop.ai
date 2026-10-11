# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile-menu-readiness.spec.ts >> до готовности кнопка недоступна и выглядит недоступной, нажатие по ней меню не открывает
- Location: tests/ui/profile-menu-readiness.spec.ts:51:1

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://127.0.0.1:3191/chessboard
Call log:
  - navigating to "http://127.0.0.1:3191/chessboard", waiting until "commit"

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - link "К содержимому" [ref=f2e3] [cursor=pointer]:
      - /url: "#main-content"
    - banner [ref=f2e4]:
      - generic [ref=f2e5]:
        - complementary [ref=f2e6]:
          - navigation "Разделы" [ref=f2e7]:
            - button "Открыть меню" [ref=f2e8] [cursor=pointer]:
              - generic [ref=f2e10]: Финансы
        - link "WETOP, стартовый экран" [ref=f2e11] [cursor=pointer]:
          - /url: /finance
          - generic [ref=f2e12]: W
          - generic [ref=f2e13]: WETOP.AI
        - button "Выбрать филиал" [ref=f2e16] [cursor=pointer]:
          - generic [ref=f2e22]:
            - strong [ref=f2e23]: Luxx Aparts
            - generic [ref=f2e24]: Тестовый адрес, 1
        - button "Найти гостя или бронь" [ref=f2e27] [cursor=pointer]:
          - generic [ref=f2e31]: Поиск гостя, брони, номера...
          - generic [ref=f2e32]: ⌘ K
        - generic [ref=f2e33]:
          - button "Переключить тему" [ref=f2e34] [cursor=pointer]
          - button "Меню администратора" [ref=f2e38] [cursor=pointer]:
            - generic [ref=f2e39]: ДТ
            - generic [ref=f2e40]:
              - strong [ref=f2e41]: Дана Тестова
              - generic [ref=f2e42]: Владелец
    - main [ref=f2e47]:
      - generic [ref=f2e48]:
        - generic [ref=f2e49]:
          - heading "Обзор бизнеса" [level=1] [ref=f2e50]
          - generic [ref=f2e51]: Ключевые показатели, деньги, загрузка и задачи в одном месте
        - navigation "Действия страницы" [ref=f2e52]:
          - navigation "Период обзора" [ref=f2e53]:
            - link "За период с 01.10.2026 по 31.10.2026" [ref=f2e54] [cursor=pointer]:
              - /url: "#finance-filters"
            - link "Сегодня" [ref=f2e55] [cursor=pointer]:
              - /url: /finance?from=2026-10-11&to=2026-10-11
            - link "7 дней" [ref=f2e56] [cursor=pointer]:
              - /url: /finance?from=2026-10-05&to=2026-10-11
            - link "Месяц" [ref=f2e57] [cursor=pointer]:
              - /url: /finance?from=2026-10-01&to=2026-10-31
          - button "Обновить данные" [ref=f2e58] [cursor=pointer]
      - generic [ref=f2e64]:
        - region "Ключевые показатели" [ref=f2e65]:
          - generic [ref=f2e70]:
            - generic [ref=f2e71]: Выручка за месяц
            - generic [ref=f2e72]: 136 000 ₸
            - generic [ref=f2e73]: нет базы для сравнения
            - generic [ref=f2e74]: к прошлому периоду
          - generic [ref=f2e80]:
            - generic [ref=f2e81]: Чистая прибыль
            - generic [ref=f2e82]: 136 000 ₸
            - generic [ref=f2e83]: нет базы для сравнения
            - generic [ref=f2e84]: поступления минус расходы
          - generic [ref=f2e89]:
            - generic [ref=f2e90]: Загрузка сегодня
            - generic [ref=f2e91]: 8 %
            - generic [ref=f2e92]:
              - generic [aria-hidden] [ref=f2e93]: ↑
              - text: +2,3 п.п.
            - generic [ref=f2e94]: к вчера
          - generic [ref=f2e100]:
            - generic [ref=f2e101]: Заезды сегодня
            - generic [ref=f2e102]: "3"
            - generic [ref=f2e103]:
              - generic [aria-hidden] [ref=f2e104]: ↑
              - text: "+3"
            - generic [ref=f2e105]: к вчера
          - generic [ref=f2e111]:
            - generic [ref=f2e112]: Выезды сегодня
            - generic [ref=f2e113]: "2"
            - generic [ref=f2e114]:
              - generic [aria-hidden] [ref=f2e115]: ↑
              - text: "+2"
            - generic [ref=f2e116]: к вчера
          - generic [ref=f2e121]:
            - generic [ref=f2e122]: К оплате / Долги
            - generic [ref=f2e123]: 80 000 ₸
            - generic [ref=f2e124]: остаток по броням периода
          - generic [ref=f2e130]:
            - generic [ref=f2e131]: Свободно мест
            - generic [ref=f2e132]: "81"
            - generic [ref=f2e133]: из 88
        - generic [ref=f2e134]:
          - region [ref=f2e135]:
            - generic [ref=f2e136]:
              - heading "Загрузка и операционные показатели" [level=2] [ref=f2e137]
              - link "Подробнее" [ref=f2e138] [cursor=pointer]:
                - /url: /management/analytics/occupancy?date=2026-10-11
            - generic [ref=f2e139]:
              - generic [ref=f2e140]:
                - strong [ref=f2e141]: 8 %
                - generic [ref=f2e142]:
                  - generic [ref=f2e143]:
                    - term [ref=f2e144]: Занято
                    - definition [ref=f2e145]: "7"
                  - generic [ref=f2e146]:
                    - term [ref=f2e147]: Свободно
                    - definition [ref=f2e148]: "81"
              - generic [ref=f2e153]:
                - strong [ref=f2e154]: "88"
                - generic [ref=f2e155]: мест всего
            - generic [ref=f2e156]:
              - generic [ref=f2e157]:
                - heading "Прогноз загрузки на 7 дней" [level=3] [ref=f2e158]
                - button "Загрузка по дням" [ref=f2e159] [cursor=pointer]: По дням
              - list "Загрузка по дням" [ref=f2e162]:
                - 'listitem "воскресенье, 11 октября 2026 г.: 8 %, свободно 81" [ref=f2e163]':
                  - 'link "воскресенье, 11 октября 2026 г.: загрузка 8 %, свободно 81. Открыть календарь" [ref=f2e164] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-11&to=2026-10-11
                    - strong [ref=f2e165]: 8 %
                    - generic [ref=f2e168]: Сегодня
                - 'listitem "понедельник, 12 октября 2026 г.: 8 %, свободно 81" [ref=f2e169]':
                  - 'link "понедельник, 12 октября 2026 г.: загрузка 8 %, свободно 81. Открыть календарь" [ref=f2e170] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-12&to=2026-10-12
                    - strong [ref=f2e171]: 8 %
                    - generic [ref=f2e174]: пн
                - 'listitem "вторник, 13 октября 2026 г.: 8 %, свободно 81" [ref=f2e175]':
                  - 'link "вторник, 13 октября 2026 г.: загрузка 8 %, свободно 81. Открыть календарь" [ref=f2e176] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-13&to=2026-10-13
                    - strong [ref=f2e177]: 8 %
                    - generic [ref=f2e180]: вт
                - 'listitem "среда, 14 октября 2026 г.: 0 %, свободно 88" [ref=f2e181]':
                  - 'link "среда, 14 октября 2026 г.: загрузка 0 %, свободно 88. Открыть календарь" [ref=f2e182] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-14&to=2026-10-14
                    - strong [ref=f2e183]: 0 %
                    - generic [ref=f2e186]: ср
                - 'listitem "четверг, 15 октября 2026 г.: 0 %, свободно 88" [ref=f2e187]':
                  - 'link "четверг, 15 октября 2026 г.: загрузка 0 %, свободно 88. Открыть календарь" [ref=f2e188] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-15&to=2026-10-15
                    - strong [ref=f2e189]: 0 %
                    - generic [ref=f2e192]: чт
                - 'listitem "пятница, 16 октября 2026 г.: 0 %, свободно 88" [ref=f2e193]':
                  - 'link "пятница, 16 октября 2026 г.: загрузка 0 %, свободно 88. Открыть календарь" [ref=f2e194] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-16&to=2026-10-16
                    - strong [ref=f2e195]: 0 %
                    - generic [ref=f2e198]: пт
                - 'listitem "суббота, 17 октября 2026 г.: 0 %, свободно 88" [ref=f2e199]':
                  - 'link "суббота, 17 октября 2026 г.: загрузка 0 %, свободно 88. Открыть календарь" [ref=f2e200] [cursor=pointer]':
                    - /url: /chessboard?from=2026-10-17&to=2026-10-17
                    - strong [ref=f2e201]: 0 %
                    - generic [ref=f2e204]: сб
          - region [ref=f2e205]:
            - generic [ref=f2e206]:
              - heading "Финансовый обзор" [level=2] [ref=f2e207]
              - link "Подробнее" [ref=f2e208] [cursor=pointer]:
                - /url: /finance?from=2026-10-01&to=2026-10-31&show=1#operations
            - generic [ref=f2e209]:
              - generic [ref=f2e210]:
                - text: Поступления
                - strong [ref=f2e211]: 136 000 ₸
                - generic [ref=f2e212]: нет базы для сравнения к прошлому периоду
              - generic [ref=f2e213]:
                - text: Расходы
                - strong [ref=f2e214]: 0 ₸
                - generic [ref=f2e215]: нет базы для сравнения к прошлому периоду
            - generic [ref=f2e216]:
              - generic [ref=f2e217]:
                - heading "Движение денег по дням" [level=3] [ref=f2e218]
                - list [ref=f2e219]:
                  - 'listitem "четверг, 1 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e220]'
                  - 'listitem "пятница, 2 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e224]'
                  - 'listitem "суббота, 3 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e228]'
                  - 'listitem "воскресенье, 4 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e232]'
                  - 'listitem "понедельник, 5 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e236]'
                  - 'listitem "вторник, 6 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e240]'
                  - 'listitem "среда, 7 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e244]'
                  - 'listitem "четверг, 8 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e248]'
                  - 'listitem "пятница, 9 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e252]'
                  - 'listitem "суббота, 10 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e256]'
                  - 'listitem "воскресенье, 11 октября 2026 г.: поступления 136 000 ₸, расходы 0 ₸" [ref=f2e260]'
                  - 'listitem "понедельник, 12 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e264]'
                  - 'listitem "вторник, 13 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e268]'
                  - 'listitem "среда, 14 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e272]'
                  - 'listitem "четверг, 15 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e276]'
                  - 'listitem "пятница, 16 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e280]'
                  - 'listitem "суббота, 17 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e284]'
                  - 'listitem "воскресенье, 18 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e288]'
                  - 'listitem "понедельник, 19 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e292]'
                  - 'listitem "вторник, 20 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e296]'
                  - 'listitem "среда, 21 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e300]'
                  - 'listitem "четверг, 22 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e304]'
                  - 'listitem "пятница, 23 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e308]'
                  - 'listitem "суббота, 24 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e312]'
                  - 'listitem "воскресенье, 25 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e316]'
                  - 'listitem "понедельник, 26 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e320]'
                  - 'listitem "вторник, 27 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e324]'
                  - 'listitem "среда, 28 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e328]'
                  - 'listitem "четверг, 29 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e332]'
                  - 'listitem "пятница, 30 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e336]'
                  - 'listitem "суббота, 31 октября 2026 г.: поступления 0 ₸, расходы 0 ₸" [ref=f2e340]'
                - generic [aria-hidden] [ref=f2e344]:
                  - generic [ref=f2e345]: 1 окт.
                  - generic [ref=f2e346]: 31 окт.
                - paragraph [ref=f2e347]: поступления расходы
              - generic [ref=f2e350]:
                - heading "Остаток на счетах" [level=3] [ref=f2e351]
                - strong [ref=f2e352]: 136 000 ₸
                - generic [ref=f2e353]:
                  - generic [ref=f2e354]:
                    - term [ref=f2e355]: Наличные
                    - definition [ref=f2e357]: 136 000 ₸
                  - generic [ref=f2e358]:
                    - term [ref=f2e359]: Kaspi
                    - definition [ref=f2e361]: 0 ₸
                  - generic [ref=f2e362]:
                    - term [ref=f2e363]: Halyk
                    - definition [ref=f2e365]: 0 ₸
                  - generic [ref=f2e366]:
                    - term [ref=f2e367]: Карта (терминал)
                    - definition [ref=f2e369]: 0 ₸
        - generic [ref=f2e370]:
          - region [ref=f2e371]:
            - generic [ref=f2e372]:
              - heading "Поступления по способам оплаты" [level=2] [ref=f2e373]
              - link "Подробнее" [ref=f2e374] [cursor=pointer]:
                - /url: /finance?from=2026-10-01&to=2026-10-31&op=payment#operations
            - list [ref=f2e375]:
              - listitem [ref=f2e376]:
                - link "Наличные" [ref=f2e377] [cursor=pointer]:
                  - /url: /finance?from=2026-10-01&to=2026-10-31&op=payment&method=CASH#operations
                - strong [ref=f2e378]: 8 000 ₸
                - generic [ref=f2e379]:
                  - progressbar "Доля способа «Наличные»" [ref=f2e380]
                  - generic [ref=f2e381]: 100 %
          - region [ref=f2e382]:
            - generic [ref=f2e383]:
              - heading "Сегодня" [level=2] [ref=f2e384]
              - generic [ref=f2e385]: воскресенье, 11 октября 2026 г.
            - generic [ref=f2e386]:
              - link "Заезды 3" [ref=f2e387] [cursor=pointer]:
                - /url: /reservations?arrival=2026-10-11
                - generic [ref=f2e392]: Заезды
                - strong [ref=f2e393]: "3"
              - link "Выезды 2" [ref=f2e394] [cursor=pointer]:
                - /url: /reservations?departure=2026-10-11
                - generic [ref=f2e399]: Выезды
                - strong [ref=f2e400]: "2"
              - link "Ожидают заселения 3" [ref=f2e401] [cursor=pointer]:
                - /url: /reservations?arrival=2026-10-11
                - generic [ref=f2e406]: Ожидают заселения
                - strong [ref=f2e407]: "3"
              - link "Ожидают выезда 1" [ref=f2e408] [cursor=pointer]:
                - /url: /reservations?departure=2026-10-11
                - generic [ref=f2e413]: Ожидают выезда
                - strong [ref=f2e414]: "1"
            - link "Брони без оплаты 5 80 000 ₸" [ref=f2e415] [cursor=pointer]:
              - /url: /finance?from=2026-10-01&to=2026-10-31#debts
              - generic [ref=f2e419]: Брони без оплаты 5
              - strong [ref=f2e420]: 80 000 ₸
            - paragraph [ref=f2e423]:
              - text: "К оплате у выезжающих:"
              - strong [ref=f2e424]: 0 ₸
          - region [ref=f2e425]:
            - heading "Что требует внимания" [level=2] [ref=f2e427]
            - list [ref=f2e428]:
              - listitem [ref=f2e429]:
                - link "5 Брони без оплаты на сумму 80 000 ₸" [ref=f2e430] [cursor=pointer]:
                  - /url: /finance?from=2026-10-01&to=2026-10-31#debts
                  - generic [ref=f2e431]: "5"
                  - generic [ref=f2e432]:
                    - strong [ref=f2e433]: Брони без оплаты
                    - generic [ref=f2e434]: на сумму 80 000 ₸
              - listitem [ref=f2e437]:
                - link "1 Просроченные платежи время выезда прошло, остаток не оплачен" [ref=f2e438] [cursor=pointer]:
                  - /url: /finance?from=2026-10-01&to=2026-10-31&debts=overdue#debts
                  - generic [ref=f2e439]: "1"
                  - generic [ref=f2e440]:
                    - strong [ref=f2e441]: Просроченные платежи
                    - generic [ref=f2e442]: время выезда прошло, остаток не оплачен
              - listitem [ref=f2e445]:
                - 'link "7 Низкая загрузка 11 окт. и дальше: ниже 40 %" [ref=f2e446] [cursor=pointer]':
                  - /url: /chessboard?from=2026-10-11&to=2026-10-11
                  - generic [ref=f2e447]: "7"
                  - generic [ref=f2e448]:
                    - strong [ref=f2e449]: Низкая загрузка
                    - generic [ref=f2e450]: "11 окт. и дальше: ниже 40 %"
            - button "Все задачи" [ref=f2e453] [cursor=pointer]:
              - generic [ref=f2e455]: "8"
        - region [ref=f2e458]:
          - generic [ref=f2e459]:
            - heading "Последние операции" [level=2] [ref=f2e460]
            - link "Все операции" [ref=f2e461] [cursor=pointer]:
              - /url: /finance?from=2026-10-01&to=2026-10-31&show=1#operations
          - region "Таблица последних операций" [ref=f2e462]:
            - table "Таблица последних операций" [ref=f2e463]:
              - rowgroup [ref=f2e464]:
                - row [ref=f2e465]:
                  - columnheader "Дата и время" [ref=f2e466]
                  - columnheader "Тип" [ref=f2e467]
                  - columnheader "Описание" [ref=f2e468]
                  - columnheader "Сумма" [ref=f2e469]
                  - columnheader "Способ" [ref=f2e470]
                  - columnheader "Статус" [ref=f2e471]
              - rowgroup [ref=f2e472]:
                - row [ref=f2e473]:
                  - cell [ref=f2e474]:
                    - time [ref=f2e475]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e476]
                  - cell [ref=f2e477]:
                    - text: Клиент Пример
                    - link "20260913-TEST1" [ref=f2e478] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST1#booking-finance
                  - cell "+24 000 ₸" [ref=f2e479]
                  - cell "Наличные" [ref=f2e480]
                  - cell "проведена" [ref=f2e481]
                - row [ref=f2e483]:
                  - cell [ref=f2e484]:
                    - time [ref=f2e485]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e486]
                  - cell [ref=f2e487]:
                    - text: Гость Учебный
                    - link "20260913-TEST2" [ref=f2e488] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST2#booking-finance
                  - cell "+8 000 ₸" [ref=f2e489]
                  - cell "Наличные" [ref=f2e490]
                  - cell "проведена" [ref=f2e491]
                - row [ref=f2e493]:
                  - cell [ref=f2e494]:
                    - time [ref=f2e495]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e496]
                  - cell [ref=f2e497]:
                    - text: Посетитель Демо
                    - link "20260913-TEST3" [ref=f2e498] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST3#booking-finance
                  - cell "+24 000 ₸" [ref=f2e499]
                  - cell "Наличные" [ref=f2e500]
                  - cell "проведена" [ref=f2e501]
                - row [ref=f2e503]:
                  - cell [ref=f2e504]:
                    - time [ref=f2e505]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e506]
                  - cell [ref=f2e507]:
                    - text: Клиент Пример
                    - link "20260913-TEST4" [ref=f2e508] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST4#booking-finance
                  - cell "+8 000 ₸" [ref=f2e509]
                  - cell "Наличные" [ref=f2e510]
                  - cell "проведена" [ref=f2e511]
                - row [ref=f2e513]:
                  - cell [ref=f2e514]:
                    - time [ref=f2e515]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e516]
                  - cell [ref=f2e517]:
                    - text: Гость Учебный
                    - link "20260913-TEST5" [ref=f2e518] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST5#booking-finance
                  - cell "+24 000 ₸" [ref=f2e519]
                  - cell "Наличные" [ref=f2e520]
                  - cell "проведена" [ref=f2e521]
                - row [ref=f2e523]:
                  - cell [ref=f2e524]:
                    - time [ref=f2e525]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e526]
                  - cell [ref=f2e527]:
                    - text: Посетитель Демо
                    - link "20260913-TEST6" [ref=f2e528] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST6#booking-finance
                  - cell "+8 000 ₸" [ref=f2e529]
                  - cell "Наличные" [ref=f2e530]
                  - cell "проведена" [ref=f2e531]
                - row [ref=f2e533]:
                  - cell [ref=f2e534]:
                    - time [ref=f2e535]: 11 окт., 12:00
                  - cell "Оплата" [ref=f2e536]
                  - cell [ref=f2e537]:
                    - text: Клиент Пример
                    - link "20260913-TEST7" [ref=f2e538] [cursor=pointer]:
                      - /url: /reservations/20260913-TEST7#booking-finance
                  - cell "+24 000 ₸" [ref=f2e539]
                  - cell "Наличные" [ref=f2e540]
                  - cell "проведена" [ref=f2e541]
      - region "Фильтры операций" [ref=f2e543]:
        - generic [ref=f2e544]:
          - generic [ref=f2e545]:
            - text: С
            - generic [ref=f2e546]:
              - 'textbox "Период: с" [ref=f2e547]': 2026-10-01
              - button "Открыть календарь" [ref=f2e548] [cursor=pointer]
          - generic [ref=f2e551]:
            - text: По
            - generic [ref=f2e552]:
              - 'textbox "Период: по" [ref=f2e553]': 2026-10-31
              - button "Открыть календарь" [ref=f2e554] [cursor=pointer]
          - navigation "Готовые периоды" [ref=f2e557]:
            - generic [ref=f2e558]: "Период:"
            - link "Сегодня" [ref=f2e559] [cursor=pointer]:
              - /url: /finance?from=2026-10-11&to=2026-10-11
            - link "Вчера" [ref=f2e560] [cursor=pointer]:
              - /url: /finance?from=2026-10-10&to=2026-10-10
            - link "Неделя" [ref=f2e561] [cursor=pointer]:
              - /url: /finance?from=2026-10-05&to=2026-10-11
            - link "Месяц" [ref=f2e562] [cursor=pointer]:
              - /url: /finance?from=2026-10-01&to=2026-10-31
            - link "Прошлый месяц" [ref=f2e563] [cursor=pointer]:
              - /url: /finance?from=2026-09-01&to=2026-09-30
          - generic [ref=f2e564]:
            - text: Тип операции
            - combobox "Тип операции" [ref=f2e565]:
              - option "Все операции" [selected]
              - option "Оплаты"
              - option "Возвраты"
              - option "Поступления кассы"
              - option "Расходы кассы"
              - option "Переводы"
          - generic [ref=f2e566]:
            - text: Способ оплаты
            - combobox "Способ оплаты" [ref=f2e567]:
              - option "Все способы" [selected]
              - option "Наличные"
              - option "Карта (терминал)"
              - option "Kaspi"
              - option "Halyk"
              - option "Перевод от физлица"
              - option "Перевод от юрлица"
              - option "Депозит"
              - option "Гарантия картой"
              - option "Внешний канал"
          - group [ref=f2e568]:
            - generic "Дополнительные фильтры" [ref=f2e569] [cursor=pointer]
            - option "Все источники" [selected]
            - option "Брони"
            - option "Касса"
          - generic [ref=f2e572]:
            - button "Показать" [ref=f2e573] [cursor=pointer]
            - link "Сбросить фильтр" [ref=f2e574] [cursor=pointer]:
              - /url: /finance?from=2026-10-01&to=2026-10-31
      - button "Отчёты и управление" [ref=f2e576] [cursor=pointer]
  - alert [ref=f2e579]
```

# Test source

```ts
  63  |   await page
  64  |     .waitForFunction(
  65  |       "!document.getAnimations().some((a) => a.constructor.name === 'CSSTransition')",
  66  |       null,
  67  |       { timeout: THEME_TRANSITION_MS },
  68  |     )
  69  |     .catch(() => undefined);
  70  | }
  71  | 
  72  | /**
  73  |  * Тот же класс без смены темы (разбор 09.10.2026, «История ночи» в `market.spec`): панель выезжает CSS-анимацией
  74  |  * `drawer-in`, и axe, позванный сразу после щелчка, мерил полупрозрачный текст, цвета плавали от прогона к прогону.
  75  |  * Обёртка `emulateMedia` тут не срабатывает (темы не меняли, анимация не переход), поэтому ждём перед каждым
  76  |  * замером axe: конец всех конечных анимаций и переходов, с потолком. Бесконечные (спиннер) не ждём.
  77  |  */
  78  | const MOTION_SETTLE_MS = 1000;
  79  | const SETTLE_MOTION = `Promise.race([
  80  |   Promise.all(document.getAnimations()
  81  |     .filter((a) => a.effect?.getTiming().iterations !== Infinity)
  82  |     .map((a) => a.finished.catch(() => undefined))),
  83  |   new Promise((r) => setTimeout(r, ${MOTION_SETTLE_MS})),
  84  | ]).then(() => true)`;
  85  | 
  86  | const axeAnalyze = AxeBuilder.prototype.analyze;
  87  | AxeBuilder.prototype.analyze = async function analyze(this: AxeBuilder) {
  88  |   // `page` у AxeBuilder приватное поле; публичного способа дождаться страницы перед замером нет
  89  |   const page = (this as unknown as { page: Page }).page;
  90  |   await page.evaluate(SETTLE_MOTION).catch(() => undefined);
  91  |   return axeAnalyze.call(this);
  92  | };
  93  | 
  94  | export * from '@playwright/test';
  95  | 
  96  | /**
  97  |  * Шум `next dev`, а не ошибка стойки: React ведёт собственную дорожку замеров, и на странице,
  98  |  * пришедшей через redirect(), подаёт начало серверного рендера раньше timeOrigin вкладки —
  99  |  * браузер отвечает отказом `measure`. Приходит и как console.error, и как необработанное
  100 |  * исключение страницы; в сборке этой дорожки нет (разбор 21.09.2026).
  101 |  */
  102 | export const devNoise = /Failed to execute 'measure' on 'Performance'/;
  103 | 
  104 | /**
  105 |  * ADR-134 (02.10.2026, поручение владельца): навигация стойки сверху, шапка из двух строк, `--header-h` 72 → 100 px.
  106 |  * Владелец принял, что экраны отдают шапке эту высоту («шахматка на компьютере теряет 28 px высоты»). Проверки
  107 |  * «помещается на экране ноутбука», заданные до 02.10.2026, считали место под содержимое при прежней шапке: бюджет
  108 |  * содержимого у них прежний, бюджет окна больше ровно на рост шапки. Всё, что сверх, это рост самого экрана, и
  109 |  * проверка его ловит (разбор полного UI 03.10.2026, `docs/history/2026-10-03-double-shift.md`).
  110 |  */
  111 | export const HEADER_GROWTH_PX = 28;
  112 | 
  113 | /**
  114 |  * Оживил ли React этот узел. Сервер рисует кнопку раньше, чем браузер получит и выполнит скрипты стойки, и клик в
  115 |  * этот промежуток пропадает: кнопка видна, а обработчика у неё ещё нет. Признак оживления: служебное свойство React
  116 |  * на самом узле (`__reactProps$…`), его ставят вместе с обработчиками (тот же признак, что у `ai-seller.spec.ts`).
  117 |  * На медленном раннере GitHub промежуток доходит до секунд: TESTING.md, строки 20.09 (`real-data`), 27.09
  118 |  * (`ai-seller`) и 03.10 (`login-access`, release-checks #7).
  119 |  */
  120 | export async function hydrated(target: Locator): Promise<void> {
  121 |   await expect
  122 |     .poll(
  123 |       () =>
  124 |         target.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))),
  125 |       { message: 'React не оживил элемент: скрипты стойки не дошли или упали', timeout: 30_000 },
  126 |     )
  127 |     .toBe(true);
  128 | }
  129 | 
  130 | /**
  131 |  * «Меню администратора» в шапке: нажать, когда React оживил кнопку, и убедиться, что меню раскрылось. Спеки открывают
  132 |  * меню профиля только так (сторож `tests/unit/ui-profile-menu.test.ts`); возвращает саму кнопку.
  133 |  */
  134 | export async function openProfileMenu(page: Page): Promise<Locator> {
  135 |   const menu = page.getByRole('button', { name: 'Меню администратора' });
  136 |   await hydrated(menu);
  137 |   await menu.click();
  138 |   await expect(menu).toHaveAttribute('aria-expanded', 'true');
  139 |   return menu;
  140 | }
  141 | 
  142 | /**
  143 |  * Обучение в стойке (ADR-100) само открывается на Главной у вошедшего, пока в браузере нет отметки «пройдено».
  144 |  * Спекам, которые входят и работают на Главной, окно поверх экрана не нужно: по умолчанию стенд считает обучение
  145 |  * пройденным. Спек обучения включает его сам: `test.use({ tour: true })`.
  146 |  */
  147 | const TOUR_DONE_SCRIPT = `(() => {
  148 |   try {
  149 |     const get = Storage.prototype.getItem;
  150 |     Storage.prototype.getItem = function (key) {
  151 |       const value = get.call(this, key);
  152 |       return value === null && typeof key === 'string' && key.startsWith('wetop.tour.v1:') ? 'done' : value;
  153 |     };
  154 |   } catch (e) {}
  155 | })();`;
  156 | 
  157 | export const test = base.extend<{ tour: boolean }>({
  158 |   tour: [false, { option: true }],
  159 |   page: async ({ page, tour }, use) => {
  160 |     if (!tour) await page.addInitScript(TOUR_DONE_SCRIPT);
  161 |     const goto = page.goto.bind(page);
  162 |     page.goto = async (url, options) => {
> 163 |       const response = await goto(url, options);
      |                              ^ Error: page.goto: net::ERR_ABORTED at http://127.0.0.1:3191/chessboard
  164 |       await settleStreaming(page);
  165 |       return response;
  166 |     };
  167 |     const reload = page.reload.bind(page);
  168 |     page.reload = async (options) => {
  169 |       const response = await reload(options);
  170 |       await settleStreaming(page);
  171 |       return response;
  172 |     };
  173 |     const emulateMedia = page.emulateMedia.bind(page);
  174 |     page.emulateMedia = async (options) => {
  175 |       await emulateMedia(options);
  176 |       if (options?.colorScheme) await settleTheme(page, options.colorScheme);
  177 |     };
  178 |     await use(page);
  179 |   },
  180 | });
  181 | 
  182 | export { expect };
  183 | 
  184 | /**
  185 |  * Адрес подставного API для запросов спека (`__test/reset`, `__test/control`). Дерево делят несколько сессий, и
  186 |  * 4311 бывает занят соседним прогоном: `playwright.alt.config.ts` поднимает свой стенд и передаёт его адрес
  187 |  * `UI_FIXTURE_API` (календарные спеки задавали тот же стенд через `FIXTURE_PORT`, поэтому понимаем и его).
  188 |  * Спек, у которого адрес зашит константой, в этом случае сбрасывает и настраивает ЧУЖУЮ фикстуру,
  189 |  * а страницу читает со своей. 03.10.2026 так падал `ai-seller.spec` на «Коде для сайта»: `sellerHosts: []` уехал
  190 |  * соседу, своя фикстура осталась с доменом, и подсказка «сайта нет» на странице не появлялась.
  191 |  */
  192 | const fixturePort = process.env['FIXTURE_PORT'];
  193 | export const FIXTURE_API =
  194 |   process.env['UI_FIXTURE_API'] ??
  195 |   (fixturePort ? `http://127.0.0.1:${fixturePort}` : 'http://127.0.0.1:4311');
  196 | 
  197 | /**
  198 |  * Окошко «Фильтры» календаря. С 09.10.2026 (образец владельца) категория и «Места» живут в нём, а не
  199 |  * в строке над сеткой: открыть, выбрать и «Применить».
  200 |  */
  201 | export async function openBoardFilters(page: Page) {
  202 |   await page
  203 |     .getByRole('main')
  204 |     .getByRole('button', { name: /^Фильтры( \d+)?$/ })
  205 |     .click();
  206 |   const pop = page.getByRole('dialog', { name: 'Фильтры календаря' });
  207 |   await expect(pop).toBeVisible();
  208 |   return pop;
  209 | }
  210 | 
  211 | /** Выбрать категорию и/или состояние места в окошке «Фильтры» и применить */
  212 | export async function boardFilter(page: Page, pick: { category?: string; state?: string }) {
  213 |   const pop = await openBoardFilters(page);
  214 |   if (pick.category !== undefined)
  215 |     await pop.getByLabel('Категория в календаре').selectOption(pick.category);
  216 |   if (pick.state !== undefined) await pop.getByLabel('Места в календаре').selectOption(pick.state);
  217 |   await pop.getByRole('button', { name: 'Применить', exact: true }).click();
  218 |   await expect(pop).toBeHidden();
  219 | }
  220 | 
  221 | /**
  222 |  * Левое меню (ADR-161). `sideNav`: навигация «Разделы» в колонке слева; `menuLinks`: все адреса меню, каждый ровно
  223 |  * один раз (подразделы всех разделов лежат в панели, виден один).
  224 |  */
  225 | export const sideNav = (page: Page) => page.locator('.sidenav');
  226 | export const menuLinks = (page: Page) =>
  227 |   page
  228 |     .locator('.sidenav__items a')
  229 |     .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  230 | 
  231 | /** Открывает панель разделов наведением на кнопку текущего раздела и показывает подразделы `section` */
  232 | export async function openSection(page: Page, section: string) {
  233 |   const nav = sideNav(page);
  234 |   // шапка клиентская: до гидрации наведение без обработчика, поэтому повтор. Мышь сперва уводим: после перехода
  235 |   // панель закрывается по смене адреса, а курсор, уже стоящий на кнопке, нового pointerenter не даёт
  236 |   await expect(async () => {
  237 |     await page.mouse.move(page.viewportSize()!.width - 1, page.viewportSize()!.height - 1);
  238 |     if ((await nav.locator('.sidenav__current').getAttribute('aria-expanded')) !== 'true')
  239 |       await nav.locator('.sidenav__current').click();
  240 |     await expect(nav.locator('.sidenav__panel')).toBeVisible({ timeout: 1_000 });
  241 |   }).toPass({ timeout: 15_000 });
  242 |   await nav.locator('.sidenav__section', { hasText: new RegExp(`^${section}$`) }).hover();
  243 |   return nav.locator('.sidenav__items > :not([hidden])');
  244 | }
  245 | 
  246 | /** Переход через панель: раздел → подраздел, как человек мышью */
  247 | export async function goViaMenu(page: Page, section: string, item: string) {
  248 |   const items = await openSection(page, section);
  249 |   if (await items.count()) await items.getByRole('link', { name: item, exact: true }).click();
  250 |   else
  251 |     await sideNav(page)
  252 |       .locator('.sidenav__section', { hasText: new RegExp(`^${section}$`) })
  253 |       .click();
  254 | }
  255 | 
```