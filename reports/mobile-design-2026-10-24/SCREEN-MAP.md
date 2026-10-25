# WETOP Mobile: карта экранов

160 макетов. Общие экраны используются всеми направлениями; четыре платформенных экрана доступны только главному администратору. Это визуальная концепция, не изменение модели данных или прав. Маршруты с примерными id обозначают сценарий карточки, а не существующий публичный endpoint.

| ID | Направление | Экран | Источник / сценарий |
|---|---|---|---|
| login | common | Вход в WETOP | /login |
| register | common | Создать аккаунт | /register |
| verify | common | Подтвердите почту | /auth/verify |
| reset | common | Забыли пароль? | /password-reset |
| reset-sent | common | Проверьте почту | /password-reset |
| new-password | common | Новый пароль | /password-reset/confirm |
| business | common | Выберите бизнес | /auth/organizations |
| branch-beauty | common | Выберите филиал | /branches |
| menu-beauty | common | Все разделы | Мобильная навигация |
| branch-food | common | Выберите филиал | /branches |
| menu-food | common | Все разделы | Мобильная навигация |
| branch-hostel | common | Выберите филиал | /branches |
| menu-hostel | common | Все разделы | Мобильная навигация |
| onboarding | common | Настройка бизнеса | /onboarding |
| onboarding-branch | common | Первый филиал | /register/setup |
| invite | common | Пригласить сотрудника | /staff |
| team | common | Команда | /team |
| employee | common | Сотрудник 01 | /staff/[id] |
| employee-edit | common | Данные сотрудника | /staff/[id] |
| permissions | common | Права доступа | /team/roles |
| staff-schedule | common | График работы | /staff-schedule · /employees/shifts |
| shift-edit | common | Рабочая смена | /staff-schedule |
| payroll | common | Зарплата | /payroll |
| payroll-detail | common | Расчёт сотрудника | /payroll |
| finance | common | Финансы | /finance · /restaurant-finance |
| cashbox | common | Касса | /cashbox |
| payment | common | Принять оплату | /cashbox · /finance |
| payment-success | common | Оплата принята | /cashbox |
| cash-shift | common | Кассовая смена | /cashbox |
| cash-close | common | Закрытие смены | /cashbox |
| transactions | common | Операции | /finance |
| expense | common | Новый расход | /finance |
| refund | common | Возврат оплаты | /finance |
| certificates | common | Сертификаты | /finance/certificates |
| certificate | common | Сертификат | /finance/certificates |
| reports | common | Отчёты | /reports · /reports/finance |
| warehouse | common | Обзор склада | /warehouse |
| goods | common | Товары | /bar |
| stock-kitchen | common | Продукты и материалы | /stock · /bar/consumables |
| bar-menu | common | Меню бара | /bar/menu |
| products | common | Номенклатура | /bar/products |
| product | common | Товар 01 | /bar/products/[id] |
| product-new | common | Новая позиция | /bar/products |
| receipts | common | Приходы | /bar/receipts |
| receipt | common | Приход № 001 | /bar/receipts/[id] |
| receipt-new | common | Новый приход | /bar/receipts |
| suppliers | common | Поставщики | /bar/suppliers |
| supplier | common | Поставщик 01 | /bar/suppliers/[id] |
| stock-moves | common | Движение товаров | /bar/operations |
| writeoff | common | Списание | /bar/operations |
| notifications | common | Уведомления | Мобильная оболочка |
| settings | common | Настройки | /settings |
| payment-methods | common | Способы оплаты | /branch-payment-methods |
| appearance | common | Внешний вид | /profile |
| sessions | common | Безопасность | /profile |
| profile | common | Мой профиль | /profile |
| help | common | Помощь | /help |
| support | common | Обращение в поддержку | /help |
| whats-new | common | Что нового | /whats-new |
| marketing | common | Продвижение | /marketing |
| ads | common | Реклама | /marketing/ads |
| ad-detail | common | Кампания 01 | /marketing/ads |
| content | common | Контент | /marketing/content |
| post | common | Публикация | /marketing/content |
| voice | common | Голосовой агент | /marketing/voice |
| voice-detail | common | Звонок 01 | /marketing/voice |
| ai | common | ИИ-продавец | /ai-agents |
| ai-detail | common | Агент 01 | /ai-seller/agents |
| ai-knowledge | common | База знаний | /ai-seller/knowledge |
| ai-connections | common | Каналы общения | /ai-seller/connections |
| sales | common | Обзор продаж | /sales |
| budget | common | Бюджет и аналитика | /marketing/budget |
| platform | platform | Организации | /platform |
| platform-org | platform | Организация 01 | /platform/[id] |
| platform-support | platform | Техподдержка | /platform/support |
| platform-journal | platform | История платформы | /platform |
| state-loading | common | Загрузка | Общие состояния |
| state-empty | common | Пустой список | Общие состояния |
| state-offline | common | Нет сети | Общие состояния |
| state-forbidden | common | Нет доступа | Общие состояния |
| state-error | common | Ошибка сервера | Общие состояния |
| state-success | common | Подтверждение | Общие состояния |
| state-confirm | common | Выход из аккаунта | Общие состояния |
| b-dashboard | beauty | Сегодня | /today |
| b-calendar | beauty | Календарь | /calendar |
| b-appointments | beauty | Записи | /appointments |
| b-appointment-detail | beauty | Запись B-1042 | /appointments/B-1042 |
| b-appointment-create | beauty | Новая запись | /appointments/new |
| b-customers | beauty | Клиенты | /customers |
| b-customer-detail | beauty | Клиент 01 | /customers/01 |
| b-services | beauty | Услуги | /services |
| b-service-detail | beauty | Стрижка | /services/haircut |
| b-masters | beauty | Мастера | /employees |
| b-master-detail | beauty | Мастер 01 | /employees/01 |
| b-schedule | beauty | График мастеров | /beauty/schedule |
| b-team-access | beauty | Сотрудники и доступ | /staff |
| b-analytics | beauty | Аналитика салона | /management/analytics |
| b-journal | beauty | Журнал операций | /journal |
| b-help | beauty | Помощь | /help |
| b-profile | beauty | Профиль | /profile |
| b-settings | beauty | Настройки салона | /beauty-settings |
| b-notifications | beauty | Уведомления | Мобильная оболочка |
| f-dashboard | food | Главная | /today |
| f-orders | food | Заказы | /orders |
| f-order-detail | food | Заказ F-206 | /orders/F-206 |
| f-order-create | food | Новый заказ | /orders/new |
| f-floor | food | План зала | /floor-plan |
| f-table-detail | food | Стол 08 | /floor-plan/table-08 |
| f-kitchen | food | Кухня | /kitchen |
| f-reservations | food | Бронирования столов | /table-reservations |
| f-reservation-create | food | Новая бронь стола | /table-reservations/new |
| f-customers | food | Клиенты | /customers |
| f-menu | food | Меню | /menu |
| f-dish-detail | food | Горячее 01 | /menu/hot-01 |
| f-inventory | food | Остатки кухни | /menu/inventory |
| f-employees | food | Сотрудники | /employees |
| f-payroll | food | Зарплата | /payroll |
| f-dining-areas | food | Залы и столы | /dining-areas |
| f-team-access | food | Сотрудники и доступ | /staff |
| f-analytics | food | Аналитика ресторана | /management/analytics |
| f-journal | food | Журнал операций | /journal |
| f-help | food | Помощь | /help |
| f-profile | food | Профиль | /profile |
| h-dashboard | hostel | Сегодня | /today |
| h-chessboard | hostel | Календарь размещения | /chessboard |
| h-reservations | hostel | Брони | /reservations |
| h-reservation-detail | hostel | Бронь H-3042 | /reservations/H-3042 |
| h-reservation-create | hostel | Новая бронь | /reservations/new |
| h-guests | hostel | Гости и бронирования | /guests |
| h-guest-detail | hostel | Клиент 02 | /guests/02 |
| h-checkin | hostel | Заезд гостя | /reservations/H-3042/check-in |
| h-checkout | hostel | Выезд гостя | /guests/02/check-out |
| h-tasks | hostel | Задачи смены | /tasks |
| h-housekeeping | hostel | Уборка | /tasks/housekeeping |
| h-inventory | hostel | Номерной фонд | /inventory |
| h-room-detail | hostel | Номер 204 | /inventory/room-204 |
| h-categories | hostel | Категории номеров | /rooms/categories |
| h-availability | hostel | Свободные места | /rooms/availability |
| h-rates | hostel | Тарифы и цены | /rooms/categories/standard/rates |
| h-finance | hostel | Оплаты и касса | /finance |
| h-analytics | hostel | Аналитика | /management/analytics |
| h-channels | hostel | Каналы продаж | /channels |
| h-settings | hostel | Настройки объекта | /hotel-settings |
| h-team | hostel | Сотрудники и доступ | /team |
| h-journal | hostel | Журнал операций | /journal |
| f-waiter | food | Принять заказ | /waiter |
| f-drinks | food | Напитки | /drinks |
| f-settings | food | Настройки ресторана | /restaurant-settings |
| h-connections | hostel | Подключения | /connections |
| h-incidents | hostel | Неисправности | /incidents |
| h-incident-new | hostel | Новая неисправность | /incidents |
| h-market | hostel | Анализ конкурентов | /market |
| b-service-edit | beauty | Редактировать услугу | /services |
| b-master-edit | beauty | Профиль мастера | /employees |
| b-customer-new | beauty | Новый клиент | /customers |
| b-reschedule | beauty | Перенести запись | /appointments/[id] |
| f-dish-edit | food | Блюдо и техкарта | /menu |
| f-table-edit | food | Настройка стола | /dining-areas |
| h-room-edit | hostel | Номер и места | /inventory |
| h-rate-edit | hostel | Цена размещения | /rates |
