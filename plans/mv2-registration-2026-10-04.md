# MV2 registration, 04.10.2026

Разрешение: владелец принял MV1 и разрешил MV2 после merge PR #238. Merge SHA d91c207a. Production migration 20261004000051 не применяется этой сессией. MV2 выполняется в отдельном clone и локальной БД.

## Contract and sequence

1. POST /auth/register: добавить vertical и businessName. Старый hotelName без vertical остаётся Hospitality совместимостью. Новый businessName требует explicit valid vertical; unknown/null/empty/tampered vertical отвергается. Противоречивые businessName/hotelName отвергаются. Нейтральное название первого бизнеса также задаёт имя новой Organization, существующее правило регистрации сохраняется.
2. HOSPITALITY AVAILABLE, BEAUTY/FOOD_SERVICE PILOT. Общий registrationOpen gate остаётся. Pilot authorization только серверное, query/body не открывают доступ. Способ доступа утверждён владельцем: отдельный серверный email allowlist каждой pilot vertical; по умолчанию списки пусты.
3. Одна транзакция: Organization trial, первый Business с canonical vertical, первый Location, User, OWNER Membership. Hospitality сохраняет createPropertyInChain. Beauty/Food без Property и domain tables. Ошибка/дубликат откатывает цепочку.
4. Email verification/resend работают с уже сохранённой цепочкой. Новый клиент передаёт explicit vertical. После проверки server-resolved scope нового Business/Location нужен без Hospitality no-scope fallback; для pilot показывается честное закрытое состояние, без domain onboarding.
5. Selector на сайте, safe query preselection и website deep links; форма и резервный /register сохраняют выбор. AVAILABLE/PILOT подписи и честное подключение по заявке.
6. Tests: red before green для whitelist, release gate и chain persistence; invalid/tampered/query, duplicate/concurrent submit, transaction rollback, resend/confirm/reload. UI desktop/mobile, keyboard/axe, screenshots. Report, commit/push PR, STOP.

## Exclusions

Нет Beauty Calendar, Beauty/Food tables, Floor Plan, новых analytics, vertical Today или MV3 domain onboarding. Existing trial/email lifecycle не меняется. Legacy no-scope допускается только для прежних Hospitality запросов.

Pilot decision: владелец выбрал серверный список разрешённых email отдельно для каждой vertical. Конфигурация REGISTRATION_BEAUTY_PILOT_EMAILS / REGISTRATION_FOOD_SERVICE_PILOT_EMAILS, comma-separated normalized exact emails. Пустое/отсутствующее значение закрывает signup. Клиент не получает список, query/body не меняют gate. Общий REGISTRATION_OPEN имеет приоритет. На сайте pilot submit доступен только с честным уведомлением о предварительном приглашении; API решает доступ.
