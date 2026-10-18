# Салон: core persistence и регрессионные проверки

18.10.2026. Это завершённая локальная проверка core-среза, не завершение всех94 сценариев и не исправление опубликованного сайта. Production/deploy/push/CI/merge не выполнялись. Объём ограничен поручением SALON_CORE_WORKER.

## Результаты

- `2026-10-18T18-18-45Z-e2e-346a`: **1/1**, реальный AppModule, регистрация, подтверждение письма, session guard, `wetop_app`. `codeChangedDuringRun=false`.
- `2026-10-18T18-25-44Z-integration-3f18`: **20/20**, без skips, на собственной UTF8 PostgreSQL. Customer canonical/concurrency/history/tenant negatives, график12 сценариев и customers-create4 с RLS-ролью. Отпечаток стабилен.
- `2026-10-18T18-18-47Z-unit-d657`: **35/35**, четыре салонных regression-файла, ранее незагружавшийся файл customers/actions теперь выполняется.
- `2026-10-18T18-20-55Z-unit-1190`: полный unit **6190 passed / 3 failed / 7 skipped**, 722 файла:720passed/1failed/1skipped. Все три оставшихся падения совпадают с прежними `apps/web/src/app/bar/actions.test.ts`, исходники бара не менялись. Новых failures и skips нет; прежние7 skips сохранены. Полный unit gate остаётся красным, не выдаётся за release-допуск.
- `2026-10-18T18-26-08Z-typecheck-30a7`: root/API/web **без ошибок**, стабильный отпечаток. Исходные12 ошибок сняты реальным переходом теста на существующий API, не заглушкой.
- Финальный default-port strict UI `2026-10-18T18-29-21Z-e2e-4437`: **1/1**. Reviewer выявил ошибку default-порта; RED `2026-10-18T18-28-39Z-e2e-d11f` воспроизведён, config экспортирует единый API-порт workers/server.
- Финальные root/API/web types `2026-10-18T18-29-48Z-typecheck-5a4a` и lint `2026-10-18T18-30-53Z-lint-903b`: **без ошибок**, стабильные отпечатки.
- Повторный независимый read-only review `sa-0-21fda191`: passed=true, security_concerns=[], logic_errors=[], suggestions=[]. Полный verdict сохранён в core-source-review-final.json. Это не release-допуск.

## Рабочее время: фактический save/readback/reload

На текущей реализации исходная проблема в этом синтетическом сценарии НЕ воспроизвелась, поэтому новый production-фикс графика не придумывался.

`tests/onboarding-real/schedule-save-real.spec.ts` проверяет:

1. Регистрацию синтетического trial-owner и настоящий вход через письмо/session.
2. Runtime-роль `wetop_app`: superuser=false, bypassrls=false, owned objects=0.
3. Одного мастера, услугу и назначение; onboarding3/4 перед настройкой графика.
4. Сохранение понедельника09:00-18:00 из `/beauty/schedule`, API readback.
5. Onboarding4/4, сохранение состояния после reload, чтение часов из вновь открытой формы.
6. Изменение начала на10:00, повторный API readback10:00-18:00.
7. Устаревшую revision409 без потери сохранённой недели.
8. Demoted STAFF403 без изменения недели.

Дополнительный SQL после прогона подтвердил ровно один интервал синтетического мастера: weekday1,10:00:00-18:00:00; `wetop_app` false/false/0; чужая synthetic organization под RLS видит0 working_hours. Агрегаты: `core-db-proof.json`.

`schedule-save-desktop.png` и `schedule-save-mobile.png` сохранены здесь и визуально просмотрены. Mobile здесь только viewport-снимок той же формы, не отдельный touch-сценарий и не доказательство DB persistence.

Цепочка исходников просмотрена: `/beauty/schedule` передаёт исходную week revision в редактор; server action передаёт intervals/expectedRevision в API; shared employee source и Beauty writer проверяют revision, роли и scope; запись и source revision происходят в транзакции. Production auth/session-файлы не читались и не копировались.

## Customer contract

В `tests/integration/beauty-customers.test.ts` самостоятельное создание вызывает существующий `BeautyCatalogService.createCustomer`, CSV остаётся на `BeautyCustomerImportService.apply`. Старый удалённый `create` не восстанавливался.

Текущий canonical API документирован исходниками и `customers-create.test.ts`: конкурентный проигравший insert может получить409. Тест одновременно запускает оба бизнеса, требует ровно одного created и одной canonical identity; только явно проверенный ConflictException409 повторяет после commit победителя. После этого оба бизнеса обязаны ссылаться на один ID, links=2, created audit=1, linked audit=1. Ошибки других типов не поглощаются. Atomic CSV conflict, ограниченная история и foreign business/org negatives сохранены.

RED: `2026-10-18T18-15-00Z-integration-5a92` воспроизвёл удалённый метод; `2026-10-18T18-19-27Z-integration-5626` дал3/4 после перехода на реальный API и проявил актуальный concurrent409. GREEN20/20 включает исправленный контракт и независимый RLS-набор.

## Минимальные исправления baseline

- appointment-status fixture получил существующие employeeServicePrice/beautyLocationHours collections и lines. Timing/auth/tenant/concurrency assertions не удалялись.
- customers/actions unit получил server-only marker mock, как соседние XLSX/action тесты.
- finance period unit мокает фактический авторизованный financeDay, не старый day; сохранены проверки дат, ошибок, scope и ограничения параллелизма.
- journal labels получили queued/failed/undone. Покрывающий все API action literals сторож сохранён.
- schedule integration назначает мастеру услугу штатным catalog API: старый seed противоречил действующему appointment-line guard. Guard не ослаблялся; добавлен loopback-only предохранитель теста.

## Среда, сохранение и ограничения

Использовано прежнее дерево `/opt/data/workspace/wetop-all-release-20261017`, ветка `feat/salon-draft-implementation-20261018`, исходный handoff5b409d120. Другие деревья не создавались, reset/stash/cleanup не делались. Грязные .gitignore, premium screenshot и старые untracked сохранены.

Собственная БД: localhost55983, `salon_core_utf8_20261018`, схема pms_test. PGDATA: `/opt/data/workspace/wetop-browser-readonly-check/salon-implementation/core-db/data`. Ordinary136 и существующие held Beauty131-135 применены без изменения SQL исключительно сюда в порядке `docs/ops/beauty-zapis-release.md`, TEST_DATA=seed. Held не продвигались, новых моделей/финансовых правил нет. SQL_ASCII первая БД сохранена, не используется: нормализация телефона требовала UTF8. Логи local apply находятся в core-db.

API/web используют собственные26893/26894. Existing onboarding-real harness минимально параметризован по портам, mail regex остаётся loopback-only; новый `playwright.schedule.config.ts` не подменяет SessionGuard/identity. Working invocation: `PLAYWRIGHT_BROWSERS_PATH=/srv/hermes/workspace/wetop-salon-integration-evidence/browsers`, `NEXT_TEST_TURBOPACK_ROOT=/`, explicit local DATABASE_URL/DATABASE_APP_URL.

Все18 новых записей SALON-прогонов и их логи сохраняются вместе с изменениями. Неудачные startup/encoding/fixture попытки сохранены в журнале, не удалены и не пересчитаны в passes. Прерванный Beauty fixture UI не заменяет строгий зелёный onboarding-real сценарий. Исторический `core-worker-checkpoint.md` содержит промежуточный блокер пересечения sibling-контекстов; после инвентаризации текущих diffs и подтверждения пользователя18:21 продолжена работа одного writer. Во время записанных зелёных прогонов отпечатки стабильны. Независимый reviewer имеет только read-only полномочия.

GBrain code_callers/code_blast возвращали not_built/not_found для рассматриваемых символов. Вместо выдуманного graph proof использованы прямые исходники и tests.

После последнего UI-прогона проверены точный data_directory и0 других client backends; только собственный PostgreSQL PID3516410 штатно остановлен pg_ctl. PGDATA обеих синтетических БД и SQL apply evidence сохранены, ничего не удалялось. Порты55983/26893/26894 свободны.

Оставшиеся границы: полный unit красный по3 прежним bar-тестам; весь94-сценарный реестр не закрыт; production release held migrations требует отдельного разрешения по Q-SALON-ROLL-20261018; публикация не поручена этому worker. Tree ACTIVE / KEEP, parent review перед публикацией.
