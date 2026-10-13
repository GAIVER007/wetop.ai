# Маршруты: итог мастер-прохода UI

Все `page.tsx` из `apps/web` и `apps/site`, ни один не пропущен. Получено автоматически из дерева.

| Маршрут | Итог | Что сделано или почему |
|---|---|---|
| `site` | FIXED | мокап на телефоне, пик графика, FAQ без «обсудите с нами», контакты |
| `site/blog/[[...slug]]` | PASS |  |
| `site/calculator` | PASS |  |
| `site/for/[segment]` | OPEN (остаток) | обещание пробного периода против «по приглашению», см. остатки |
| `site/for/hotels` | FIXED | мокап на телефоне |
| `site/for/restaurants` | FIXED | лид без оправдания; обещание пробного периода, см. остатки |
| `site/for/salons` | OPEN (остаток) | обещание пробного периода, своя палитра без тёмной темы |
| `site/privacy` | PASS |  |
| `site/terms` | FIXED | п. 1 без двойного двоеточия |
| `app` | NOT APPLICABLE | корень: перенаправление на стартовый экран направления |
| `app/@drawer/(.)reservations/[number]` | OPEN (остаток) | панель брони: внутри второй `main`, см. остатки |
| `app/@drawer/(.)reservations/new` | OPEN (остаток) | то же |
| `app/@drawer/[...catchAll]` | NOT APPLICABLE | пустой слот |
| `app/ai-agents` | FIXED | раздел «Продажи» в кнопке шапки |
| `app/ai-agents/[id]` | OPEN (остаток) | бейджи «Продажи»/«Hospitality» в карточке агента |
| `app/ai-agents/new` | FIXED | раздел в шапке |
| `app/ai-seller/[[...section]]` | FIXED | обзор без чужого sales.css, KpiTile из общих стилей |
| `app/ai-seller/agents` | OPEN (остаток) | без `Page`, см. остатки |
| `app/ai-seller/agents/[id]` | OPEN (остаток) | то же |
| `app/ai-seller/agents/new` | OPEN (остаток) | то же |
| `app/appointments` | FIXED | телефон, статус бейджем, «+ Новая запись» |
| `app/bar` | FIXED | раздел «Финансы» в шапке; плитки свои, см. остатки |
| `app/bar/operations` | PASS |  |
| `app/bar/products` | PASS |  |
| `app/bar/receipts` | PASS |  |
| `app/bar/receipts/new` | PASS |  |
| `app/bar/suppliers` | PASS |  |
| `app/beauty` | FIXED | кнопка раздела «Календарь» |
| `app/beauty/masters` | FIXED | кнопка раздела «Мастера» |
| `app/beauty/schedule` | FIXED | «График» в меню салона (решение №1 DS2) |
| `app/beauty/services` | FIXED | кнопка раздела «Услуги» |
| `app/branches` | FIXED | сводка только при гостиницах, склонения, даты словами, нейтральные тексты |
| `app/calendar` | FIXED | календарь мастеров: часы закреплены, статусы полосой, начало записи по рабочему дню |
| `app/cashbox` | PASS |  |
| `app/channel-manager` | NOT APPLICABLE | перенаправление в /channels |
| `app/channels/[[...section]]` | OPEN (остаток) | `.settings-tabs` вместо `Tabs` |
| `app/channels/events/[revisionId]` | PASS |  |
| `app/chessboard` | FIXED | пустое значение «—» вместо «н/д» |
| `app/connections` | PASS |  |
| `app/connections/channex` | PASS |  |
| `app/create` | OPEN (остаток) | свой визуальный язык мастера, см. остатки |
| `app/customers` | FIXED | пустой телефон «—»; таблица салона остаётся видимой |
| `app/design-system` | PASS |  |
| `app/dining-areas` | PASS |  |
| `app/employees` | PASS |  |
| `app/finance` | FIXED | пустые показатели «—»; дубли блоков см. остатки |
| `app/floor-plan` | FIXED | склонение мест и гостей, ошибка «Уборки» видна |
| `app/guests` | PASS |  |
| `app/guests/[id]` | PASS |  |
| `app/guests/birthdays` | FIXED | общая `Table` вместо таблицы без стилей, `LoadError` с повтором |
| `app/help` | FIXED | у гостиницы своя справка (была справка салона) |
| `app/hotel-settings/[[...section]]` | PASS |  |
| `app/incidents` | PASS |  |
| `app/inventory` | PASS |  |
| `app/inventory/@drawer` | NOT APPLICABLE | слот |
| `app/inventory/@drawer/(..)units/[code]` | PASS |  |
| `app/invite/[token]` | FIXED | появился H1 (было три h2) |
| `app/journal` | FIXED | фильтры по направлению, заголовок загрузки = заголовок страницы |
| `app/kitchen` | FIXED | задержанные заказы не дублируются |
| `app/login` | NOT APPLICABLE | перенаправление на wetop.ai |
| `app/login/check-email` | PASS |  |
| `app/login/reset` | PASS |  |
| `app/login/set-password` | PASS |  |
| `app/login/verify` | PASS |  |
| `app/management/[[...section]]` | NOT APPLICABLE | перенаправление в аналитику |
| `app/management/analytics` | FIXED | кнопки с существующими классами; аналитика салона и ресторана без сырого пояса |
| `app/management/analytics/channels` | PASS |  |
| `app/management/analytics/occupancy` | PASS |  |
| `app/management/analytics/units` | FIXED | пустое состояние «Отчёт» |
| `app/market` | FIXED | уровни сборщика словом, строка рынка «почти полны N из M» |
| `app/marketing` | PASS |  |
| `app/marketing/ads` | PASS |  |
| `app/marketing/content` | PASS |  |
| `app/marketing/site` | FIXED | «Назад к модулям» как у всего модуля |
| `app/marketing/site/assets` | FIXED | то же |
| `app/marketing/site/editor` | FIXED | то же; предупреждение sandbox iframe штатное |
| `app/menu` | FIXED | подзаголовок без гостиничного «право объект» |
| `app/onboarding` | PASS |  |
| `app/orders` | FIXED | один обработчик щелчка на строке |
| `app/payroll` | PASS |  |
| `app/platform` | FIXED | выбор ресторана при создании, без ссылок на ADR/QUESTIONS |
| `app/platform/support/[[...section]]` | FIXED | кнопка раздела «Техподдержка» |
| `app/profile` | FIXED | текст о доступе по ролям, «Расширения» только у гостиницы |
| `app/profile/access` | OPEN (остаток) | без `Page` |
| `app/rates/[[...rest]]` | NOT APPLICABLE | перенаправление в категории |
| `app/register` | NOT APPLICABLE | перенаправление |
| `app/register/complete` | FIXED | кнопка `btn--primary` (класса `btn-primary` нет) |
| `app/register/setup` | OPEN (остаток) | свой язык `.onboarding` |
| `app/reports` | PASS |  |
| `app/reports/finance` | PASS |  |
| `app/reports/form-910` | PASS |  |
| `app/reports/occupancy` | PASS |  |
| `app/reports/overview` | PASS |  |
| `app/reports/print` | INTENTIONAL DIFFERENCE | печатная форма |
| `app/reports/units` | PASS |  |
| `app/reservations` | FIXED | раздел «Гости и бронирования» в шапке |
| `app/reservations/[number]` | PASS |  |
| `app/reservations/[number]/print` | INTENTIONAL DIFFERENCE | лист A4: шире телефона по замыслу |
| `app/reservations/[number]/print/contract` | INTENTIONAL DIFFERENCE | то же |
| `app/reservations/[number]/print/invoice` | INTENTIONAL DIFFERENCE | то же |
| `app/reservations/new` | PASS |  |
| `app/rooms/[[...section]]` | PASS |  |
| `app/sales` | FIXED | стили KpiTile в общих компонентах |
| `app/services` | PASS |  |
| `app/staff` | NOT APPLICABLE | перенаправление в /team |
| `app/status` | PASS | публичная страница |
| `app/table-reservations` | FIXED | телефон и комментарий, статус бейджем, склонения, подтверждение отмены |
| `app/tasks` | FIXED | кнопка раздела «Календарь» |
| `app/team` | PASS |  |
| `app/team/roles` | FIXED | права словами салона и ресторана, гостиничные строки скрыты |
| `app/today` | NOT APPLICABLE | гостиница: перенаправление в /finance; салон и ресторан: свой экран |
| `app/units/[code]` | FIXED | кнопка раздела «Номерной фонд» |
| `app/website` | FIXED | «Назад к модулям» |
| `app/website/analytics` | FIXED | то же |
| `app/website/booking` | FIXED | то же |
| `app/website/settings` | FIXED | то же |
