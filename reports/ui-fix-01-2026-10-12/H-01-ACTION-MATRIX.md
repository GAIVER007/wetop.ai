# H-01: матрица действий Hospitality UI

Дата: 2026-10-12

Общее правило интерфейса: действие записи показывается только при наличии требуемого права и `readOnly === false`. Режим чтения сохраняет таблицы, фильтры, карточки, печать, историю, справочные данные и переходы. API продолжает независимо проверять право и состояние организации.

| Экран | Действие | Право | Состояние read-only | Web action | API |
| --- | --- | --- | --- | --- | --- |
| Шахматка | Новая бронь из шапки или свободной ячейки | `desk` | ссылка скрыта | форма новой брони | reservations create |
| Шахматка | Перенос проживания drag-and-drop | `desk` | drag/drop отключён, обработчики возвращают без записи | board command | reservations item update |
| Шахматка | Изменение даты выезда растягиванием | `desk` | resize-контрол скрыт | board command | reservations item update |
| Шахматка | Продлить, переселить, отменить, заселить, выселить | `desk` | меню и команды скрыты | board command | reservations update/check-in/check-out/cancel |
| Шахматка | Изменить уборку | `desk` | меню уборки скрыто | housekeeping command | units housekeeping |
| Бронь, создание | Отправить новую бронь | `desk` | форма не рендерится, submit дополнительно защищён | new reservation action | reservations create |
| Бронь, карточка | Даты, размещение, источник, заметка, статус | `desk` | вкладка действий без mutation-компонента | reservation actions | reservations update/item update |
| Бронь, счета | Оплата, начисление, цена, услуга, закрытие счёта | `desk` | формы и кнопки скрыты | finance actions | finance pay/charge/folio close, reservations item update |
| Бронь, счета | Возврат, сторно, замена платежа | `refunds` | кнопки и формы скрыты | finance actions | finance refund/void/replace |
| Бронь, счета | Запрос оплаты, отметить оплаченным, отменить | `desk` | mutation-форма и команды скрыты, готовый текст остаётся | payment request actions | finance payment requests |
| Бронь, карточка | Печать, просмотр фактов и переходы | чтение карточки | доступны | GET navigation | reservations/finance GET |
| Место | Уборка, блокировка, снятие блокировки | `desk` | `UnitActions` не рендерится | unit actions | units housekeeping/block |
| Место, панель | Редактировать номер | `property` | редактор скрыт | inventory editor action | inventory editor save |
| Место, панель | Создать бронь | `desk` | ссылка на форму скрыта | navigation to create | reservations create |
| Фонд | Добавить место, переименовать, редактировать каталог | `property` | редакторы и mutation-пункты скрыты | inventory editor actions | inventory editor save/remove |
| Фонд | Массовый статус уборки | `desk` | выбор строк и bulk-панель скрыты, handler защищён | `bulkHousekeepingAction` | units housekeeping |
| Фонд | Фильтры, карточка места, календарь, категории | чтение фонда | доступны | GET navigation | inventory GET |
| Bar, обзор | Продажа, продажа в фолио, приход, инвентаризация | `desk` | быстрые формы и ссылки записи скрыты | bar sale/receipt/inventory actions | `/bar/sales/*`, `/bar/receipts`, `/bar/inventory-counts` |
| Bar, товары | Создать, изменить, цена, архив | `settings` | редакторы, выбор и mutation-меню скрыты | catalog actions | `/bar/products*`, `/bar/categories*` |
| Bar, товар | Списание | `desk` | команда и форма скрыты | `writeOffBarAction` | `/bar/write-offs` |
| Bar, поставщики | Создать, архивировать | `settings` | форма и кнопка архива скрыты | supplier catalog actions | `/bar/suppliers*` |
| Bar, приходы | Новый приход, провести, оплатить | `desk` | ссылка и формы скрыты, журнал остаётся | receipt/payment actions | `/bar/receipts*` |
| Bar, операции | Списание, инвентаризация, возврат продажи | `desk` | формы и кнопки возврата скрыты | write-off/inventory/reverse actions | `/bar/write-offs`, `/bar/inventory-counts`, `/bar/sales/:id/reverse` |
| Channels, обзор и sync | Отправить очередь, забрать брони | `channels` | блок exchange скрыт, client handler защищён | `channelAction` | `/channels/channex/flush`, `/channels/channex/pull` |
| Channels, подключение | Setup, webhook, полная синхронизация | `channels` и существующее owner-ограничение | блок настройки скрыт, client handler защищён | `channelAction` | `/channels/channex/setup`, `/sync`, `/webhook/*` |
| Channels, события | Обработать ревизию заново | `channels` | retry скрыт в списке, callout и detail, handler защищён | `retryEventAction` | `/channels/channex/events/:id/retry` |
| Channels | Вкладки, фильтры, события, detail, бронь и календарь | чтение Channels | доступны | GET navigation | channels GET |

## Регрессионный контур

`tests/ui/hospitality-read-only.spec.ts` подготовлен до патча как RED-контракт для шахматки, прямых маршрутов брони и места, фонда, Bar и Channels. Полный runtime-прогон оставлен лидеру по договорённости о единственном владельце runtime и общих ресурсов.
