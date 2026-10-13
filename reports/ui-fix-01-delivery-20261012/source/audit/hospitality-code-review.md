# Полный статический READ-ONLY аудит гостиничного интерфейса WETOP

Дата аудита: 11.10.2026  
Версия: заданная для аудита замороженная версия `0e2d69e1739678852d7745d2ca9f4e74ec595b0f`  
Рабочее дерево: `/Users/vyacheslav/Desktop/Проекты/WETOP/.claude/worktrees/sidebar-nav`  
Область: `finance`, гостиничная касса, `chessboard`, `guests`, `reservations`, `units`, `inventory`, `rooms`, `rates`, `bar`, `reports`, `hotel-settings`, `channels`, `management/analytics`.

## 1. Метод и ограничения

Аудит выполнен только статическим чтением исходного кода. Изучены `page.tsx`, интерактивные компоненты, server actions, API-клиенты, серверные контроллеры и существующие тесты в той мере, в которой это требовалось для проверки реального контракта.

По условиям разделения работы, заданным лидером аудита:

- git-команды не выполнялись, поэтому SHA не перепроверялся локальной git-командой;
- тесты, typecheck, lint и LSP-диагностика не запускались;
- серверы, база данных и браузер не запускались;
- `.env`, credentials и содержимое секретов не читались;
- production, внешние API и реальные операции не вызывались;
- код приложения не изменялся.

Статусы в отчёте:

- **confirmed**: дефект или расхождение доказуемы из статического пути UI, server action и API-контракта;
- **hypothesis**: риск виден по коду, но для окончательного вывода нужен runtime или браузер;
- отсутствие данных само по себе не считается дефектом;
- этот документ не является runtime, CI, deployment или production proof.

Порядок проверки: сначала покрытие заявленной области и соответствие контракту, затем права, read-only режим, ошибки, внешние операции, целостность составных действий, заглушки и тестовые пробелы.

## 2. Итог

Изучен **41 маршрутизируемый `page.tsx` entrypoint**. Catch-all страницы дополнительно раскрыты по секциям, поэтому проверено не менее **54 route/view сценариев**. Также изучены связанные интерактивные компоненты, server actions и API-границы.

Подтверждено 7 проблем:

| Severity | Количество | Смысл |
|---|---:|---|
| P0 | 0 | Не найдено подтверждённой критической утечки, необратимой потери данных или полного обхода авторизации |
| P1 | 2 | Риск дублирования или частичной и противоречивой записи |
| P2 | 4 | Функциональный дефект или неверная доступность действия без подтверждённого обхода серверной авторизации |
| P3 | 1 | Ограниченный capability gap и недостаточное раскрытие статуса функции |

Главные дефекты:

1. Ошибка поиска гостя маскируется под результат «ничего не найдено». После этого форма создаёт нового гостя, что позволяет получить дубликат при временной ошибке API.
2. Составные Bar-операции выполняются несколькими независимыми запросами. Ошибка позднего шага оставляет уже записанные товары, цены или часть массового архива, хотя интерфейс сообщает общий отказ.
3. Read-only режим скрывает только часть гостиничных мутаций. На шахматке, прямых страницах бронирования, в фонде, Bar и части Channels остаются активные кнопки и жесты записи. Это подтверждённый UI mismatch, обход серверных write guards не найден.

Вердикт статического code review: **REQUEST CHANGES**. P1 H-02 и H-03 блокируют одобрение.

## 3. Реестр всех изученных страниц и действий

В таблице одна строка соответствует одному маршрутизируемому `page.tsx`. Catch-all секции перечислены внутри строки. Файл `apps/web/src/app/management/analytics/hospitality-page.tsx` также изучен как общий компонент аналитики, но не считается отдельным маршрутом.

| № | Маршрут или слот | Реализация | Действия и реальный контракт | Права, зависимости и статический вывод |
|---:|---|---|---|---|
| 1 | `/finance` | `apps/web/src/app/finance/page.tsx` | Период, сводка, долги, услуги, операции кассы, приход, расход, перевод, сверка, отмена через возврат, категории, CSV | Гостиничная касса находится здесь. Мутации в основном учитывают права и read-only. Переключение категории теряет ошибку, см. H-05 |
| 2 | `/cashbox` | `apps/web/src/app/cashbox/page.tsx:11-35` | Загружает `restaurantShell()` и `restaurantApi.cash()`, затем рендерит ресторанный `CashBoard` на самом маршруте `/cashbox` | Запись разрешена как `shell.canDesk && !shell.readOnly`, возвраты как `shell.canRefunds && !shell.readOnly`; ошибка загрузки выводится через `LoadError`. Это ресторанная касса, а гостиничная касса находится в `/finance` |
| 3 | `/chessboard` | `apps/web/src/app/chessboard/page.tsx` | Диапазон, фильтры, новая бронь, свободная ячейка, открытие проживания, drag and drop, resize, действия проживания, уборка, неназначенные брони | Чтение и запись идут через desk API. Read-only применён не ко всем мутациям, см. H-01 |
| 4 | `/guests` | `apps/web/src/app/guests/page.tsx` | Поиск, фильтры, карточка гостя, переход в бронь, создание брони | Доступ через гостиничный vertical guard и desk. Кнопка новой брони учитывает read-only |
| 5 | `/guests/[id]` | `apps/web/src/app/guests/[id]/page.tsx` | Профиль, контакты, документы, история проживаний, редактирование и переход к брони | API повторно проверяет область гостя. Отсутствие истории корректно представлено пустым состоянием |
| 6 | `/guests/birthdays` | `apps/web/src/app/guests/birthdays/page.tsx` | Период дней рождений, список и переход к гостю | Чтение, отсутствие результатов не считается ошибкой |
| 7 | `/reservations` | `apps/web/src/app/reservations/page.tsx` | Фильтры, поиск, экспорт CSV, открытие карточки или drawer, новая бронь | Страница списка учитывает read-only для создания. Ошибки поиска существующего гостя в форме новой брони маскируются, см. H-02 |
| 8 | `/reservations/new` | `apps/web/src/app/reservations/new/page.tsx` | Создание брони, поиск или создание гостя, даты, категория, номер, тариф, цена, заметки | Прямой маршрут не получает read-only и не проверяет Hospitality vertical, см. H-01 и H-06 |
| 9 | `/reservations/[number]` | `apps/web/src/app/reservations/[number]/page.tsx` | Карточка, статусы, данные гостя, размещение, финансы, запросы оплаты, печать и журнал | Прямой маршрут показывает действия записи в read-only; vertical guard отсутствует, см. H-01 и H-06 |
| 10 | `/reservations/[number]/print` | `apps/web/src/app/reservations/[number]/print/page.tsx` | Печатная карточка брони и проживания | Данные документа маскируются. Hospitality vertical guard отсутствует, см. H-06 |
| 11 | `/reservations/[number]/print/contract` | `apps/web/src/app/reservations/[number]/print/contract/page.tsx` | Печать черновика договора | Внутри документа черновой статус раскрыт явно, но исходная ссылка не сообщает его до открытия, см. H-07 |
| 12 | `/reservations/[number]/print/invoice` | `apps/web/src/app/reservations/[number]/print/invoice/page.tsx` | Печать черновика счёта | Внутри документа черновой статус раскрыт явно, но исходная ссылка не сообщает его до открытия, см. H-07 |
| 13 | `@drawer/(.)reservations/new` | `apps/web/src/app/@drawer/(.)reservations/new/page.tsx` | Перехваченная форма новой брони в drawer | Делегирует канонической странице, поэтому наследует H-01, H-02 и H-06 |
| 14 | `@drawer/(.)reservations/[number]` | `apps/web/src/app/@drawer/(.)reservations/[number]/page.tsx` | Перехваченная карточка брони в drawer | Делегирует канонической карточке и наследует H-01 и H-06 |
| 15 | `/units/[code]` | `apps/web/src/app/units/[code]/page.tsx` | Факты номера, текущие и будущие проживания, уборка, блокировка и разблокировка | Прямой маршрут не получает read-only и не проверяет Hospitality vertical, см. H-01 и H-06 |
| 16 | `/inventory` | `apps/web/src/app/inventory/page.tsx` | Фильтры фонда, карточки номеров, массовая уборка, переименование, добавление, категории, редактирование фонда | Hospitality guard есть, но read-only не передаётся в каталог и редакторы, см. H-01 |
| 17 | `/inventory` drawer номера | `apps/web/src/app/inventory/@drawer/(..)units/[code]/page.tsx` | Карточка конкретного номера в параллельном drawer | Использует ту же страницу номера и наследует H-01 и H-06 |
| 18 | `/inventory` пустой drawer | `apps/web/src/app/inventory/@drawer/page.tsx` | Пустой слот параллельного маршрута | Служебная страница без пользовательских действий |
| 19 | `/rooms`, `/rooms/categories`, `/rooms/availability` | `apps/web/src/app/rooms/[[...section]]/page.tsx` | Корень перенаправляет в `/inventory`; категории создаются, редактируются и архивируются; availability показывает поиск доступности | Разделение фонда и доступности намеренное. Пустой результат availability не является ошибкой |
| 20 | `/rates/*` | `apps/web/src/app/rates/[[...rest]]/page.tsx` | Перенаправление в `/rooms/categories` | Это compatibility redirect, отдельного редактора тарифов на этом маршруте нет. Само перенаправление не считается сломанной кнопкой |
| 21 | `/bar` | `apps/web/src/app/bar/page.tsx` | Остатки, быстрая продажа, продажа в фолио, добавление, редактирование, списание и архив товара | UI не учитывает read-only и показывает STAFF действия, для которых API требует `settings`, см. H-01 и H-04 |
| 22 | `/bar/operations` | `apps/web/src/app/bar/operations/page.tsx` | Списание, инвентаризация, обратная операция продажи | Внутренние складские операции. Составные и массовые записи требуют явной атомарности, см. H-03 |
| 23 | `/bar/products` | `apps/web/src/app/bar/products/page.tsx` | Создать, изменить, архивировать или вернуть товар, задать цену | API каталога требует `settings`, UI не скрывает действия от STAFF/read-only, см. H-01 и H-04 |
| 24 | `/bar/receipts` | `apps/web/src/app/bar/receipts/page.tsx` | Список поступлений, открыть, провести, оплатить, создать новое | Операции проведения требуют desk. Read-only UI не ограничен, см. H-01 |
| 25 | `/bar/receipts/new` | `apps/web/src/app/bar/receipts/new/page.tsx` | Ручное поступление, новый товар в строке, загрузка фото для OCR, сохранение | OCR зависит от отдельного bot-сервиса, но ручной ввод остаётся. Создание нового товара перед поступлением неатомарно, см. H-03 |
| 26 | `/bar/suppliers` | `apps/web/src/app/bar/suppliers/page.tsx` | Создать поставщика, изменить активность | API требует `settings`, UI не скрывает действие от STAFF/read-only, см. H-01 и H-04 |
| 27 | `/reports` | `apps/web/src/app/reports/page.tsx` | Хаб ссылок на гостиничные отчёты | Чтение с правом `reports`; отсутствие данных не ошибка |
| 28 | `/reports/overview` | `apps/web/src/app/reports/overview/page.tsx` | Сводка выбранного периода | Read-only аналитический экран |
| 29 | `/reports/finance` | `apps/web/src/app/reports/finance/page.tsx` | Финансовый отчёт и период | Денежные значения форматируются из minor units; мутаций нет |
| 30 | `/reports/form-910` | `apps/web/src/app/reports/form-910/page.tsx` | Формирование отчётного представления формы 910 | Статическое чтение не подтверждает юридическую или production-готовность результата |
| 31 | `/reports/occupancy` | `apps/web/src/app/reports/occupancy/page.tsx` | Загрузка и показ загрузки по периоду | Read-only аналитика, пустой период обработан как отсутствие результата |
| 32 | `/reports/print` | `apps/web/src/app/reports/print/page.tsx` | Печать дневного отчёта или списка проживающих | Локальная печатная операция, не внешний production-вызов |
| 33 | `/reports/units` | `apps/web/src/app/reports/units/page.tsx` | Аналитика по номерам | Read-only, делегирует общим гостиничным метрикам |
| 34 | `/hotel-settings`, `/hotel-settings/stay`, `/services`, `/sales`, `/documents` | `apps/web/src/app/hotel-settings/[[...section]]/page.tsx` | Основные данные, проживание, услуги, продажи, документы; CRUD и media там, где форма это разрешает | Редактирование учитывает права и read-only. Sales и Documents явно показывают текущую готовность и заглушки, скрытых рабочих операций не найдено |
| 35 | `/channels`, `/channels/list`, `/connections`, `/mapping`, `/sync`, `/events` | `apps/web/src/app/channels/[[...section]]/page.tsx` | Сводка, список каналов, переход в Channex setup, mapping, очередь синхронизации, flush, pull, события | List корректно вычисляет `canManage`, но exchange actions и retry не учитывают read-only, см. H-01 |
| 36 | `/channels/events/[revisionId]` | `apps/web/src/app/channels/events/[revisionId]/page.tsx` | Детали ревизии, факты, ошибки и повтор обработки | Retry виден при failed-событии без read-only gate, см. H-01. Выводимые facts проходят серверную фильтрацию PII |
| 37 | `/management`, `/management/statistics`, `/management/dashboard` | `apps/web/src/app/management/[[...section]]/page.tsx` | Compatibility redirects в `/management/analytics` | Намеренное объединение аналитики, отдельных кнопок нет |
| 38 | `/management/analytics` | `apps/web/src/app/management/analytics/page.tsx` | Период, гостиничные KPI, загрузка, выручка, каналы и номера | Read-only аналитика с правом `reports` |
| 39 | `/management/analytics/channels` | `apps/web/src/app/management/analytics/channels/page.tsx` | Срез каналов, параметры, CSV | Экспорт локальный, внешней отправки нет |
| 40 | `/management/analytics/occupancy` | `apps/web/src/app/management/analytics/occupancy/page.tsx` | Детальная загрузка | Read-only, общий гостиничный загрузчик |
| 41 | `/management/analytics/units` | `apps/web/src/app/management/analytics/units/page.tsx` | Метрики по номерам | Read-only, общий гостиничный загрузчик |

## 4. Матрица прав, API и внешних операций

| Контур | Основные операции | Серверная граница | Статический вывод |
|---|---|---|---|
| Finance и гостиничная касса | Dashboard, счета кассы, категории, операции, переводы, сверка, возвраты | Права `finance` или соответствующая серверная проверка записи, org/property scope | Основная граница выглядит последовательной. H-05 находится в UI/server action обработке ошибки, а не в отсутствии API-проверки |
| Chessboard, reservations, guests | Брони, проживания, назначения номера, блоки, уборка, статусы, платежные запросы, гости | Desk access, scope текущей организации и объекта, capability/vertical проверки на API | Сервер ожидается как последняя граница. UI read-only не закрывает все пути, см. H-01 |
| Inventory, units, rooms | Номера, категории, состояние уборки, блокировки, availability | Property/desk access и scope объекта | Для списка фонда vertical guard есть. Прямой unit route и его drawer не наследуют этот guard, см. H-06 |
| Bar | Каталог, цены, поставщики, остатки, продажи, поступления, инвентаризация | Каталог и поставщики требуют `settings`; поступления и операции используют desk; property ownership проверяется API | UI не отражает разницу прав, см. H-04. Несколько составных действий не имеют общего транзакционного API, см. H-03 |
| Reports и analytics | Только чтение и CSV/print | Право `reports`, org/property scope | Подтверждённых мутаций или обхода scope не найдено |
| Hotel settings | Основное, проживание, услуги, продажи, документы | Право `settings`, write guard | Read-only и право редактирования учитываются последовательно |
| Channels | Channex setup, mapping, pull, flush, register/test, retry событий | `@Access('channels')`, org/property scope, серверные credentials | Это внешний контур. Кнопки части операций не получают read-only, см. H-01. Runtime внешнего обмена не проверялся |

Внешние и опциональные зависимости:

- Channels вызывает операции обмена с Channex. Кнопки `flush` и `pull` находятся в `apps/web/src/app/channels/buttons.tsx:44-65`; серверные endpoints защищены `@Access('channels')` в `apps/api/src/channels/channels.controller.ts:50-56`, `:72-91`, `:156-173`, `:258-261`, `:284-287`. Никакие внешние запросы в аудите не выполнялись.
- OCR поступления Bar принимает JPG, PNG или WebP в `apps/web/src/app/bar/new-receipt.tsx:125-139`, валидирует и отправляет изображение через `apps/web/src/app/bar/actions.ts:34-50`. Bot-сервис опционален, сервер возвращает явную недоступность в `apps/api/src/bar/bar-scan.service.ts:75-83`. Ручной ввод остаётся доступен, поэтому это документированная зависимость, а не подтверждённо сломанная кнопка.
- В проверенной области не найдено клиентского доступа к содержимому API-ключа. Ссылки на server-side environment variables не раскрывают значение. `.env` и credentials не читались.
- В проверенной области не выполнялись eQonaq, fiscal receipts, OTA production ARI или изменения архивного production-источника.

## 5. Подтверждённые проблемы

### H-01 [P2] Read-only режим не закрывает все гостиничные мутации

Статус: **confirmed, UI/API interaction mismatch**.

Подтверждён только UI mismatch: интерфейс read-only организации продолжает показывать и активировать действия записи. Серверные write guards присутствуют, успешная неразрешённая запись или обход авторизации не подтверждены. Поэтому пункт имеет P2, как аналогичные расхождения доступности действий в других областях.

Доказательство по шахматке:

- страница получает shell и `readOnly`, но кнопка «Новая бронь» рендерится без условия: `apps/web/src/app/chessboard/page.tsx:94-100`, `:320-327`;
- `readOnly` передаётся только в `UnassignedStays` и `ChessboardGrid`: `apps/web/src/app/chessboard/page.tsx:360-370`;
- внутри grid этот флаг скрывает часть preview/free-cell действий, но не отключает row drop, housekeeping и occupied-cell интерактивность: `apps/web/src/app/chessboard/board-grid.tsx:1204-1276`, `:1290-1329`;
- карточка проживания остаётся draggable и получает меню/resize по статусу проживания, без read-only условия: `apps/web/src/app/chessboard/board-grid.tsx:1432-1444`, `:1493-1524`, `:1628-1669`;
- housekeeping и resize вызывают мутации без собственного read-only gate: `apps/web/src/app/chessboard/housekeeping-menu.tsx:36-75`, `apps/web/src/app/chessboard/stay-resize.tsx:19-150`;
- положительный контраст: меню свободной ячейки корректно скрывает создание брони и блока при read-only: `apps/web/src/app/chessboard/free-menu.tsx:195-205`.

Доказательство по прямым страницам брони:

- `/reservations/new` не получает shell/read-only и всегда показывает форму: `apps/web/src/app/reservations/new/page.tsx:24-104`;
- submit новой брони не имеет read-only условия: `apps/web/src/app/reservations/new/form.tsx:473-487`;
- карточка брони получает shell для доступа к журналу, но не использует read-only для финансов и действий: `apps/web/src/app/reservations/[number]/page.tsx:30-75`, `:354-369`, `:412-465`;
- список бронирований, напротив, корректно скрывает создание: `apps/web/src/app/reservations/page.tsx:162-179`.

Доказательство по фонду, Bar и Channels:

- `/inventory` всегда показывает AddMenu и редакторы: `apps/web/src/app/inventory/page.tsx:16-74`;
- массовая уборка, переименование и bulk actions доступны в `apps/web/src/app/inventory/inventory-catalog.tsx:237-249`, `:564-617`;
- CRUD категорий доступен в `apps/web/src/app/inventory/category-catalog.tsx:63-135`;
- редактор фонда всегда показывает действие сохранения: `apps/web/src/app/inventory/fund-editor.tsx:491-523`;
- `/units/[code]` всегда рендерит `UnitActions`: `apps/web/src/app/units/[code]/page.tsx:17-44`;
- Bar dashboard, товары, поступления и поставщики не получают shell/read-only: `apps/web/src/app/bar/page.tsx:126-136`, `apps/web/src/app/bar/products/page.tsx:27-68`, `apps/web/src/app/bar/receipts/page.tsx:21-42`, `apps/web/src/app/bar/suppliers/page.tsx:35-65`;
- Channels list корректно вычисляет `canManage` из owner и `!readOnly`: `apps/web/src/app/channels/channel-list.tsx:21-39`;
- при этом exchange buttons рендерятся на общей странице без read-only gate: `apps/web/src/app/channels/[[...section]]/page.tsx:393`, `:845`, а `flush` и `pull` вызывают server actions в `apps/web/src/app/channels/buttons.tsx:44-65`;
- retry failed-события доступен в таблице и detail: `apps/web/src/app/channels/events-table.tsx:154`, `apps/web/src/app/channels/events/[revisionId]/page.tsx:139-144`.

Условие воспроизведения: организация находится в read-only состоянии, пользователь открывает перечисленные маршруты напрямую или через доступную навигацию.

Влияние:

- пользователь видит обещание доступной операции, вводит данные или выполняет drag/resize, но получает поздний серверный отказ;
- шахматка и карточка брони создают особенно широкий набор ложных affordance в основном операционном сценарии;
- внешние Channels операции выглядят доступными, хотя организация не должна писать;
- серверный guard защищает данные, но не исправляет UI-контракт и поздний отказ после действий пользователя.

Исправление: вычислять единый `canMutate = permission && !readOnly` на серверной странице и передавать его во все компоненты записи. Для прямых страниц брони и номера использовать тот же shell, что у списка. На шахматке отключить drag, drop, resize, housekeeping, stay menu и header create. В Channels отдельно закрыть pull, flush и retry. Добавить UI-проверки для каждого класса мутации, а не только баннера и свободной ячейки.

### H-02 [P1] Ошибка поиска гостя маскируется под отсутствие совпадений и позволяет создать дубликат

Статус: **confirmed, root-cause masking and data integrity**.

Доказательство:

- server action ловит любую ошибку directory API и возвращает пустой массив: `apps/web/src/app/reservations/actions.ts:142-160`;
- форма хранит только массив совпадений и не имеет отдельного состояния ошибки поиска: `apps/web/src/app/reservations/new/form.tsx:576-596`;
- при пустом массиве пользователь не видит ни совпадения, ни ошибку, а текст формы разрешает создать нового гостя: `apps/web/src/app/reservations/new/form.tsx:596-616`;
- если `guestId` не выбран, создание брони отправляет данные нового гостя: `apps/web/src/app/reservations/actions.ts:110-121`;
- существующий unit test прямо закрепляет маскировку: после ответа API 500 ожидается `[]`: `apps/web/src/app/reservations/actions.test.ts:131-138`.

Условие воспроизведения: в базе уже есть гость с введённым телефоном, но `GET` directory временно отвечает 500 или сеть прерывается. Пользователь вводит полный телефон и отправляет форму без выбранного `guestId`.

Влияние: может появиться дубликат гостя, а история проживаний, контакты и финансовый контекст разделятся между двумя карточками. Повторная попытка не объясняет причину и увеличивает вероятность дубля.

Исправление: вернуть из action типизированный результат вроде `{ matches, error }`. Отличать реальный нулевой результат от ошибки транспорта/API. При ошибке показывать видимое сообщение и блокировать неявное создание дубликата до повторного поиска либо требовать явного подтверждения «создать несмотря на ошибку». Тест на API 500 должен ожидать ошибку, а не пустой успешный результат.

### H-03 [P1] Составные Bar-операции неатомарны и оставляют частичные записи

Статус: **confirmed, data integrity**.

Доказательство:

- при создании поступления action сначала создаёт все новые товары отдельными запросами, затем создаёт receipt: `apps/web/src/app/bar/actions.ts:54-86`;
- если receipt-запрос завершится ошибкой после успешного `createProduct`, новые товары уже останутся в каталоге;
- редактирование товара сначала меняет карточку, затем отдельным запросом цену: `apps/web/src/app/bar/actions.ts:184-200`. Ошибка цены оставляет изменённые метаданные при общем сообщении «не удалось сохранить»;
- массовый архив выполняется последовательным циклом запросов: `apps/web/src/app/bar/actions.ts:203-212`. Ошибка на втором или последующем товаре оставляет уже обработанную часть набора;
- endpoints имеют разные права: каталог требует `settings`, receipt использует desk, что подтверждает карта доступа `apps/api/src/auth/route-access.test.ts:75-84`, `:96-100`.

Условия воспроизведения:

1. В новом поступлении добавить новый товар. `createProduct` проходит, а `createReceipt` или последующее проведение отклоняется.
2. Изменить название и цену. Обновление товара проходит, запрос цены отвечает 409 или 500.
3. Массово архивировать несколько позиций. Один из поздних запросов отклоняется.

Влияние:

- каталог получает сиротские или неожиданные товары;
- карточка и цена расходятся с намерением пользователя;
- массовая операция сообщает общий отказ, хотя часть записей уже изменена;
- повтор может создать дубликаты или ещё сильнее изменить набор.

Исправление: перенести каждый составной use case в один API endpoint и одну DB transaction. Для bulk archive либо обеспечить атомарность, либо вернуть явный результат по каждой позиции и показать частичное завершение. Добавить failure-injection тесты на отказ после первого успешно записанного шага.

### H-04 [P2] Bar показывает STAFF действия каталога, которые API разрешает только `settings`

Статус: **confirmed, UI/API permission mismatch**.

Доказательство:

- навигация Bar доступна по праву `reports`: `apps/web/src/lib/navigation.ts:253-257`;
- роль STAFF имеет `reports`, но не `settings`: `apps/api/src/auth/permissions.ts:52-56`;
- API каталога товаров и поставщиков требует `settings`: `apps/api/src/auth/route-access.test.ts:75-84`;
- UI без проверки `settings` показывает создание, изменение, архив и цену товара: `apps/web/src/app/bar/products/page.tsx:27-68`;
- UI без проверки `settings` показывает создание и переключение поставщика: `apps/web/src/app/bar/suppliers/page.tsx:35-65`;
- stock board также показывает add/edit/archive: `apps/web/src/app/bar/stock-board.tsx:139-198`, `:240-275`;
- форма поступления разрешает строку «новый товар», а action вызывает `createProduct` до receipt: `apps/web/src/app/bar/new-receipt.tsx:164-166`, `apps/web/src/app/bar/actions.ts:64-74`.

Условие воспроизведения: войти как STAFF, открыть Bar и попытаться создать товар, поставщика, изменить цену или создать поступление со строкой нового товара.

Влияние: интерфейс предлагает операции, которые сервер закономерно отклоняет. Особенно проблемен новый товар внутри поступления: пользователь заполняет весь документ и получает отказ из-за скрытой разницы прав.

Исправление: загрузить capability для каждой группы Bar-действий и скрывать или явно отключать каталог/поставщиков без `settings`. В receipt form разрешать выбор существующих товаров для desk, а создание нового показывать только при `settings`. Добавить ролевой UI-тест OWNER/MANAGER/STAFF.

### H-05 [P2] Переключение категории кассы безусловно проглатывает ошибку API

Статус: **confirmed, error masking**.

Доказательство:

- toggle-форма категории не имеет action state или места для ошибки: `apps/web/src/app/finance/cash.tsx:471-527`;
- server action ловит любую ошибку, ничего не возвращает пользователю и всё равно вызывает revalidate: `apps/web/src/app/finance/cash-actions.ts:125-135`.

Условие воспроизведения: API изменения категории отвечает 403, 409 или 500, затем пользователь нажимает включение или выключение.

Влияние: строка после обновления остаётся в прежнем состоянии без объяснения. Пользователь может повторять действие и не понимает, это запрет, конфликт или сбой.

Исправление: не подавлять исключение. Возвращать типизированный action result, показывать ошибку рядом со строкой и менять визуальное состояние только после подтверждённого успеха. Добавить тест 403/409/500.

### H-06 [P2] Прямые reservation и unit routes не проверяют Hospitality vertical

Статус: **confirmed, route contract**.

Доказательство:

- список бронирований входит через Hospitality guard: `apps/web/src/app/reservations/page.tsx:53`;
- канонические страницы новой брони и карточки не вызывают `requireVertical`: `apps/web/src/app/reservations/new/page.tsx:24-104`, `apps/web/src/app/reservations/[number]/page.tsx:30-42`;
- print routes также не вызывают vertical guard: `apps/web/src/app/reservations/[number]/print/page.tsx:63-70`, `apps/web/src/app/reservations/[number]/print/contract/page.tsx:20-35`, `apps/web/src/app/reservations/[number]/print/invoice/page.tsx:21-35`;
- intercepted drawers импортируют канонические страницы напрямую: `apps/web/src/app/@drawer/(.)reservations/new/page.tsx:1-12`, `apps/web/src/app/@drawer/(.)reservations/[number]/page.tsx:1-7`;
- `/units/[code]` также не имеет vertical guard: `apps/web/src/app/units/[code]/page.tsx:17-44`.

Условие воспроизведения: организация с вертикалью BEAUTY или FOOD_SERVICE открывает один из прямых URL вручную либо получает такую ссылку.

Влияние: маршрут входит в гостиничный экран до того, как нижележащий API отклонит отсутствующую capability или вернёт общую ошибку. Это нарушает единый vertical boundary и создаёт непредсказуемый cross-vertical UX. Статическое чтение не доказывает утечку данных, потому что API сохраняет собственные scope/capability guards.

Исправление: добавить `requireVertical(['HOSPITALITY'])` в канонические page functions. Тогда intercepted drawers автоматически унаследуют границу. Добавить route-тесты прямого URL для BEAUTY и FOOD_SERVICE.

### H-07 [P3] Ссылки на договор и счёт не раскрывают черновой статус до открытия

Статус: **confirmed, capability gap and UX disclosure**. Это не подтверждённая поломка юридической функции: сами документы явно маркированы как черновики.

Доказательство:

- карточка брони рендерит обычные print links: `apps/web/src/app/reservations/[number]/page.tsx:88-95`, `:332-343`;
- шаблон содержит hardcoded placeholders банковских реквизитов и подписанта, а также явный draft banner: `apps/web/src/app/reservations/[number]/print/forms.ts:12-21`, `:59`;
- договор выводит черновой статус и пустые реквизиты: `apps/web/src/app/reservations/[number]/print/contract/page.tsx:74`, `:97-116`, `:168`, `:179-181`;
- счёт выводит тот же черновой набор: `apps/web/src/app/reservations/[number]/print/invoice/page.tsx:74`, `:97-102`, `:178`;
- summary настроек прямо называет реквизиты и документы заглушками: `apps/web/src/app/hotel-settings/object-summaries.tsx:140-149`.

Условие воспроизведения: открыть карточку любой брони. До перехода ссылка выглядит как обычная печать договора или счёта; черновой статус становится виден уже внутри документа.

Влияние: готовность capability раскрывается на один шаг позже, чем нужно. Пользователь тратит переход, прежде чем узнаёт, что реквизиты и подписант ещё не настроены. Код не доказывает, что черновик выдаётся как юридически готовый документ.

Исправление: до появления утверждённых реквизитов назвать ссылки «Черновик договора» и «Черновик счёта» либо добавить рядом явную метку. После утверждения модели хранить реквизиты и подписанта в настройках и убрать placeholders. Не придумывать банковские или юридические правила без решения владельца.

## 6. Гипотезы и ограничения, не классифицированные как confirmed defect

| ID | Статус | Наблюдение | Что требуется для подтверждения |
|---|---|---|---|
| HH-01 | hypothesis | Серверные write guards для H-01 присутствуют; не доказаны только точный HTTP-ответ и пользовательское сообщение для каждого позднего отказа | Браузерный прогон read-only организации и журнал API-ответов |
| HH-02 | hypothesis | Прямые cross-vertical routes из H-06 могут завершаться редиректом, 403, 404 или общим load error в зависимости от конкретного API | Route/runtime проверка BEAUTY и FOOD_SERVICE профилей |
| HH-03 | hypothesis | Доступность и качество OCR Bar зависят от bot-сервиса | Sandbox-вызов с тестовым изображением без реальных данных |
| HH-04 | hypothesis | Корректность реального Channex pull/flush/register/test не выводится из UI и контроллера | Sandbox или сертификационный прогон по проектной документации |
| HH-05 | hypothesis | Юридическая корректность формы 910, договора и счёта не может быть подтверждена статическим code review | Проверка владельцем процесса и специалистом по применимым требованиям |

## 7. Неработающие кнопки, заглушки и намеренные ограничения

Подтверждённые неработающие или ложные affordance перечислены в H-01, H-04 и H-05.

Отдельно проверены элементы, которые не следует ошибочно считать дефектами:

- `/cashbox` предназначен для ресторанного контура. Гостиничная касса реализована внутри `/finance`.
- `/rates/*` является compatibility redirect в категории номеров. Отдельная пустая страница тарифов не рендерится.
- Bar «Переместить» отключено при единственном складе. Это явное ограничение текущей модели, а не скрытый успешный action.
- OCR Bar имеет ручной путь ввода и явную серверную ошибку недоступности, поэтому отсутствие bot-сервиса не превращается в молчаливую потерю документа.
- Hotel Settings `sales` и `documents` показывают summary текущей готовности. Там не найдено декоративных кнопок, которые имитируют завершённую внешнюю операцию.
- Mapping Channels является read-only представлением связей. Отсутствие ручного редактирования на этой странице не классифицируется как дефект без отдельного требования.
- Пустые списки гостей, броней, операций, отчётов, номеров, Bar и Channels не являются ошибкой сами по себе.

## 8. Проверка безопасности и качества границ

Положительные свойства:

- В проверенных UI-файлах не найдено literal API key, password или access token. `.env` и credentials не читались.
- Основные записи идут через server actions и API-клиенты, а не напрямую из client component в базу.
- API-карта разделяет `desk`, `reports`, `finance`, `settings` и `channels`; проблема H-04 состоит в несогласованном UI, а не в отсутствии серверного права.
- Reservation print маскирует чувствительные номера документов; channel revision facts проходят серверную фильтрацию PII.
- Денежные значения в изученных формах и отчётах передаются как minor units или форматируются из целочисленных значений. Нового подтверждённого float-дефекта не найдено.
- Не найдено подтверждённого cross-tenant запроса или обхода org/property scope.
- Не найдено пустого `catch {}` в интерактивных компонентах области. Однако два catch-пути намеренно уничтожают смысл ошибки: H-02 и H-05.

Ограничение вывода: без выполнения diagnostics нельзя подтвердить отсутствие TypeScript/LSP ошибок во всех модифицированных файлах. Без тестов и runtime нельзя подтвердить фактические статусы HTTP, browser behavior, доступность внешних сервисов и production состояние.

## 9. Пробелы существующего тестового покрытия

Тесты оценены только чтением. Ни один тест в рамках аудита не запускался.

| Область | Что уже покрыто в репозитории | Существенный пробел |
|---|---|---|
| Chessboard | Много UI-наборов для range, week/month, drag, extend, blocks, mobile, unassigned; unit-планы drag/extend | Read-only проверяет баннер, неназначенные и свободную ячейку, но не header create, occupied drag/drop, resize, stay menu и housekeeping. Примеры текущего узкого покрытия: `tests/ui/trial-read-only.spec.ts:34-71`, `tests/ui/chessboard-range.spec.ts:154-169` |
| Reservations | Фильтры, состояния, CSV, карточка, promo, tariff, money, integration retry/lock | Нет полного read-only теста прямого `/reservations/new`, карточки, payment actions и intercepted drawers. `tests/ui/reservations-v2.spec.ts:150-180` открывает карточку, но не доказывает отсутствие мутаций |
| Поиск гостя | `apps/web/src/app/reservations/actions.test.ts` содержит случай API 500 | Тест закрепляет неправильный контракт `500 -> []` вместо различения ошибки и нулевого результата. Нет регрессии, запрещающей неявный дубль |
| Finance | Широкие UI и integration наборы для cash, services, debts, operations и cards | Нет теста ошибки toggle категории 403/409/500 и видимого сообщения пользователю |
| Inventory и units | UI каталога/onboarding, e2e inventory/unit blocks, integration editor/ARI | Нет read-only матрицы для add, rename, bulk housekeeping, category CRUD, fund editor и direct unit actions |
| Bar | `tests/ui/bar.spec.ts`, action unit tests, integration ownership/RLS/overview/concurrency | Нет ролевой UI-матрицы STAFF/settings; нет read-only сценария; нет failure-injection теста второго шага receipt/product-price/bulk archive |
| Reports и analytics | Отдельные UI-наборы hub, finance, print, shell, channels, occupancy, units и integration analytics | Статический аудит не нашёл критичного функционального пробела. Runtime-сверка цифр вынесена в параллельный общий аудит |
| Hotel settings | Property settings, settings simplification, object card и e2e доменных правил | Не найден отдельный тест явной маркировки ссылок договора и счёта как черновиков до перехода |
| Channels | UI list/compact/reconcile/events, Channex screens, integration journal/certification | Нет read-only проверки pull, flush и retry. Внешний runtime контракт по статике не подтверждается |
| Vertical boundary | Есть unit/integration тесты vertical guard | Нет прямых route-тестов для reservation new/detail/print и unit detail из BEAUTY/FOOD_SERVICE |

Минимальный набор регрессий для закрытия P1/P2/P3:

1. Read-only UI matrix по каждому типу мутации H-01.
2. Directory 500 должен давать видимую ошибку и не разрешать неявное создание гостя.
3. Failure-injection после первого шага каждой составной Bar-операции с доказательством отсутствия частичного коммита.
4. Ролевая матрица Bar OWNER/MANAGER/STAFF с отдельными `desk` и `settings` действиями.
5. Ошибка cash category toggle должна оставаться видимой.
6. Direct route vertical tests для reservation/unit страниц.
7. Явная маркировка draft print links до открытия документа.

## 10. Рекомендованный порядок исправления

1. H-02: перестать маскировать directory failure, чтобы не создавать новые дубли.
2. H-03: сделать Bar use cases атомарными на API и DB уровне.
3. H-01: закрыть read-only на всех mutation surfaces, начиная с chessboard и reservation card.
4. H-04: согласовать Bar UI с `settings` и `desk` правами.
5. H-05: вернуть пользователю ошибку категории кассы.
6. H-06: добавить Hospitality guard в канонические direct routes.
7. H-07: раскрыть черновой статус в ссылках до открытия документа.

## 11. Финальный счёт

- Изучено: **41 маршрутизируемый `page.tsx` entrypoint**, не менее **54 route/view сценариев**.
- Дополнительно изучены: интерактивные компоненты, server actions, API-клиенты, контроллеры прав и релевантные исходники тестов.
- Confirmed issues: **7**, из них P1: **2**, P2: **4**, P3: **1**.
- Наиболее важные дефекты: маскировка ошибки поиска гостя с риском дубля и неатомарные составные Bar-операции. Неполный read-only gate классифицирован как P2 UI mismatch без подтверждённого server bypass.
- Production/runtime proof: **не выполнялся и не заявляется**.
