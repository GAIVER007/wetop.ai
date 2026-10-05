# Приёмка U01–U12, 05.10.2026

Результат: 11 PASS, 1 FAIL (U07) в описанном изолированном контуре. Это не полная приёмка production и не разрешение на выпуск исправления. Дефект приложения не исправлялся.

Проверяемый SHA: `a5c5050c8c835ae4e2d43e73092355176f5a53f2`. [Успешный CI именно этого SHA](https://github.com/GAIVER007/wetop.ai/actions/runs/37267233807), исторический release-checks, не новый CI этих ручных сценариев. Новые main/BAR/MV5 и мобильная ветка не включались.

## Среда и достоверность

Git archive точного SHA, 1579 отслеживаемых файлов приложения сверены с Git, differences=[]: [source-version.json](evidence/source-version.json). Next dev сгенерировал next-env.d.ts, декларация восстановлена; runtime приложения не менялся. PostgreSQL 17.6, только localhost:55932. API localhost:55804, web localhost:55803. Данные только синтетические, production-копия и production-секреты не использованы. [Версия БД и обезличенный аудит](evidence/final-audit.json), [исходный набор](evidence/baseline.json), [итоговые IDs и состояния](evidence/final-snapshot.json).

Браузер: Codex In-app Browser, действия обычными формами и кнопками. API: настоящий SharedOnboardingService, OnboardingService, HotelService, AuthService, Prisma/PostgreSQL, resolveScope и RLS. Тестовый HTTP adapter расширен для управления только синтетическим контекстом, ролями и fault injection; [исходник адаптера](evidence/fixture-api.qa.ts). Для U03/U10/U11/U12 дополнительно использованы реальные login/session/Membership, а не только подставленный actor.

Граница: это service-level HTTP fixture, не весь production Nest API. Полный SessionGuard/RoleGuard bootstrap, регистрационная почта/MV2, все PMS endpoints и боевые интеграции здесь не проверены. Today показывал недоступные fixture endpoints; это ограничение адаптера, не зарегистрированный дефект PMS. NEXT/APP окружение минимальное, APP_AUTH_REQUIRED не включался; проверяемый /register/setup сам требует signedInUser. Public login root направлен на localhost, поэтому внешняя ссылка входа после ошибочного redirect закончилась на Today. Отказ самого мастера и промежуточный login URL зафиксированы отдельно.

Почта, OTA, eQonaq, платежи и другие dispatchers не запускались, соответствующие ключи/провайдеры отсутствовали. Внешняя ссылка completion не нажималась. Это отключение интеграций на уровне состава стенда, не заявление о системном сетевом sandbox.

## AS IS и критерии

В этом SHA /register/setup проверяет вход и verified Business/Location. Shared flow сохраняет явно по Save и переходам, помечает несохранённое; autosave каждого символа не обещает. Для настроенного Hospitality needed=false ведёт на Today. Сервер проверяет settings permission и canWrite, не принимает locationId из body, блокирует повтор через row lock/updatedAt и completedAt. Эти критерии взяты из page.tsx, shell.tsx, onboarding.module.ts и планов MV2/MV3 данного SHA.

Синтетические контексты: A и A2 принадлежат одной организации, разным Business/Location; B принадлежит другой организации и отдельному пользователю; H создан для Hospitality. Тестовые гостевые брони/счета/уборка не менялись, поэтому обнуление балансов не требовалось.

## Матрица

| ID | Проверка | Ожидаемый результат | Фактический результат | Статус | Доказательство |
| --- | --- | --- | --- | --- | --- |
| U01 | Первый запуск | Новый verified Beauty-контекст открывает business, version 1. GET не создаёт повторную цепочку. | Браузер открыл правильный шаг. Counts и progress до/после GET совпали; ни одного черновика до Save. | **PASS** | [Браузер](evidence/U01.png), [readback/API](evidence/U01-after.json) |
| U02 | Save и reload | Явный Save сохраняет draft, version и step; reload восстанавливает. | QA-U02-saved восстановлен после reload, flowVersion=1, currentStep=business, одна строка progress. | **PASS** | [Браузер](evidence/U02-reload.png), [readback/API](evidence/U02-db.json) |
| U03 | Закрытие и повторный вход | Повторное открытие и logout/login не сбрасывают сохранённое. | Черновик восстановлен после закрытия вкладки; затем нормальный вход через AuthService, logout и повторный вход восстановили A2. Старая сессия revoked, новая active. | **PASS** | [Браузер](evidence/U03-after-relogin.png), [readback/API](evidence/U03-session-lifecycle.json) |
| U04 | Повтор после потери ответа | Commit с потерянным ответом и повтор не создают дубль. | Первый POST сохранён, ответ подменён на 503. Повтор со старым updatedAt дал 409. Reload восстановил QA-U04-lost-response; одна строка progress. | **PASS** | [Браузер](evidence/U04-reloaded.png), [readback/API](evidence/U04-retry.txt) |
| U05 | Close/back/forward/отложить | Явно сохранённое остаётся, несохранённое помечено. Переходы не создают фонд до запуска. | Несохранённое значение помечено и не стало серверным draft после reload. Back/Next сохранили шаг. Hospitality «Заполнить позже», browser Back/Forward вернули сохранённое QA-U09-room без provisioning. Отдельной Cancel-кнопки в этом контракте нет. | **PASS** | [Браузер](evidence/U05-browser-back.png), [readback/API](evidence/U05-unsaved-reload.txt) |
| U06 | Валидация | Невалидная timezone и пустое обязательное название блокируют переход и запись. | Invalid/Zone и пустой locationName дали конкретные ошибки; SQL сохранил прежний valid draft. Исправление позволило перейти на review. | **PASS** | [Браузер](evidence/U06-invalid-timezone.png), [readback/API](evidence/U06-db.json) |
| U07 | Разрыв сети | При временной недоступности API мастер показывает ошибку и позволяет повторить без потери ввода/дублей. | Частичный 503 до commit обрабатывается. Полная остановка QA API дважды вызвала уход /register/setup -> /?next=%2Ftoday#login -> /today. Несохранённое значение потеряно. Сохранённый draft и все строки БД не повреждены; после восстановления пришлось вручную вернуться и ввести заново. | **FAIL** | [Браузер](evidence/U07-reproduction-redirect.png), [readback/API](evidence/U07-network-after-db.json) |
| U08 | Однократное завершение | Complete атомарен; reload/relogin/replay не дублируют completion. | UI показал завершение и сохранил его после reload/relogin. Один completion audit, completedAt стабилен. Старый и актуальный updatedAt при повторном Complete получили 409. | **PASS** | [Браузер](evidence/U08-after-relogin.png), [readback/API](evidence/U08-fresh-replay.json) |
| U09 | Настроенный Hospitality | Повторное открытие мастера не сбрасывает существующие фонд/тарифы, настройки доступны. | Синтетический отель завершён с 2 номерами QA-U09-room и тарифом 18000 KZT. needed=false, мастер переводит на Today. Полные строки property/category/unit/rate до и после повторного открытия совпали. Навигация в настройки объекта работает. | **PASS** | [Браузер](evidence/U09-navigation-settings.png), [readback/API](evidence/U09-domain-after.json) |
| U10 | Read-only | Чтение разрешено, UI и POST запрещают запись. | Реальный OWNER Membership и активная сессия при READ_ONLY: GET canEdit=false, поля disabled, Save отсутствует, POST 403, draft неизменен. | **PASS** | [Браузер](evidence/U10-real-owner-readonly.png), [readback/API](evidence/U10-real-owner-api.json) |
| U11 | Роли | OWNER/MANAGER имеют settings write при ACTIVE; STAFF не имеет, сервер защищает независимо от UI. | Реальная Membership STAFF дала disabled UI и POST 403 без изменения. MANAGER сохранил QA-U11-real-manager, reload восстановил. OWNER проверен на Save/Complete. Менялись только синтетические роли. | **PASS** | [Браузер](evidence/U11-real-manager.png), [readback/API](evidence/U11-real-staff-api.json) |
| U12 | Изоляция | Два пользователя/организации и дополнительные филиалы не читают и не меняют чужой progress. | A2 и B показали свои drafts. Реальные сессии A/B: чужой scope GET/POST 403; чужой locationId в body 400; неправильная пара business/location 403. БД неизменна. RLS wetop_app с org A исключил B. | **PASS** | [Браузер](evidence/U12-real-B.png), [readback/API](evidence/U12-real-sessions-api.json) |

## Дополнительные доказательства

- U04: [потерянный ответ](evidence/U04-response-lost.txt), [конфликт повтора](evidence/U04-retry.txt), [восстановление](evidence/U04-reloaded.txt).
- U07: [состояние перед обрывом](evidence/U07-reproduction-before.txt), [уход на login](evidence/U07-reproduction-redirect.txt), [журнал маршрутов](evidence/U07-route-log.txt), [БД до](evidence/U07-network-before-db.json) и [после](evidence/U07-network-after-db.json), [ручное восстановление](evidence/U07-manual-retry-reloaded.txt).
- U09: [доменный baseline](evidence/U09-domain-before.json) и [сравнение после](evidence/U09-domain-after.json), [needed=false](evidence/U09-status.json).
- U12: [все подмены scope](evidence/U12-api.json), [RLS readback](evidence/U12-rls.json), [реальные сессии](evidence/U12-real-sessions-api.json).

## Дефект и следующий этап

[U07: воспроизведение, причина и минимальный план исправления](defect-U07.md). Нужен отдельный согласованный bugfix с RED/GREEN и проверкой отсутствия ослабления входа/прав. Этот отчёт не разрешает новый deploy. Production, release, рабочие роли и миграции не менялись.

## Очистка

Завершённая очистка зафиксирована в [cleanup.json](cleanup.json). Сохраняются только отчёт, синтетические readback, screenshots, DOM и адаптер. Пароли, session tokens и token hashes в пакет не включены. Очистка завершена 05.10.2026 в 12:50:07 UTC. API, web и PostgreSQL остановлены; три временных каталога и credential-файлы удалены. Повторно подтверждены отсутствие каталогов и слушателей портов 55803, 55804, 55932.
