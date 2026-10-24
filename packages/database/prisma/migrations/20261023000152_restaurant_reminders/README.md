# 152 Напоминания гостям ресторана о брони

Решение: `docs/decisions/2026-10-23-restaurant-reminders.md`, DATA_MODEL §61; «да» владельца 23.10.2026 («Да, делай по
этой схеме (миграция 152, 2 новые таблицы)»). В production НЕ применено: миграция останавливает автовыкладку,
применяет владелец.

Что добавляет:

- `restaurant_reservation_notifications`: очередь сообщений гостю по брони стола (напоминание, подтверждение брони
  с сайта). Натуральный ключ `(reservation_id, kind, due_at)`, текста и контактов в строке нет. Типы вида, канала и
  состояния из 140 (`ClientNotification*`), виды только REMINDER и CONFIRMATION. Удалять строки нельзя (нет DELETE у
  ролей приложения), ключ строки не меняется (триггер), бронь только ресторана своей организации.
- `food_reminder_settings`: настройки филиала ресторана (включено, за сколько часов, текст, шаблон WhatsApp, версия).
- RLS ENABLE + FORCE, права как у 140. Очередь и настройки салона (140) не меняются.

## Применение

1. Свежая резервная копия базы с проверенным восстановлением (`pg_dump -Fc`), записать имя файла.
2. Миграция по `docs/deploy.md` (`mig status`, затем `mig deploy`), одна транзакция.
3. Проверка: `SELECT count(*) FROM restaurant_reservation_notifications;` = 0; `SELECT relrowsecurity,
   relforcerowsecurity FROM pg_class WHERE relname IN ('restaurant_reservation_notifications','food_reminder_settings');`
   даёт `t,t`.
4. Выкладка совместимого API (`wetop-auto-deploy --migrations-applied <sha>`). Воркер общий с салоном и
   выключается той же переменной `CLIENT_REMINDERS_WORKER=off`.

## Откат

`down.sql` работает только пока обе таблицы пусты. Сначала выключить воркер и вернуть прежний API; если строки уже
есть, выгрузить их (`COPY ... TO`) и решать правкой вперёд.
