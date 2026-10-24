# Бот WETOP для уведомлений сотрудникам (STAFF-TG)

Что это: один бот Telegram на всю платформу. Сотрудник подключает его сам («Профиль → Уведомления → Подключить
Telegram») и получает в личный чат сообщение о каждой новой брони, записи, брони стола или заявке с сайта своего
филиала. План: `plans/staff-telegram-notifications-2026-10-20.md`, модель: `DATA_MODEL.md`, раздел STAFF-TG-20261020.

Пока бота нет, всё работает без него: экран пишет «Бот WETOP подключается администратором платформы», события
записываются в журнал уведомлений со статусом «пропущено» и после включения бота не досылаются (только новые).

Бот отдельный от будильника сторожа (`TELEGRAM_BOT_TOKEN`, `docs/telegram/README.md`): у будильника свои чаты дежурных,
а этот бот пишет сотрудникам клиентов.

## Порядок (главный администратор платформы, один раз, около 10 минут)

Нужно: Telegram на телефоне или компьютере и доступ к серверу (`/root/wetop`). Миграция
`20261024000154_staff_telegram_notifications` уже применена, и код с ней выложен.

### 1. Создать бота в BotFather

1. Откройте https://t.me/BotFather и нажмите «Запустить» (Start).
2. Отправьте `/newbot`.
3. Имя бота (видно сотрудникам): `WETOP Уведомления`.
4. Адрес бота (латиница, в конце `bot`), например `wetop_staff_bot`. Занят: попробуйте `wetop_notify_bot`.
5. BotFather пришлёт токен вида `123456789:AA...`. Это секрет: никому не пересылайте, в чат агенту не вставляйте.
6. Там же по желанию: `/setdescription` → «Брони и записи с сайта WETOP для сотрудников», `/setuserpic` → логотип.

### 2. Две строки в `/root/wetop/.env`

На сервере выполните (подставьте токен из шага 1 вместо `ВСТАВЬТЕ_ТОКЕН`; секрет вебхука создаётся сам):

```bash
cd /root/wetop && cp .env .env.bak-$(date +%F) && printf '\nTELEGRAM_STAFF_BOT_TOKEN=%s\nTELEGRAM_STAFF_WEBHOOK_SECRET=%s\n' 'ВСТАВЬТЕ_ТОКЕН' "$(openssl rand -hex 32)" >> .env && docker compose -f deploy/compose.yml up -d api
```

Команда делает копию `.env`, дописывает две строки и перезапускает только API. Стойка эти строки не получает
(`deploy/compose.yml`, команда службы `web` пропускает только свои переменные).

### 3. Открыть путь вебхука в туннеле

Туннель пропускает наружу только перечисленные пути API (`deploy/cloudflared.example.yml`, на сервере
`/root/wetop/deploy/cloudflared/wetop.yml`, в git не едет). На 20.10.2026 `POST https://api.wetop.ai/telegram/staff/webhook`
отвечает 404 на краю туннеля: правила ещё нет. Добавьте его рядом с правилом вебхука Channex, как это делалось для
`/sites-runtime`:

```bash
cd /root/wetop/deploy && cp cloudflared/wetop.yml cloudflared/wetop.yml.bak-$(date +%F) && python3 - <<'EOF'
p = 'cloudflared/wetop.yml'
s = open(p).read()
rule = "  - hostname: api.wetop.ai\n    path: ^/telegram/staff/webhook$\n    service: http://api:3001\n"
anchor = "    path: ^/channels/channex/webhook$\n    service: http://api:3001\n"
assert anchor in s and rule not in s
open(p, 'w').write(s.replace(anchor, anchor + rule, 1))
EOF
docker compose -f compose.yml restart cloudflared && sleep 5 && curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.wetop.ai/telegram/staff/webhook
```

Ответ `401` (нет секрета) значит, что путь открыт и API отвечает. `404` значит, что правило не встало: проверьте файл.

### 4. Одна команда регистрации вебхука

```bash
cd /root/wetop && set -a && . ./.env && set +a && curl -s "https://api.telegram.org/bot${TELEGRAM_STAFF_BOT_TOKEN}/setWebhook" -d url=https://api.wetop.ai/telegram/staff/webhook -d secret_token="${TELEGRAM_STAFF_WEBHOOK_SECRET}" -d 'allowed_updates=["message"]' -d drop_pending_updates=true; echo
```

Правильный ответ: `{"ok":true,"result":true,"description":"Webhook was set"}`. Токен в выводе не печатается.

### 5. Проверка

1. В WETOP: «Профиль → Уведомления». Сообщения «Бот WETOP подключается администратором платформы» больше нет,
   кнопка «Подключить Telegram» активна.
2. Нажмите её, затем «Открыть Telegram» и «Запустить». Бот ответит «Готово, сюда будут приходить брони с сайта.»
3. В WETOP нажмите «Я подключил»: статус «Подключено: @ваше_имя». Нажмите «Проверить»: в Telegram придёт проверочное
   сообщение.
4. Пробная бронь с сайта филиала: сообщение приходит в течение 10–20 секунд.

## Как это устроено

- Вебхук `POST /telegram/staff/webhook` пускает только запросы с заголовком `X-Telegram-Bot-Api-Secret-Token`, равным
  `TELEGRAM_STAFF_WEBHOOK_SECRET` (Bot API, `setWebhook` `secret_token`). Принимает `/start <код>` (привязка) и `/stop`
  (отключение) из личного чата, всё остальное игнорирует.
- Код привязки: 8 знаков, 15 минут, одноразовый, в базе только SHA-256.
- Уведомление ставится в очередь в той же транзакции, что и бронь (AGENTS.md §11). Отправщик в API раз в 10 секунд
  берёт строки, ещё раз проверяет права сотрудника на филиал и привязку, собирает текст из самой брони и отправляет.
- Ошибка Telegram: повтор через 1, 3, 7, 15, 30 минут (шесть попыток), затем «не отправлено» и неисправность
  `staff.notify.failed` в журнале платформы. Ответ 403 (сотрудник заблокировал бота) отключает его привязку.
- В очереди нет ни текста сообщения, ни имени и телефона гостя: только тип события и номер брони.

## Выключить или сменить бота

- Временно не слать: `STAFF_NOTIFY_WORKER=off` в `.env` и `docker compose -f deploy/compose.yml up -d api`. События
  копятся и уходят после включения (если старше часа, сотрудники получат их пачкой: учтите).
- Совсем отключить бота: удалить обе строки `TELEGRAM_STAFF_*` из `.env`, перезапустить API, затем
  `curl -s "https://api.telegram.org/bot<токен>/deleteWebhook"`.
- Токен утёк: в BotFather `/revoke` → выбрать бота, новый токен вписать вместо старого (шаг 2 без `openssl`-строки,
  правкой файла), перезапустить API и повторить шаг 4. Привязки сотрудников сохраняются: чат тот же.
