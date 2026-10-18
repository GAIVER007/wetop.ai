# Исправление сохранения графика салона

## Результат
Воспроизведён и исправлен настоящий отказ записи часов после изменения профиля сотрудника в той же карточке. Это не правка текста онбординга.

## Причина
Недельный график и профиль используют общую версию источника `employees.updated_at`. `Tabs` оставляет скрытые панели смонтированными. После сохранения профиля `savedProfile` обновлял имя/контакты, но оставлял ранее загруженный `schedule` и исходную версию `WeekForm`. Следующий PUT часов отправлял уже устаревшую версию и получал 409. UI оставлял введённые часы, но БД их не сохраняла.

## Минимальная правка
`apps/web/src/app/beauty/masters/board.tsx`, ветка сохранения существующего профиля:
- увеличить `generation`, чтобы ранее запущенный запрос графика не перезаписал новый snapshot;
- снять прежний `schedule`, тем самым убрать устаревший редактор;
- вызвать существующий `refreshSchedule`, который проверяет текущего сотрудника и generation.

Редактор получает свежую пару week+revision целиком, а не свежий token поверх прежнего draft. Переход между вкладками при несохранённом draft по-прежнему защищает `EmployeeTransitionGuard`.

Не менялись API, domain, ORM, схема, миграции, роли, права и финансовые правила. Shared working-time и защита от внешних конфликтов сохранены.

## RED → GREEN
- RED: `tests/runs/logs/2026-10-18T11-36-59Z-e2e-d2c4.log`, desktop и mobile touch 2/2 упали после profile→week save; в DOM зафиксирован отказ «Данные изменены в другом окне».
- GREEN: `tests/runs/logs/2026-10-18T11-42-02Z-e2e-7fb2.log`, тот же сценарий 2/2 прошёл после исправления.
- Расширенный GREEN: `tests/runs/logs/2026-10-18T11-43-27Z-e2e-24ca.log`, 2/2: сохранение, reload/read-back недели и onboarding, изменение профиля, повторное сохранение недели, сохранность введённых часов при «Остаться», настоящий внешний writer, 409 и запрет затирания его недели.
- Отдельный real-auth/RLS сценарий: registration, email verification, trial owner, проверка `wetop_app` без superuser/bypassRLS/owned tables, onboarding 3/4→4/4, повторное изменение, stale409 и STAFF403. До исправления базовый прямой путь был зелёным; это не считалось доказательством отсутствия найденного позже дефекта карточки.

## Финальная проверка
Все нижеуказанные проверки выполнены на исправленном коде, без изменения исходников во время прогонов:
- desktop + mobile touch, включая profile→week, draft guard и настоящий внешний конфликт: 2/2, `tests/runs/logs/2026-10-18T11-51-27Z-e2e-8836.log` (проектный Playwright1.63.0);
- настоящая auth/RLS/trial/onboarding/stale409/STAFF403: 1/1, `tests/runs/logs/2026-10-18T11-53-12Z-e2e-f238.log`;
- профильные unit: 18/18, `tests/runs/logs/2026-10-18T11-53-08Z-unit-8066.log`;
- полный typecheck (корень + API + web): без ошибок, `tests/runs/logs/2026-10-18T11-53-38Z-typecheck-7a2f.log`;
- полный lint: без ошибок, `tests/runs/logs/2026-10-18T11-54-53Z-lint-9366.log`;
- `git diff --check`: exit0.

Прежние неудачные environment-прогоны сохранены. Исправлены только локальные ссылки зависимостей: scoped @types, Playwright/axe, Vitest/Vite и единый React/renderer. Donor не изменялся; source-код и тесты не ослаблялись для обхода окружения. Дубликат статуса в потоковом DOM real-auth теста ограничен существующей видимой region «Первые шаги», без `.first()`, skip и увеличения таймаутов.

Синтетические скрины подтверждения сохранения: `reports/schedule-save-fix-2026-10-18/schedule-fix-desktop.png` и `schedule-fix-mobile.png`. Значения часов после reload отдельно проверяются через API/БД в тесте. Собственный PostgreSQL штатно остановлен, pgdata сохранена.

## Независимая проверка
Read-only reviewer проверил callers, Profile.save, guard, скрытые панели, revision и scope/generation. Блокирующих дефектов в минимальной правке не обнаружено; динамические проверки выполнялись отдельно, review не выдаётся за тест.

## Безопасность и передача
- Worktree: `/opt/data/workspace/wetop-all-release-20261017`.
- Ветка: `fix/salon-schedule-persistence-20261018`, база `228ecdf7fa8ca5e94fd048cdd4e7ca2435a8dd77`.
- Прежняя ветка `fix/premium-viewport-sweeps-20261017` сохранена.
- Прежний dirty screenshot сохранён, SHA256 `43df9a60d58e70d1ec881bb87aaf7aa1af99f8fedacb4db23d04c4d413c23153`; прежние untracked logs не удалялись.
- Только собственный PostgreSQL16: порт55973, pgdata в `wetop-browser-readonly-check/schedule-fix-pgdata`; существующие binaries, синтетические данные.
- Production auth-файлы и credentials не открывались, production writes/save не выполнялись.
- CI, push, merge и deploy не выполнялись. Исправление проверено локально; этот отчёт не заявляет обновление сайта.
- Дерево KEEP: неопубликованное исправление, dirty screenshot, untracked evidence, свежие файлы. Очистка/удаление не разрешались.
