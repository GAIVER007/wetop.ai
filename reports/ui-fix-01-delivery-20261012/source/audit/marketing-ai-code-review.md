# Статический READ-ONLY аудит Marketing, Website, Sales, Market, AI и Connections

Дата аудита: 11.10.2026  
Замороженная версия: `0e2d69e1739678852d7745d2ca9f4e74ec595b0f`  
Рабочая копия: `.claude/worktrees/sidebar-nav`  
Область: все страницы `app/marketing/**`, `website/**`, `sales`, `market`, `ai-agents/**`, `ai-seller/**`, `connections/**`.

## 1. Метод и ограничения

Аудит выполнен только статическим чтением исходного кода, проектной документации и существующих тестов. Git-команды, тесты, LSP/TypeScript diagnostics, серверы, базы данных, браузер, внешние API и production не запускались. `.env`, credentials и секреты не читались.

Следствия ограничения:

- `подтверждено` означает доказуемое по текущему коду расхождение между UI, API или принятым контрактом;
- `гипотеза` означает риск, для которого требуется runtime, browser или live proof;
- наличие тестового файла не означает, что тест проходил на этой версии;
- этот документ не является доказательством работоспособности, выкладки или поведения production;
- аудит общей навигации, полный UI-прогон и browser/live QA остаются у лидера.

Проверка шла в два этапа. Сначала сверены назначение страниц, разрешённые возможности, права и границы API. Затем проверены кнопки, вкладки, catch-all, формы, валидаторы, server actions, состояния загрузки и ошибки, сохранение, предпросмотр, публикация, отправка, ссылки и заглушки.

## 2. Итог

Проверена 21 исходная страница `page.tsx`. Catch-all `/ai-seller/[[...section]]` дополнительно разобран как семь адресных экранов: обзор, настройка, диалоги, знания, подключения, сценарии и аналитика.

Подтверждено 8 дефектов:

| Severity | Количество | Смысл |
|---|---:|---|
| P0 | 0 | Критическая утечка, обход прав, необратимая потеря данных или полный отказ контура |
| P1 | 1 | Существенно искажено операционное состояние, возможны неверные решения пользователя |
| P2 | 6 | Нарушен пользовательский сценарий, безопасное состояние или доступность действия |
| P3 | 1 | Локально скрыта ошибка без прямой потери данных |

Главные дефекты:

1. `/market` скрывает отказ API цен как отсутствие цен. Таблица показывает `–`, график и кнопки ввода цен исчезают без сообщения об ошибке.
2. `/sales` превращает технический отказ статуса AI seller в утверждение «ИИ-продавец не подключён».
3. Администратор с правом `dialogs`, но без `seller`, может открыть карточку размещённого агента и получает активные формы инструкции и Telegram, которые API отвергает.
4. Поиск диалогов работает только по последним 50 строкам и может сообщить «Ничего не найдено» для существующего старого диалога.
5. Режим организации «только чтение» не отражён на формах Website и Channex: изменяющие кнопки активны, хотя глобальный API guard гарантированно вернёт 403.

Вердикт статического code review: **REQUEST CHANGES**. Основание: один P1 и несколько P2 в операционных данных, правах и безопасных состояниях.

## 3. Реестр страниц и действий

| Страница | Загрузка и данные | Действия пользователя | Права и запись | Safe state и вывод |
|---|---|---|---|---|
| `/marketing` | `apps/web/src/app/marketing/page.tsx:27-63`, локальная конфигурация трёх модулей, без API | Открыть сайт, рекламу, контент; меню сайта ведёт в публикацию, изображения, Website | Маршрут наследует `settings`, вертикаль Hospitality проверяется `requireVertical` | Реклама и контент явно помечены «Скоро». Это неполные возможности, не дефект |
| `/marketing/ads` | `apps/web/src/app/marketing/ads/page.tsx:91-120`, данных и API нет | Пять клиентских вкладок; «Создать кампанию» и «Подключить кабинет» disabled | `settings`, Hospitality | Честное пустое состояние. Запуск кампаний отсутствует как заявленная будущая возможность |
| `/marketing/content` | `apps/web/src/app/marketing/content/page.tsx:62-119`, данных и API нет | Пять вкладок; «Создать контент» disabled; медиатека ведёт в изображения сайта | `settings`, Hospitality | Генерация и планирование явно в разработке. Это не баг |
| `/marketing/site` | `apps/web/src/app/marketing/site/page.tsx:19-69`; current, журнал публикаций, источник брони | Предпросмотр; публикация; пауза и возобновление; выбор источника брони; rollback; архив; ссылки в редактор и медиатеку | API `settings`; `shell.readOnly` передаётся в доску и отключает изменяющие действия | Ошибка основного набора даёт `LoadError`; отсутствие сайта даёт EmptyState. Предпросмотр разрешён и в режиме чтения, так как не меняет состояние |
| `/marketing/site/assets` | `apps/web/src/app/marketing/site/assets/page.tsx:17-37`; библиотека и фото Channex | Загрузка файла; выбор типа; ALT; удаление; выбор и импорт фото Channex | API `settings`; read-only отключает запись | Основная ошибка видима. Импорт более 20 фото обрезается без предупреждения, см. MKT-AI-05 |
| `/marketing/site/editor` | `apps/web/src/app/marketing/site/editor/page.tsx:21-113`; сайт, версия, бриф, ассеты, история, закладки | Bootstrap сайта; ручное редактирование; save; preview; версии, закладки и restore; AI Chat, Plan, Build, вопросы, дизайн, undo; знания проекта; выбор ассетов; переход к публикации | API `settings`; лицензия конструктора и `shell.readOnly` выключают запись | Основной current/draft сбой видим. Ошибки брифа, ассетов и истории скрываются как пустые данные, см. MKT-AI-07 |
| `/website` | `apps/web/src/app/website/page.tsx:15-43`; список и карточки сайтов, месячный отчёт | Вкладки; открыть публичный сайт; перейти указать адрес | API `settings`, только чтение | Ошибка основного списка пробрасывается в boundary. Ошибка отчёта показана как `–` с текстом «отчёт не загрузился», то есть не маскируется как ноль |
| `/website/settings` | `apps/web/src/app/website/settings/page.tsx:22-66`; карточки внешних сайтов | Создать сайт; добавить и убрать домен; открыть окно установки и копировать код; проверить счётчик; pause/resume; delete с подтверждением | API `settings`; global write guard блокирует запись в read-only | Формы не получают `shell.readOnly`, поэтому предлагают заведомо запрещённые действия, см. MKT-AI-06 |
| `/website/booking` | `apps/web/src/app/website/booking/page.tsx:18-48`; сайты, тарифы, настройки объекта | Демо; окно установки виджета; включить или выключить бронирование; выбрать тариф; сохранить | API `settings`; global write guard блокирует запись в read-only | Ошибка тарифов показана Alert. Ошибка settings даёт `–` у объекта и валюты. Read-only UI не обработан, см. MKT-AI-06 |
| `/website/analytics` | `apps/web/src/app/website/analytics/page.tsx:106-205`; сайт и отчёт за период | Выбор сайта и дат; preset-периоды; раскрытие таблиц; переход в «Брони» | GET API `settings` | Проверяются формат дат, порядок и предел 366 дней. Ошибки отчёта отображаются отдельно. Записывающих действий нет |
| `/sales` | `apps/web/src/app/sales/page.tsx:45-197`; независимые запросы sales, seller и market | Период 7/30 дней; KPI и карточки ведут в Market и AI seller; добавить конкурента | GET `reports`, `dialogs`; mutations нет | Ошибка sales summary видима. Ошибка seller status превращается в «не подключён», см. MKT-AI-02 |
| `/market` | `apps/web/src/app/market/page.tsx:74-207`; загрузка, цены, история ночи, права | Период и сравнение; фильтры; добавить, изменить и архивировать конкурента; внести загрузку и цены; открыть ночь | Чтение `reports`; изменения `rates`; `shell.readOnly` и роль отключают запись | Ошибка occupancy даёт `LoadError`. Ошибка rates скрывается как отсутствие цен, см. MKT-AI-01 |
| `/ai-agents` | `apps/web/src/app/ai-agents/page.tsx:25-88`; единый каталог и состояние расширения | Открыть агента; создать агента или увидеть disabled-кнопку с причиной; перейти к подключению расширения | Каталог `dialogs`; создание `seller`; `shell.readOnly` учтён для create | Ошибка каталога видима. Карточка не использует `canManage` при построении ссылки, см. MKT-AI-03 |
| `/ai-agents/new` | `apps/web/src/app/ai-agents/new/page.tsx:17-59`; варианты Business и Location | Название, Business, свободный Location; создать и настроить; отмена | options доступны с `dialogs`; POST требует `seller`; `canCreate` и read-only проверены | Занятые филиалы disabled, серверная и клиентская валидация совпадают. Подтверждённого дефекта не найдено |
| `/ai-agents/[id]` | `apps/web/src/app/ai-agents/[id]/page.tsx:16-59`; карточка агента, инструкция, Telegram | Сгенерировать и сохранить инструкцию; проверить статус и токен Telegram; подключить или остановить бота | GET карточки с `dialogs`; instruction и Telegram требуют `seller` | Для STAFF страница открывается, но формы не переводятся в role read-only, см. MKT-AI-03 |
| `/ai-seller/[[...section]]` | `apps/web/src/app/ai-seller/[[...section]]/page.tsx:104-175`; семь экранов; старые адреса redirect; неизвестные адреса 404 | Overview: KPI и очередь. Setup: инструкция, версии, AI test. Dialogs: mode, поиск, карточка, takeover/release, reply, assignee, next step, notes. Knowledge: upload и данные объекта. Connections: model key, Telegram, WhatsApp, embed. Scenarios и Analytics: чтение и периоды | STAFF видит только Dialogs; seller-право открывает остальные вкладки. API разделяет `dialogs` и `seller`; истёкшее расширение переводит действия в чтение | Catch-all валидирует длину и имя. Поиск ограничен последними 50, см. MKT-AI-04. Ошибка истории инструкций скрыта, см. MKT-AI-08 |
| `/ai-seller/agents` | `apps/web/src/app/ai-seller/agents/page.tsx:6-111`; legacy-каталог draft-агентов | Создать агента; открыть редактор; перейти к продавцу гостиницы; refresh при ошибке | API legacy-модуля требует доступ владельца и feature gate | Страница честно сообщает, что новый каталог может быть недоступен. Контур запуска агентов неполный, но явно обозначен |
| `/ai-seller/agents/new` | `apps/web/src/app/ai-seller/agents/new/page.tsx:5-28`; пустой legacy draft | Заполнить мастер и создать draft | Legacy API и server action | Сохранение не запускает агента, это явно написано. Неполная возможность, не баг |
| `/ai-seller/agents/[id]` | `apps/web/src/app/ai-seller/agents/[id]/page.tsx:6-31`; legacy draft | Изменить поля draft и сохранить с optimistic version; вернуться к списку | Legacy API, tenant scope и owner access | Ошибка API видима. Модель и каналы новых агентов прямо названы незавершёнными |
| `/connections` | `apps/web/src/app/connections/page.tsx:30-105`; Channex собирается из независимых сигналов | Вкладки connected/available; refresh; настройки; каналы продаж; incidents | Чтение `channels/settings`; технические детали только owner или platform admin | Частичные сбои преобразуются в issues и `unknown`, а не в зелёное состояние. Подтверждённого дефекта страницы не найдено |
| `/connections/channex` | `apps/web/src/app/connections/channex/page.tsx:4-19`; использует общий `ChannelConnectionSetup` | Создать объект и категории; зарегистрировать и проверить webhook; полная выгрузка; ссылки в статистику, mapping, sync, events | UI показывает запись только OWNER; API требует `channels`; global write guard блокирует read-only | Ошибки connection/webhook видимы. Read-only не отключает owner-кнопки, см. MKT-AI-06 |

## 4. Подтверждённые дефекты

### MKT-AI-01, P1: отказ API цен рынка маскируется под отсутствие данных

**Файлы:**

- `apps/web/src/app/market/page.tsx:109-115`
- `apps/web/src/app/market/page.tsx:180-192`
- `apps/web/src/app/market/competitors-table.tsx:128-143`

**Триггер:** `GET /market/rates` отвечает ошибкой или недоступен, при этом `GET /market/occupancy` успешен.

**Фактическое поведение:** catch возвращает `null`. Страница продолжает работу без Alert или `LoadError`. Средняя цена и изменение превращаются в `–`, ценовой график исчезает, а `RatesButton` не рисуется, потому что `price` отсутствует.

**Влияние:** технический отказ неотличим от реального отсутствия цен. Пользователь может принять решение о цене на неполной картине и не может повторно внести цены из этой таблицы. Это fallback, который скрывает доказательство отказа первичного контракта.

**Исправление:** хранить для rates три состояния: loaded, empty, failed. При failed оставить occupancy доступным, но показать отдельный Alert с повтором. Не использовать `null` одновременно для «данных нет» и «запрос упал». Возможность ввода цен должна зависеть от права, а не от успешности чтения текущих цен.

### MKT-AI-02, P2: `/sales` сообщает «ИИ-продавец не подключён» при техническом отказе status API

**Файл:** `apps/web/src/app/sales/page.tsx:29-35`, `apps/web/src/app/sales/page.tsx:50-66`, `apps/web/src/app/sales/page.tsx:151-186`, `apps/web/src/app/sales/page.tsx:272-296`.

**Триггер:** `sellerApi.status()` отвечает 5xx, timeout или сетевой ошибкой.

**Фактическое поведение:** `settle` сохраняет только `ok: false`, `botReadable` становится false, `noSeller` получает текст «ИИ-продавец не подключён», а карточка предлагает «Настроить ИИ-продавца».

**Влияние:** operational outage превращается в ложное состояние конфигурации. Пользователь может искать настройки и менять их вместо того, чтобы повторить запрос или дождаться восстановления сервиса.

**Исправление:** разделить `status failed`, `extension off`, `not configured`, `connected`. Для failure показывать «Не удалось проверить ИИ-продавца» и действие повторной загрузки. Не использовать ветку onboarding для технической ошибки.

### MKT-AI-03, P2: STAFF открывает страницу агента с активными запрещёнными настройками

**Файлы:**

- `packages/domain/src/accounts/permissions.ts:52-56`
- `apps/api/src/ai-seller/seller-catalog.service.ts:42-47`, `apps/api/src/ai-seller/seller-catalog.service.ts:69-77`
- `apps/web/src/app/ai-agents/page.tsx:48-50`, `apps/web/src/app/ai-agents/page.tsx:133-140`
- `apps/web/src/app/ai-agents/[id]/page.tsx:33-52`
- `apps/api/src/ai-seller/business-agents.controller.ts:30-35`
- `apps/api/src/ai-seller/agent-instructions.controller.ts:6-17`
- `apps/api/src/ai-seller/agent-telegram.controller.ts:5-16`

**Триггер:** роль STAFF, у организации есть размещённый agent из каталога, пользователь нажимает «Открыть».

**Фактическое поведение:** STAFF имеет `dialogs`, но не `seller`. Каталог и `GET /ai-seller/agents/:id` доступны с `dialogs`, поэтому страница загружается. Затем instruction GET получает 403 и показывает `LoadError`. `TelegramPanel` получает только `shell.readOnly || archived`; роль в это условие не входит, поэтому поля токена и кнопки доступны и отправляют запросы, которые `@Access('seller')` отвергает.

**Влияние:** страница выглядит частично сломанной и предлагает ввод credential в действие, которое заведомо запрещено. Серверный замок сохраняет безопасность, обхода права не найдено, но UI нарушает принятый role contract.

**Исправление:** передавать в карточки и detail явный `canManage`. Для STAFF либо скрывать ссылку настройки и давать только разрешённую read-only карточку, либо открывать detail в полном role read-only без instruction/Telegram mutations. GET данных, доступных STAFF, не должен зависеть от `seller` endpoint.

### MKT-AI-04, P2: поиск диалогов проверяет только последние 50 разговоров

**Файлы:**

- `apps/web/src/app/ai-seller/[[...section]]/page.tsx:748-760`
- `apps/web/src/app/ai-seller/[[...section]]/page.tsx:778-815`
- `apps/web/src/lib/api.ts:2820-2823`
- `apps/api/src/bots/panel.ts:48-63`
- `apps/ai-seller/src/dashboard/panel_conversations.py:111-119`, `apps/ai-seller/src/dashboard/panel_conversations.py:160-168`

**Триггер:** у агента больше 50 диалогов, искомый гость находится за пределами последних 50, пользователь вводит имя или выбирает канал.

**Фактическое поведение:** web запрашивает список без `limit`; bot применяет default `limit = 50`; поиск по имени и каналу выполняется после получения списка в web. UI выводит «Ничего не найдено».

**Влияние:** существующий диалог скрывается, а отрицательный результат является ложным. Это особенно опасно для очереди, где сотрудник ищет обращение гостя.

**Исправление:** перенести `q` и `channel` в серверный запрос и фильтровать до `LIMIT`. Добавить курсор или пагинацию. До этого минимум запрашивать 200 и явно писать, что поиск ограничен, но это временная совместимость, а не корневое исправление.

### MKT-AI-05, P2: выбор более 20 фото Channex импортирует только первые 20 и очищает весь выбор

**Файлы:**

- `apps/web/src/app/marketing/site/assets/board.tsx:169-205`
- `docs/marketing/site-assets-v0.md:53-60`

**Триггер:** пользователь отмечает более 20 фото и нажимает «Импортировать выбранные».

**Фактическое поведение:** UI не ограничивает число checkbox. Action получает `[...chosen].slice(0, 20)`, после ответа вызывается `setChosen(new Set())`. Пользователь видит число выбранных, но не получает предупреждения, что часть будет отброшена.

**Влияние:** импортируется только подмножество, остальные выбранные фото теряются из состояния. Это может выглядеть как успешный полный импорт.

**Исправление:** ограничить выбор 20 с явным счётчиком и причиной либо отправлять последовательные пачки с прогрессом. При частичном успехе сохранять необработанные photoId в выборе и показывать imported/failed по каждой пачке.

### MKT-AI-06, P2: режим организации «только чтение» не отражён на Website и Channex mutations

**Файлы:**

- `apps/api/src/auth/auth.guard.ts:286-305`
- `packages/domain/src/accounts/trial.ts:41-45`
- `apps/web/src/app/website/settings/page.tsx:22-63`
- `apps/web/src/app/website/booking/page.tsx:18-43`, `apps/web/src/app/website/booking/page.tsx:139-155`
- `apps/web/src/app/website/forms.tsx:157-216`, `apps/web/src/app/website/forms.tsx:224-335`
- `apps/web/src/app/channels/connection-setup.tsx:20-29`, `apps/web/src/app/channels/connection-setup.tsx:113-124`
- `apps/web/src/app/channels/buttons.tsx:69-129`

**Триггер:** организация имеет статус READ_ONLY или истёкший trial; владелец открывает `/website/settings`, `/website/booking` или `/connections/channex`.

**Фактическое поведение:** глобальный API guard блокирует POST, PATCH и DELETE с `READ_ONLY_MESSAGE`. Страницы Website не читают `deskShell` вообще. Channex setup проверяет роль OWNER, но не `readOnly`. Поэтому создание сайта, домены, pause/delete, бронирование, setup Channex, webhook и full sync остаются активны до отправки и отвечают 403.

**Влияние:** безопасный режим представлен как рабочий. Пользователь вводит данные, подтверждает опасное действие или запускает долгую операцию и только после submit узнаёт, что запись запрещена.

**Исправление:** загрузить `deskShell` на страницах и передать `readOnly` во все mutation-компоненты. Отключить кнопки и поля, рядом показать `READ_ONLY_MESSAGE`. Server guard оставить обязательным. Добавить единый компонент, чтобы новые формы этих модулей не забывали safe state.

### MKT-AI-07, P2: редактор сайта превращает ошибки зависимых API в пустые данные и остаётся активным

**Файл:** `apps/web/src/app/marketing/site/editor/page.tsx:25-48`, `apps/web/src/app/marketing/site/editor/page.tsx:76-112`.

**Триггер:** основной `current` и draft доступны, но падает brief, assets или conversation.

**Фактическое поведение:** brief становится `null`, assets становятся `[]`, а неуспешный ответ conversation превращается в `[]`. `SiteEditor` продолжает работу без предупреждения. При отсутствии сайта CreateSite может получить пустой brief/facts; у существующего сайта picker выглядит как пустая медиатека, а история AI как отсутствующая.

**Влияние:** технический отказ подменяется пустым проектным контекстом. Пользователь может создать, отправить AI-запрос или сохранить изменения, не понимая, что редактор загрузил неполный набор исходных данных.

**Исправление:** хранить отдельный статус каждой зависимости. Brief failure должен блокировать bootstrap/AI, если бриф обязателен для операции. Assets и conversation failure должны давать локальный Alert и retry, а не пустой список. Не добавлять запасной путь, который продолжает запись с неполным контрактом.

### MKT-AI-08, P3: ошибка загрузки версий инструкции AI seller полностью скрыта

**Файл:** `apps/web/src/app/ai-seller/[[...section]]/page.tsx:345-350`.

**Триггер:** `sellerApi.promptVersions()` отвечает ошибкой.

**Фактическое поведение:** компонент возвращает `null`, поэтому блок истории исчезает без сообщения.

**Влияние:** пользователь не знает, что restore недоступен из-за отказа, и может решить, что истории в продукте нет. Текущая инструкция при этом не теряется.

**Исправление:** показать локальный `LoadError` в панели «Прежние версии инструкции» и оставить основной редактор рабочим.

## 5. Права, безопасность и границы

Подтверждённого обхода серверных прав не найдено:

- Market разделяет чтение `reports` и запись `rates` в `apps/api/src/market/market.controller.ts:22-71`.
- Marketing Site и Assets закрыты `@Access('settings')` в `apps/api/src/marketing-site/marketing-site.module.ts:36-43`.
- Analytics/Website закрыт `@Access('settings')` в `apps/api/src/analytics/analytics.controller.ts:17-55`.
- AI seller разделяет `dialogs` и `seller`; проблема MKT-AI-03 находится в UI и не даёт фактического privilege escalation.
- Read-only mutations блокируются глобально до контроллера в `apps/api/src/auth/auth.guard.ts:286-305`.
- Поля LLM, WhatsApp и Telegram используют password inputs, а сохранённые токены обратно не читаются. Жёстко заданных секретов в просмотренной области не найдено.
- Суммы Market форматируются из minor units. Новых floating-point вычислений денег в просмотренных actions не найдено.
- Stay dates Market передаются как `YYYY-MM-DD`; события и timestamps форматируются отдельно. Подтверждённого смешения DATE и UTC timestamp не найдено.

Оставшийся риск по правам связан с ложной доступностью действий и скрытыми ошибками, а не с отсутствием серверного замка.

## 6. Неполные возможности, которые не классифицированы как баги

| Возможность | Состояние в коде | Классификация |
|---|---|---|
| Рекламные кабинеты и кампании | `/marketing/ads`: кнопки disabled, есть `ModuleSoon`, API-запросов нет | Неполная возможность |
| Генерация контента и план публикаций | `/marketing/content`: основное действие disabled, пустые вкладки и ссылка на существующую медиатеку | Неполная возможность |
| Автоматический сбор данных конкурентов | `/market`: прямо сказано, что разрешённый источник пока не подключён | Неполная возможность |
| Запуск legacy `/ai-seller/agents/**` | Редактор сохраняет draft и прямо сообщает, что подключение к модели и каналам в разработке | Неполная возможность |
| Дети, SMS и предоплата в Website booking | `/website/booking` прямо перечисляет ограничения | Неполная возможность |

Такие элементы не включены в число P0-P3, поскольку интерфейс не выдаёт их за работающие действия.

## 7. Гипотезы, требующие runtime или browser proof

1. **Popup после async server action.** Предпросмотр публикации и редактора вызывает `window.open` только после `await` (`apps/web/src/app/marketing/site/board.tsx:119-123`, `apps/web/src/app/marketing/site/editor/editor.tsx:264-269`). Некоторые браузеры могут считать это не прямым user gesture и блокировать вкладку. Существующий Playwright-сценарий покрывает один стенд, но статическое чтение не доказывает поведение всех целевых браузеров.
2. **Конкурентное редактирование сайта.** Редактор использует revision/version contract, но без исполнения нельзя подтвердить, что все 409-конфликты сохраняют локальный текст и дают понятный recovery path во всех ручных и AI-операциях.
3. **Публичный preview и опубликованный сайт.** Код получает URL и открывает его, но успешный GET, соответствие версии, assets, host routing и поведение booking widget требуют browser/live проверки.
4. **Responsive и accessibility.** В исходниках есть aria, disabled и адаптивные компоненты, но отсутствие overflow, focus traps, popup-blocking и axe-нарушений нельзя подтвердить статически.
5. **Channex side effects.** Кнопки вызывают реальные setup/sync/webhook endpoints, но статическое чтение не является доказательством успешного sandbox request/response и не проверяет внешнюю систему.

## 8. Пробелы тестов

Существующие UI-тесты хорошо покрывают основные happy paths, empty states, часть read-only и responsive сценариев. Ниже перечислены пробелы, прямо соответствующие найденным дефектам.

| Gap | Нужная регрессия | Где добавить |
|---|---|---|
| G-01 | `GET /market/rates` падает, occupancy остаётся видимым, но отдельный Alert сообщает об отказе; кнопка ввода цен не исчезает из-за технической ошибки | `tests/ui/market-competitors.spec.ts` |
| G-02 | `sellerApi.status` падает на `/sales`; UI показывает «не удалось проверить», а не «не подключён» | `tests/ui/sales-hub.spec.ts` |
| G-03 | STAFF открывает карточку размещённого business agent; разрешённое чтение работает, instruction и Telegram mutations скрыты или disabled, запросы `seller` не отправляются | `tests/ui/ai-agents.spec.ts` или `tests/ui/ai-agents-create.spec.ts` |
| G-04 | Создать больше 50 диалогов, найти самый старый по имени и каналу; отрицательный результат допустим только после серверного поиска по всему scope | `tests/ui/ai-seller-dialogs.spec.ts` плюс bot/API test |
| G-05 | Выбрать 21 фото Channex; UI не теряет 21-е фото и явно соблюдает предел 20 или выполняет вторую пачку | новый UI-тест assets/editor |
| G-06 | READ_ONLY на `/website/settings` и `/website/booking`: все mutations disabled, `READ_ONLY_MESSAGE` видим, GET данные остаются | `tests/ui/website.spec.ts` |
| G-07 | READ_ONLY OWNER на `/connections/channex`: setup, webhook и sync disabled, данные видимы | новый connections/channex UI-тест |
| G-08 | Независимые отказы brief, assets и conversation в редакторе дают локальные ошибки и не подменяются пустыми данными | новый `tests/ui/marketing-site-editor.spec.ts` или расширение fixture suite |
| G-09 | Ошибка prompt versions показывает локальный recovery state, основной prompt editor остаётся доступным | `tests/ui/ai-seller-dialogs.spec.ts` |
| G-10 | Catch-all: второй сегмент и неизвестный section дают 404; legacy data/model/embed/whatsapp/check сохраняют ожидаемый redirect и query contract | `tests/ui/ai-seller.spec.ts` |

## 9. Что покрыто существующими тестами по исходникам

Без запуска подтверждено наличие сценариев:

- `tests/ui/marketing.spec.ts`: три модуля, «Скоро», disabled-кнопки, доступность и вертикаль;
- `tests/ui/marketing-site.spec.ts`: preview, publish, pause/resume, rollback, booking source, archive;
- `tests/ui/website.spec.ts`: вкладки, домены, счётчик, опасная зона, booking, analytics;
- `tests/ui/sales-hub.spec.ts`: KPI, карточки, empty states, summary failure, extension off;
- `tests/ui/market*.spec.ts`: competitors, rates, charts, read-only и история ночи;
- `tests/ui/ai-agents*.spec.ts`: каталог, create, STAFF create-block, read-only create-block;
- `tests/ui/ai-seller*.spec.ts`: вкладки, prompt, dialogs, handling, versions, connections, analytics;
- API unit/integration: analytics, market, sales, marketing assets/publication, AI seller services и tenant scope.

Эти файлы не закрывают G-01 - G-10 и не являются свежим доказательством прохождения на frozen SHA.

## 10. Стоп-условие аудита

Все 21 страницы области просмотрены, включая действия, API-boundaries, формы, права и safe states. Дефекты имеют severity, конкретный trigger, влияние, file:line и направление исправления. Дальнейшее увеличение уверенности требует запрещённых для этой сессии действий: запуска diagnostics/tests, fixture server, browser/live QA или проверки внешних интеграций.
