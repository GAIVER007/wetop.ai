# Telegram Bot API — канал продавца

Сверено 01.10.2026: https://core.telegram.org/bots/api
Разделы: getMe, setWebhook, getWebhookInfo, deleteWebhook, sendMessage, Update.

- getMe проверяет токен и возвращает сведения о боте.
- setWebhook задаёт HTTPS callback. При неуспешном HTTP-ответе Telegram повторяет доставку.
- secret_token приходит в X-Telegram-Bot-Api-Secret-Token; допустимы A-Z, a-z, 0-9, _ и -, длина 1–256.
- allowed_updates ограничивает новые события, но старые события всё ещё могут прийти.
- getWebhookInfo показывает callback, очередь и последнюю ошибку доставки.
- getUpdates и webhook одновременно не работают.
- deleteWebhook может сохранять ожидающие события; drop_pending_updates не включаем автоматически.
- Ответ Bot API требует проверки ok, а не только HTTP-кода.

Наш контракт: getMe/check не меняет callback. Чужой callback — конфликт, не молчаливый перехват.
Токены и полные URL Bot API не журналируются. Сохранённое подключение не означает успешный ответ.
Требуются наблюдаемые получение сообщения и подтверждённая отправка; модель/права описаны
в plans/telegram-seller-connection-2026-10-01.md и предложении DATA_MODEL.md.
