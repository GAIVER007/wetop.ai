# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search-filter-recovery.spec.ts >> search/filter recovery 390 >> availability: calendar transfers its inclusive range and category
- Location: tests/ui/search-filter-recovery.spec.ts:67:5

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Поиск свободных номеров', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "К содержимому" [ref=e3] [cursor=pointer]:
      - /url: "#main-content"
    - banner [ref=e4]:
      - generic [ref=e5]:
        - button "Открыть меню" [ref=e6] [cursor=pointer]
        - link "WETOP, Главная" [ref=e8] [cursor=pointer]:
          - /url: /today
          - generic [ref=e9]: W
        - button "Найти гостя или бронь" [ref=e10] [cursor=pointer]:
          - generic [aria-hidden] [ref=e14]: Поиск
        - generic [ref=e15]:
          - button "Переключить тему" [ref=e16] [cursor=pointer]
          - button "Меню администратора" [ref=e20] [cursor=pointer]:
            - generic [ref=e21]: АД
    - main [ref=e23]:
      - generic [ref=e24]:
        - heading "Календарь" [level=1] [ref=e26]
        - navigation "Действия страницы" [ref=e27]:
          - link "Новая бронь" [ref=e28] [cursor=pointer]:
            - /url: /reservations/new
      - generic [ref=e30]:
        - group "Сегодня на объекте" [ref=e31]:
          - paragraph [ref=e32]:
            - text: Сегодня
            - generic [ref=e33]: 5 окт.
          - generic [ref=e34]:
            - generic [ref=e35]:
              - link "Заезды" [ref=e36] [cursor=pointer]:
                - /url: /reservations?date=2026-10-05
              - generic [ref=e37]: "3"
            - generic [ref=e38]:
              - link "Выезды" [ref=e39] [cursor=pointer]:
                - /url: /reservations?date=2026-10-05
              - generic [ref=e40]: "2"
            - generic [ref=e41]:
              - link "Проживания" [ref=e42] [cursor=pointer]:
                - /url: /reservations?date=2026-10-05
              - generic [ref=e43]: "3"
            - generic [ref=e44]:
              - link "Дни рождения" [ref=e45] [cursor=pointer]:
                - /url: /guests/birthdays
              - generic [ref=e46]: "0"
            - generic [ref=e47]:
              - link "Задачи" [ref=e48] [cursor=pointer]:
                - /url: /tasks
              - generic [ref=e49]: "0"
            - generic [ref=e50]:
              - generic [ref=e51]: Свободно
              - generic [ref=e52]: — из 88
            - generic [ref=e53]:
              - generic [ref=e54]: Занято
              - generic [ref=e55]: —
            - generic [ref=e56]:
              - generic [ref=e57]: Загрузка
              - generic [ref=e58]: —
        - generic [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e61]:
              - link "Предыдущий период" [ref=e62] [cursor=pointer]:
                - /url: /chessboard?from=2026-10-07&to=2026-10-09
              - generic "10–12 октября 2026 г." [ref=e65]: 10–12 окт.
              - link "Следующий период" [ref=e66] [cursor=pointer]:
                - /url: /chessboard?from=2026-10-13&to=2026-10-15
              - link "Сегодня" [ref=e69] [cursor=pointer]:
                - /url: /chessboard
            - group "Вид календаря" [ref=e70]:
              - link "7 дней" [ref=e71] [cursor=pointer]:
                - /url: /chessboard?from=2026-10-05&to=2026-10-11
              - link "14 дней" [ref=e72] [cursor=pointer]:
                - /url: /chessboard?from=2026-10-05&to=2026-10-18
              - link "30 дней" [ref=e73] [cursor=pointer]:
                - /url: /chessboard?from=2026-10-05&to=2026-11-03
          - generic [ref=e74]:
            - button "Даты" [ref=e76] [cursor=pointer]
            - group [ref=e79]:
              - generic "? Помощь" [ref=e80] [cursor=pointer]
      - generic [ref=e81]:
        - searchbox "Поиск в календаре" [ref=e83]
        - button "Фильтры 1" [ref=e84] [cursor=pointer]:
          - text: Фильтры
          - generic [ref=e86]: "1"
        - combobox "Вид строк календаря" [ref=e88]:
          - option "Компактный"
          - option "Обычный" [selected]
          - option "Подробный"
        - generic [ref=e89]:
          - group "Заданные условия" [ref=e90]:
            - 'button "Убрать условие: Мужской общий номер" [ref=e91] [cursor=pointer]':
              - generic [ref=e92]: Мужской общий номер
          - status [ref=e96]: Показано 36 из 88 мест
          - button "Сбросить" [ref=e97] [cursor=pointer]
      - region "Календарь по дням" [ref=e98]:
        - table [ref=e99]:
          - rowgroup [ref=e105]:
            - row [ref=e106]:
              - columnheader [ref=e107]:
                - text: Номера и койки
                - button "Свернуть категории" [ref=e109] [cursor=pointer]
              - columnheader "2026-10-10, сб" [ref=e110]:
                - generic [ref=e111]:
                  - generic [ref=e112]: "10"
                  - generic [ref=e113]: сб
              - columnheader "2026-10-11, вс" [ref=e114]:
                - generic [ref=e115]:
                  - generic [ref=e116]: "11"
                  - generic [ref=e117]: вс
              - columnheader "2026-10-12, пн" [ref=e118]:
                - generic [ref=e119]:
                  - generic [ref=e120]: "12"
                  - generic [ref=e121]: пн
          - rowgroup [ref=e122]:
            - row [ref=e123]:
              - cell [ref=e124]:
                - button "Мужской общий номер 36" [expanded] [ref=e125] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e126]: ⌄
                  - generic "Мужской общий номер" [ref=e127]
                  - generic [ref=e128]: "36"
              - cell "36" [ref=e129]
              - cell "36" [ref=e130]
              - cell "36" [ref=e131]
            - row [ref=e132]:
              - cell [ref=e133]:
                - link "M01" [ref=e134] [cursor=pointer]:
                  - /url: /units/M01
                - text: койка
                - 'button "Уборка ячейки M01: требует уборки" [ref=e140] [cursor=pointer]'
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e145]':
                - link [aria-hidden] [ref=e146] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M01
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e147]':
                - link [aria-hidden] [ref=e148] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M01
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e149]':
                - link [aria-hidden] [ref=e150] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M01
            - row [ref=e151]:
              - cell [ref=e152]:
                - link "M02" [ref=e153] [cursor=pointer]:
                  - /url: /units/M02
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e157]':
                - link [aria-hidden] [ref=e158] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M02
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e159]':
                - link [aria-hidden] [ref=e160] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M02
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e161]':
                - link [aria-hidden] [ref=e162] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M02
            - row [ref=e163]:
              - cell [ref=e164]:
                - link "M03" [ref=e165] [cursor=pointer]:
                  - /url: /units/M03
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e169]':
                - link [aria-hidden] [ref=e170] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M03
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e171]':
                - link [aria-hidden] [ref=e172] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M03
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e173]':
                - link [aria-hidden] [ref=e174] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M03
            - row [ref=e175]:
              - cell [ref=e176]:
                - link "M04" [ref=e177] [cursor=pointer]:
                  - /url: /units/M04
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e181]':
                - link [aria-hidden] [ref=e182] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M04
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e183]':
                - link [aria-hidden] [ref=e184] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M04
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e185]':
                - link [aria-hidden] [ref=e186] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M04
            - row [ref=e187]:
              - cell [ref=e188]:
                - link "M05" [ref=e189] [cursor=pointer]:
                  - /url: /units/M05
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e193]':
                - link [aria-hidden] [ref=e194] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M05
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e195]':
                - link [aria-hidden] [ref=e196] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M05
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e197]':
                - link [aria-hidden] [ref=e198] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M05
            - row [ref=e199]:
              - cell [ref=e200]:
                - link "M06" [ref=e201] [cursor=pointer]:
                  - /url: /units/M06
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e205]':
                - link [aria-hidden] [ref=e206] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M06
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e207]':
                - link [aria-hidden] [ref=e208] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M06
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e209]':
                - link [aria-hidden] [ref=e210] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M06
            - row [ref=e211]:
              - cell [ref=e212]:
                - link "M07" [ref=e213] [cursor=pointer]:
                  - /url: /units/M07
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e217]':
                - link [aria-hidden] [ref=e218] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M07
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e219]':
                - link [aria-hidden] [ref=e220] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M07
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e221]':
                - link [aria-hidden] [ref=e222] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M07
            - row [ref=e223]:
              - cell [ref=e224]:
                - link "M08" [ref=e225] [cursor=pointer]:
                  - /url: /units/M08
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e229]':
                - link [aria-hidden] [ref=e230] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M08
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e231]':
                - link [aria-hidden] [ref=e232] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M08
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e233]':
                - link [aria-hidden] [ref=e234] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M08
            - row [ref=e235]:
              - cell [ref=e236]:
                - link "M09" [ref=e237] [cursor=pointer]:
                  - /url: /units/M09
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e241]':
                - link [aria-hidden] [ref=e242] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M09
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e243]':
                - link [aria-hidden] [ref=e244] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M09
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e245]':
                - link [aria-hidden] [ref=e246] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M09
            - row [ref=e247]:
              - cell [ref=e248]:
                - link "M10" [ref=e249] [cursor=pointer]:
                  - /url: /units/M10
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e253]':
                - link [aria-hidden] [ref=e254] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M10
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e255]':
                - link [aria-hidden] [ref=e256] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M10
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e257]':
                - link [aria-hidden] [ref=e258] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M10
            - row [ref=e259]:
              - cell [ref=e260]:
                - link "M11" [ref=e261] [cursor=pointer]:
                  - /url: /units/M11
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e265]':
                - link [aria-hidden] [ref=e266] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M11
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e267]':
                - link [aria-hidden] [ref=e268] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M11
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e269]':
                - link [aria-hidden] [ref=e270] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M11
            - row [ref=e271]:
              - cell [ref=e272]:
                - link "M12" [ref=e273] [cursor=pointer]:
                  - /url: /units/M12
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e277]':
                - link [aria-hidden] [ref=e278] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M12
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e279]':
                - link [aria-hidden] [ref=e280] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M12
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e281]':
                - link [aria-hidden] [ref=e282] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M12
            - row [ref=e283]:
              - cell [ref=e284]:
                - link "M13" [ref=e285] [cursor=pointer]:
                  - /url: /units/M13
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e289]':
                - link [aria-hidden] [ref=e290] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M13
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e291]':
                - link [aria-hidden] [ref=e292] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M13
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e293]':
                - link [aria-hidden] [ref=e294] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M13
            - row [ref=e295]:
              - cell [ref=e296]:
                - link "M14" [ref=e297] [cursor=pointer]:
                  - /url: /units/M14
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e301]':
                - link [aria-hidden] [ref=e302] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M14
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e303]':
                - link [aria-hidden] [ref=e304] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M14
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e305]':
                - link [aria-hidden] [ref=e306] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M14
            - row [ref=e307]:
              - cell [ref=e308]:
                - link "M15" [ref=e309] [cursor=pointer]:
                  - /url: /units/M15
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e313]':
                - link [aria-hidden] [ref=e314] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M15
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e315]':
                - link [aria-hidden] [ref=e316] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M15
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e317]':
                - link [aria-hidden] [ref=e318] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M15
            - row [ref=e319]:
              - cell [ref=e320]:
                - link "M16" [ref=e321] [cursor=pointer]:
                  - /url: /units/M16
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e325]':
                - link [aria-hidden] [ref=e326] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M16
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e327]':
                - link [aria-hidden] [ref=e328] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M16
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e329]':
                - link [aria-hidden] [ref=e330] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M16
            - row [ref=e331]:
              - cell [ref=e332]:
                - link "M17" [ref=e333] [cursor=pointer]:
                  - /url: /units/M17
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e337]':
                - link [aria-hidden] [ref=e338] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M17
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e339]':
                - link [aria-hidden] [ref=e340] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M17
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e341]':
                - link [aria-hidden] [ref=e342] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M17
            - row [ref=e343]:
              - cell [ref=e344]:
                - link "M18" [ref=e345] [cursor=pointer]:
                  - /url: /units/M18
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e349]':
                - link [aria-hidden] [ref=e350] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M18
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e351]':
                - link [aria-hidden] [ref=e352] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M18
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e353]':
                - link [aria-hidden] [ref=e354] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M18
            - row [ref=e355]:
              - cell [ref=e356]:
                - link "M19" [ref=e357] [cursor=pointer]:
                  - /url: /units/M19
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e361]':
                - link [aria-hidden] [ref=e362] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M19
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e363]':
                - link [aria-hidden] [ref=e364] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M19
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e365]':
                - link [aria-hidden] [ref=e366] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M19
            - row [ref=e367]:
              - cell [ref=e368]:
                - link "M20" [ref=e369] [cursor=pointer]:
                  - /url: /units/M20
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e373]':
                - link [aria-hidden] [ref=e374] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M20
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e375]':
                - link [aria-hidden] [ref=e376] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M20
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e377]':
                - link [aria-hidden] [ref=e378] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M20
            - row [ref=e379]:
              - cell [ref=e380]:
                - link "M21" [ref=e381] [cursor=pointer]:
                  - /url: /units/M21
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e385]':
                - link [aria-hidden] [ref=e386] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M21
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e387]':
                - link [aria-hidden] [ref=e388] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M21
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e389]':
                - link [aria-hidden] [ref=e390] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M21
            - row [ref=e391]:
              - cell [ref=e392]:
                - link "M22" [ref=e393] [cursor=pointer]:
                  - /url: /units/M22
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e397]':
                - link [aria-hidden] [ref=e398] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M22
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e399]':
                - link [aria-hidden] [ref=e400] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M22
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e401]':
                - link [aria-hidden] [ref=e402] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M22
            - row [ref=e403]:
              - cell [ref=e404]:
                - link "M23" [ref=e405] [cursor=pointer]:
                  - /url: /units/M23
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e409]':
                - link [aria-hidden] [ref=e410] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M23
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e411]':
                - link [aria-hidden] [ref=e412] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M23
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e413]':
                - link [aria-hidden] [ref=e414] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M23
            - row [ref=e415]:
              - cell [ref=e416]:
                - link "M24" [ref=e417] [cursor=pointer]:
                  - /url: /units/M24
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e421]':
                - link [aria-hidden] [ref=e422] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M24
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e423]':
                - link [aria-hidden] [ref=e424] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M24
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e425]':
                - link [aria-hidden] [ref=e426] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M24
            - row [ref=e427]:
              - cell [ref=e428]:
                - link "M25" [ref=e429] [cursor=pointer]:
                  - /url: /units/M25
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e433]':
                - link [aria-hidden] [ref=e434] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M25
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e435]':
                - link [aria-hidden] [ref=e436] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M25
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e437]':
                - link [aria-hidden] [ref=e438] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M25
            - row [ref=e439]:
              - cell [ref=e440]:
                - link "M26" [ref=e441] [cursor=pointer]:
                  - /url: /units/M26
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e445]':
                - link [aria-hidden] [ref=e446] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M26
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e447]':
                - link [aria-hidden] [ref=e448] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M26
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e449]':
                - link [aria-hidden] [ref=e450] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M26
            - row [ref=e451]:
              - cell [ref=e452]:
                - link "M27" [ref=e453] [cursor=pointer]:
                  - /url: /units/M27
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e457]':
                - link [aria-hidden] [ref=e458] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M27
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e459]':
                - link [aria-hidden] [ref=e460] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M27
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e461]':
                - link [aria-hidden] [ref=e462] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M27
            - row [ref=e463]:
              - cell [ref=e464]:
                - link "M28" [ref=e465] [cursor=pointer]:
                  - /url: /units/M28
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e469]':
                - link [aria-hidden] [ref=e470] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M28
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e471]':
                - link [aria-hidden] [ref=e472] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M28
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e473]':
                - link [aria-hidden] [ref=e474] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M28
            - row [ref=e475]:
              - cell [ref=e476]:
                - link "M29" [ref=e477] [cursor=pointer]:
                  - /url: /units/M29
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e481]':
                - link [aria-hidden] [ref=e482] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M29
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e483]':
                - link [aria-hidden] [ref=e484] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M29
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e485]':
                - link [aria-hidden] [ref=e486] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M29
            - row [ref=e487]:
              - cell [ref=e488]:
                - link "M30" [ref=e489] [cursor=pointer]:
                  - /url: /units/M30
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e493]':
                - link [aria-hidden] [ref=e494] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M30
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e495]':
                - link [aria-hidden] [ref=e496] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M30
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e497]':
                - link [aria-hidden] [ref=e498] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M30
            - row [ref=e499]:
              - cell [ref=e500]:
                - link "M31" [ref=e501] [cursor=pointer]:
                  - /url: /units/M31
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e505]':
                - link [aria-hidden] [ref=e506] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M31
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e507]':
                - link [aria-hidden] [ref=e508] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M31
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e509]':
                - link [aria-hidden] [ref=e510] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M31
            - row [ref=e511]:
              - cell [ref=e512]:
                - link "M32" [ref=e513] [cursor=pointer]:
                  - /url: /units/M32
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e517]':
                - link [aria-hidden] [ref=e518] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M32
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e519]':
                - link [aria-hidden] [ref=e520] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M32
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e521]':
                - link [aria-hidden] [ref=e522] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M32
            - row [ref=e523]:
              - cell [ref=e524]:
                - link "M33" [ref=e525] [cursor=pointer]:
                  - /url: /units/M33
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e529]':
                - link [aria-hidden] [ref=e530] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M33
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e531]':
                - link [aria-hidden] [ref=e532] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M33
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e533]':
                - link [aria-hidden] [ref=e534] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M33
            - row [ref=e535]:
              - cell [ref=e536]:
                - link "M34" [ref=e537] [cursor=pointer]:
                  - /url: /units/M34
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e541]':
                - link [aria-hidden] [ref=e542] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M34
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e543]':
                - link [aria-hidden] [ref=e544] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M34
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e545]':
                - link [aria-hidden] [ref=e546] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M34
            - row [ref=e547]:
              - cell [ref=e548]:
                - link "M35" [ref=e549] [cursor=pointer]:
                  - /url: /units/M35
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e553]':
                - link [aria-hidden] [ref=e554] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M35
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e555]':
                - link [aria-hidden] [ref=e556] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M35
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e557]':
                - link [aria-hidden] [ref=e558] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M35
            - row [ref=e559]:
              - cell [ref=e560]:
                - link "M36" [ref=e561] [cursor=pointer]:
                  - /url: /units/M36
                - text: койка
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e565]':
                - link [aria-hidden] [ref=e566] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-10&departure=2026-10-11&unit=M36
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e567]':
                - link [aria-hidden] [ref=e568] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-11&departure=2026-10-12&unit=M36
              - 'cell "Свободно — щелчок: новая бронь или блокировка; протяните по датам, чтобы выбрать период" [ref=e569]':
                - link [aria-hidden] [ref=e570] [cursor=pointer]:
                  - /url: /reservations/new?arrival=2026-10-12&departure=2026-10-13&unit=M36
      - group [ref=e572]:
        - generic "Обозначения" [ref=e573] [cursor=pointer]
    - navigation "Основная навигация" [ref=e574]:
      - link "Главная" [ref=e575] [cursor=pointer]:
        - /url: /today
      - link "Календарь" [ref=e582] [cursor=pointer]:
        - /url: /chessboard
      - link "Брони" [ref=e586] [cursor=pointer]:
        - /url: /reservations
      - link "Гости" [ref=e591] [cursor=pointer]:
        - /url: /guests
      - button "Ещё разделы" [ref=e598] [cursor=pointer]:
        - generic [ref=e603]: Ещё
  - alert [ref=e604]
```

# Test source

```ts
  1   | import { FIXTURE_API, expect, test, settleStreaming } from './fixtures';
  2   | 
  3   | // Synthetic loopback API. UI state evidence, not production or database evidence.
  4   | const arrival = '2026-10-10';
  5   | const departure = '2026-10-12';
  6   | const search = `/rooms/availability?arrival=${arrival}&departure=${departure}&guests=2`;
  7   | 
  8   | test.beforeEach(async ({ request }) => {
  9   |   await request.post(`${FIXTURE_API}/__test/reset`);
  10  | });
  11  | 
  12  | for (const width of [1440, 390]) {
  13  |   test.describe(`search/filter recovery ${width}`, () => {
  14  |     test.beforeEach(async ({ page }) => {
  15  |       await page.setViewportSize({ width, height: 844 });
  16  |     });
  17  | 
  18  |     for (const preset of ['Завтра', 'Выходные']) {
  19  |       test(`availability: ${preset} updates edited fields and repeated search`, async ({
  20  |         page,
  21  |       }) => {
  22  |         await page.goto(search);
  23  |         await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
  24  |         await page.getByLabel('Выезд', { exact: true }).fill('2026-10-15');
  25  |         const link = page.getByRole('link', { name: preset, exact: true });
  26  |         const target = new URL((await link.getAttribute('href'))!, page.url());
  27  |         await link.click();
  28  |         await expect(page).toHaveURL(target.href);
  29  |         await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue(
  30  |           target.searchParams.get('arrival')!,
  31  |         );
  32  |         await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue(
  33  |           target.searchParams.get('departure')!,
  34  |         );
  35  |         await page.getByRole('button', { name: 'Найти', exact: true }).click();
  36  |         await expect(page).toHaveURL(target.href);
  37  |       });
  38  |     }
  39  | 
  40  |     test('availability: manual input is a draft until Find; category survives reload and history', async ({
  41  |       page,
  42  |     }) => {
  43  |       await page.goto(`${search}&category=MALE`);
  44  |       const category = page.getByRole('combobox', { name: 'Категория', exact: true });
  45  |       await expect(category).toHaveValue('MALE');
  46  |       await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
  47  |       await page.getByLabel('Выезд', { exact: true }).fill('2026-10-16');
  48  |       await page.getByLabel('Гостей', { exact: true }).fill('3');
  49  |       await expect(page).toHaveURL(
  50  |         new RegExp(`arrival=${arrival}&departure=${departure}&guests=2&category=MALE`),
  51  |       );
  52  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
  53  |       await expect(page.locator('.fund-counts')).toContainText('2 ночи');
  54  |       await page.getByRole('button', { name: 'Найти', exact: true }).click();
  55  |       await expect(page).toHaveURL(/arrival=2026-10-13&departure=2026-10-16&guests=3/);
  56  |       expect(new URL(page.url()).searchParams.get('category')).toBe('MALE');
  57  |       await page.reload();
  58  |       await expect(category).toHaveValue('MALE');
  59  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
  60  |       await page.goBack();
  61  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue(arrival);
  62  |       await page.goForward();
  63  |       await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-16');
  64  |       await expect(category).toHaveValue('MALE');
  65  |     });
  66  | 
  67  |     test('availability: calendar transfers its inclusive range and category', async ({ page }) => {
  68  |       await page.goto('/chessboard?from=2026-10-10&to=2026-10-12&category=MALE');
> 69  |       await page.getByRole('link', { name: 'Поиск свободных номеров', exact: true }).click();
      |                                                                                      ^ Error: locator.click: Test timeout of 45000ms exceeded.
  70  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-10');
  71  |       await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-13');
  72  |       await expect(page.getByRole('combobox', { name: 'Категория', exact: true })).toHaveValue(
  73  |         'MALE',
  74  |       );
  75  |     });
  76  | 
  77  |     test('finance: empty refunds keep method and resetting it preserves other filters', async ({
  78  |       page,
  79  |     }) => {
  80  |       const url =
  81  |         '/finance?from=2026-10-05&to=2026-10-05&op=refund&method=CASH&src=cash#operations';
  82  |       await page.goto(url);
  83  |       await expect(page.getByTestId('ops-empty')).toBeVisible();
  84  |       const method = page.getByRole('combobox', { name: 'Способ оплаты', exact: true });
  85  |       await expect(method).toBeVisible();
  86  |       await expect(method).toHaveValue('CASH');
  87  |       await page.reload();
  88  |       await expect(method).toHaveValue('CASH');
  89  |       await method.selectOption('');
  90  |       await page.getByRole('button', { name: 'Показать', exact: true }).click();
  91  |       const q = new URL(page.url()).searchParams;
  92  |       expect(q.get('method')).toBe('');
  93  |       expect(q.get('op')).toBe('refund');
  94  |       expect(q.get('src')).toBe('cash');
  95  |       expect(q.get('from')).toBe('2026-10-05');
  96  |       expect(q.get('to')).toBe('2026-10-05');
  97  |       await page.goBack();
  98  |       await expect(method).toHaveValue('CASH');
  99  |       await page.goForward();
  100 |       await expect(method).toHaveValue('');
  101 |     });
  102 | 
  103 |     test('rates: empty row is rejected, zero nights and false restrictions remain changes', async ({
  104 |       page,
  105 |     }) => {
  106 |       await page.goto('/rates?month=2026-10');
  107 |       await page.getByTestId('rates-edit-open').click();
  108 |       const editor = page.getByTestId('bulk-editor');
  109 |       const add = editor.getByRole('button', { name: '+ Добавить в список', exact: true });
  110 |       await add.click();
  111 |       await expect(editor.getByRole('alert')).toContainText('Укажите хотя бы одно изменение');
  112 |       await expect(editor.getByTestId('pending-changes')).toHaveCount(0);
  113 |       await expect(editor.getByTestId('apply-changes')).toBeDisabled();
  114 |       await editor.getByLabel('Мин. ночей', { exact: true }).fill('0');
  115 |       await add.click();
  116 |       await expect(editor.getByTestId('pending-changes')).toContainText('мин. ночей 0');
  117 |       await editor.getByLabel('Стоп-продажа', { exact: true }).selectOption('false');
  118 |       await add.click();
  119 |       await expect(editor.getByTestId('pending-changes')).toContainText('стоп-продажа нет');
  120 |       await expect(editor.getByTestId('apply-changes')).toHaveText('Сохранить 2 изменения');
  121 |     });
  122 | 
  123 |     test('print: KZ and RU survive form changes, reload and history', async ({ page }) => {
  124 |       await page.goto('/reports/print?form=day&date=2026-10-05');
  125 |       await page.getByRole('link', { name: 'KZ', exact: true }).click();
  126 |       await settleStreaming(page);
  127 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
  128 |       await page.getByRole('link', { name: 'Список проживающих', exact: true }).click();
  129 |       await settleStreaming(page);
  130 |       expect(new URL(page.url()).searchParams.get('lang')).toBe('kz');
  131 |       expect(new URL(page.url()).searchParams.get('date')).toBe('2026-10-05');
  132 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText(
  133 |         'Тұрып жатқан қонақтар тізімі',
  134 |       );
  135 |       await page.reload();
  136 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText(
  137 |         'Тұрып жатқан қонақтар тізімі',
  138 |       );
  139 |       await page.goBack();
  140 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
  141 |       await page.goForward();
  142 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText(
  143 |         'Тұрып жатқан қонақтар тізімі',
  144 |       );
  145 |       await page.getByRole('link', { name: 'Сводка дня', exact: true }).click();
  146 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
  147 |       await page.getByRole('link', { name: 'RU', exact: true }).click();
  148 |       await page.getByRole('link', { name: 'Список проживающих', exact: true }).click();
  149 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Список проживающих');
  150 |       expect(new URL(page.url()).searchParams.get('lang')).toBe('ru');
  151 |       await page.reload();
  152 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Список проживающих');
  153 |     });
  154 |   });
  155 | }
  156 | 
```