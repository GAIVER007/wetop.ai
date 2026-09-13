# Telegram Bot API — выжимка для будильника сторожа

**Источник:** https://core.telegram.org/bots/api (разделы «Making requests», `sendMessage`, `getUpdates`,
`ResponseParameters`). **Снято:** 13.09.2026. Пересказ своими словами — только то, на что опирается код
`packages/integrations/src/telegram/client.ts` (срез 11, ADR-028). Полный текст — по ссылке.

## Запрос

- Адрес: `https://api.telegram.org/bot<токен>/<метод>`; методы вызываются GET или POST.
- Тело POST — `application/json` (кроме загрузки файлов).
- Ответ всегда JSON: булево `ok`; при успехе — `result`; при ошибке — `description` (текст), `error_code`
  (число) и, возможно, `parameters`.
- `parameters.retry_after` — сколько секунд подождать до повтора (превышен лимит, HTTP 429).

## `sendMessage`

| Поле | Обязательно | Что это |
|---|---|---|
| `chat_id` | да | число или строка — куда отправить |
| `text` | да | текст, **1–4096 символов** после разбора разметки |
| `parse_mode` | нет | разметка; сторож её **не использует** — заголовки неисправностей не экранируются под Markdown/HTML |
| `disable_notification` | нет | без звука; сторож для срочных шлёт со звуком |
| `link_preview_options` | нет | превью ссылок |

## Как владелец узнаёт `chat_id`

`getUpdates` возвращает массив `Update`; в `Update.message.chat.id` — идентификатор чата. Порядок:
создать бота у @BotFather → написать боту любое сообщение со своего телефона → открыть в браузере
`https://api.telegram.org/bot<токен>/getUpdates` и взять `message.chat.id`.

Бот не может первым написать человеку, который его не запускал: поэтому шаг «написать боту» обязателен.
В документации это отдельной строкой не записано — поведение проверяется первым пробным сообщением
(`POST /guard/alert/test`).

## Что кладётся в `.env` (владелец, SECURITY.md §3)

```
TELEGRAM_BOT_TOKEN=   # от @BotFather
TELEGRAM_CHAT_ID=     # один или несколько через запятую
```
