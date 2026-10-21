# 140 Напоминания клиентам салона

Решение: `docs/decisions/2026-10-21-salon-reminders-loyalty.md`, §1. В production НЕ применено: миграция
останавливает автовыкладку, применяет владелец (или агент после «да» владельца).

Что добавляет:

- `client_notifications`: очередь сообщений клиенту по записи (напоминание, подтверждение, ссылка на отзыв).
  Натуральный ключ `(appointment_id, kind, due_at)`. Текста и контактов в строке нет. Состояния PENDING, SENT,
  MANUAL, FAILED, CANCELLED; попытки, пауза до следующей (`next_attempt_at`), последняя ошибка. Удалять строки
  нельзя (триггер), ключ строки не меняется.
- `beauty_reminder_settings`: настройки филиала (включено, за сколько часов, текст, имя шаблона WhatsApp, версия).
- RLS: ENABLE + FORCE. `wetop_app` читает строки своей организации; очередь пишется в транзакции записи, поэтому
  `wetop_app` может вставлять и менять состояние своих строк (без удаления). Настройки пишет только `wetop_service`.

## Применение

1. Свежая резервная копия базы с проверенным восстановлением (`pg_dump -Fc`), записать имя файла.
2. `/root/wetop-mig.sh status`, затем `/root/wetop-mig.sh deploy` (миграция в одной транзакции).
3. Проверка: `SELECT count(*) FROM client_notifications;` = 0; `\d client_notifications` показывает уникальный
   ключ `client_notifications_natural_key`; `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE
   relname IN ('client_notifications','beauty_reminder_settings');` даёт `t,t`.
4. Выкладка совместимого API (`wetop-auto-deploy --migrations-applied <sha>`). Воркер выключается переменной
   `CLIENT_REMINDERS_WORKER=off`.

## Откат

`down.sql` работает только пока обе таблицы пусты и отказывает иначе: историю отправок ради отката не удаляют.
Сначала выключить воркер (`CLIENT_REMINDERS_WORKER=off`) и вернуть прежний API. Если строки уже есть: выгрузить их
(`COPY client_notifications TO ...`) и решать совместимой правкой вперёд или восстановлением резервной копии в
согласованное окно.
