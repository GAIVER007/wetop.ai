# MV2 registration, 04.10.2026

MV1 принят и влит: PR #238, main merge d91c207a. Перед merge проверены head 70720016, mergeable, отсутствие comments/reviews и свежий main; чувствительный diff не изменился. MV2 отдельно разрешён владельцем с server-side allowlists отдельно для Beauty/Food. Clone и PostgreSQL localhost:55753 изолированы от чужого checkout/Supabase. Production migration не применена.

## Implemented contract

- Новая регистрация передаёт explicit canonical vertical + businessName. Старый hotelName-only остаётся Hospitality compatibility. Неизвестный/пустой/null/tampered vertical отвергается, несовпадающие имена тоже. Whitelisted query предвыбирает radio; доступ не предоставляет.
- Existing API environment gate REGISTRATION_OPEN сохранён. REGISTRATION_BEAUTY_PILOT_EMAILS / REGISTRATION_FOOD_SERVICE_PILOT_EMAILS выбраны по его naming и механизму; compose передаёт .env API через env_file. Списки не являются NEXT_PUBLIC и не доступны через /auth/options. Нет invitation model.
- Email нормализуется общей auth-функцией normalizeEmail/validEmail. Exact match только в списке соответствующей vertical. Пустой список закрывает пилот. Отказ до hash/Organization/Business/Location: «Направление пока доступно только участникам пилота».
- HOSPITALITY AVAILABLE, public signup в рамках существующего общего registrationOpen. BEAUTY/FOOD_SERVICE PILOT, только allowlisted email. Registry release availability не менялась.
- Атомарная транзакция создаёт Organization trial, первый Business с vertical, первый Location, User и OWNER Membership. Hospitality сохраняет Property adapter; Beauty/Food без Property/domain tables. Ошибка уникальности email откатывает проигравшую цепочку.
- Verification/resend не пересоздают бизнес. Новый authenticated /auth/registration-context разрешает Business/Location только из организации действительной сессии. Явный новый токен имеет приоритет над прежней cookie. После confirm сохраняется httpOnly scope из серверного ответа. Pilot completion не вызывает hotel shell/onboarding; при повторном login scope подтверждается серверным action. Hospitality destination сохраняется.
- Selector, safe vertical deep links, native fallback и /register redirect сохраняют выбранную vertical. Radio поддерживает keyboard; URL/reload сохраняют выбор. Pilot copy не обещает готовые рабочие инструменты.

## Evidence

Actual red assertions: invalid vertical и default closed pilot; allowlisted pilot chain; missing trusted context resolver; stale cookie session. Green backend, integration и UI evidence записаны в tests/runs и browser logs.

Real PostgreSQL integration: три vertical signup; property только Hospitality; resend/confirm/session/re-read сохраняют IDs и vertical; concurrent duplicate даёт одну цепочку; denied/global closed gate не оставляют orphan. Все данные вымышлены, cleanup marker scope, собственная localhost база.

Browser site suite: static site build, mocked auth transport, actual browser selector/denial/reload/keyboard/axe. Это проверка UI транспорта, не proof production mail delivery. Скриншоты desktop/mobile light/dark в screenshots. UI визуально проверен. Дополнительный Next dev + mocked auth adapter browser smoke проверяет pilot completion, explicit HttpOnly scope, server action, reload, desktop/mobile axe и отсутствие hotel/onboarding API calls (pilot-completion-browser-proof.txt). Доказательство DB persistence отдельно, через real PostgreSQL integration. Первый UI green attempt имел неверное имя label в тесте, исправлено на фактическое «Имя»; проверки не ослаблены.

## Remaining release work

Production handoff отдельно в production-handoff.md: backup, counts, enum/version, apply/verify, Hospitality smoke, rollback conditions. Production значения и backup не выдумываются. Migration 20261004000051 должен применить владелец по отдельному разрешению. Реальные allowlists не задавались, production self-service Beauty/Food не открыт.

Нет Calendar, новых Beauty/Food tables, Floor Plan, analytics, vertical Today или MV3 onboarding. Legacy Hospitality no-scope сохраняется только для обратной совместимости. После MV2 отчёта STOP.

## Final checks

- Full unit: 3312 passed, 4 existing skipped, 0 failed; final log 2026-10-04T13-21-39Z-unit-f94d.
- Full integration: 318 passed, 9 existing skipped, 0 failed; final log 2026-10-04T13-22-28Z-integration-2e3f. Повторено после свежих QA изменений main.
- Site-only browser: 53/53, keyboard/reload/axe/screenshots; 2026-10-04T13-19-30Z-e2e-efee. Это site config, не полный desk E2E.
- Typecheck: green, 2026-10-04T13-19-31Z-typecheck-24d1. Lint green: 2026-10-04T13-22-38Z-lint-c03d, последовательно после browser artifacts.
- Первый full unit поймал 4 ошибки новых contract fixtures: DESIGN catalog, route permissions table и отсутствующие mocks нового resolver у старых login tests. Fixtures дополнили, assertions не удалялись. Lint/typecheck исправлены без suppressions.
- Существующие 5-second shell timeouts на Mac обходятся тем же CLI budget, что в MV1: LC_ALL=C, maxWorkers=2, testTimeout=30000. Assertions и repository config сохранены.
- Base main 2d9adf66: sensitive diff перечитан, impact-main-2d9adf66.md. Обе ADR добавленные разными сессиями сохранены; нет конфликтов кода.
- После финального отчёта STOP. Production/release и реальные allowlists не изменялись.
