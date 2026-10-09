# MV3: shared onboarding framework

## Итоговый срез

MV2 PR #239 принят владельцем и влит в main: `a4fac4b68acbc8f6d84e1c2350c5060a4832fa32`. Перед merge проверены base `a389af69`, head `4a420908`, mergeable и отсутствие reviews/comments. Production не выкатывался. Ограничение `registrationContext()` записано в ADR и handoff: helper только для завершения первой регистрации, не generic Business selector.

MV3 реализует общий registry и shell. `Business.vertical` остаётся единственным источником vertical. Серверное хранение OnboardingProgress отдельно и явно утверждено владельцем до Prisma/migration.

## Поведение

- Hospitality adapter использует существующую форму категорий, номеров/коек и тарифа. Новый scoped flow сохраняет черновик этой формы; создание фонда и тарифа остаётся прежней транзакцией. Completion progress обновляется вместе с реальным provisioning. Legacy no-scope Hospitality сохраняет прежний путь.
- Beauty и Food используют общие шаги: Business, Location, проверка. Названия, timezone/currency сохраняются в существующие shared сущности при завершении. Domain сущности не создаются, hotel API не вызывается.
- Прогресс и черновик сохраняются на сервере кнопкой «Сохранить» и переходами «Назад»/«Продолжить». UI явно отмечает несохранённые изменения. Reload восстанавливает последний сохранённый шаг. Это не обещание autosave каждого нажатия клавиши.
- Shared шаги обязательны; прежнее «Заполнить позже» остаётся у Hospitality. Завершение пилота честно сообщает о последующей активации domain модуля.
- Registry задаёт version/steps/completion и допускает настоящие adapters MV4/MV6. Обновление версии сохранённого flow потребует явной стратегии миграции, неизвестная версия не сбрасывает черновик автоматически.

## API и границы

`GET /onboarding` читает свой explicit verified Business/Location. `POST /onboarding` принимает только action/draft/updatedAt. Business, Location и vertical в body не принимаются. URL `?vertical=HOSPITALITY` не меняет серверный Beauty/Food flow. Старый `/hotel/onboarding` также отклоняет explicit Beauty/Food Business context до чтения/создания гостиницы; legacy no-scope Hospitality совместимость сохранена.

Проверяются цепочка организации, ACTIVE Business/Location, settings permission и право записи организации. STAFF не меняет настройки; READ_ONLY владелец может читать, но не сохранять. Изоляция tenant дополнительно обеспечена RLS через Location -> Business -> Organization. Таблица зарегистрирована в общем RLS-каталоге.

Location row lock и optimistic updatedAt предотвращают перезапись прогресса устаревшей вкладкой. Завершённый shared flow повторно не меняет данные. Изменение валюты/timezone операционного филиала блокируется при уже существующих рабочих данных. Shared completion атомарно обновляет Business/Location, progress и audit.

## Модель и миграция

`OnboardingProgress` (Location 0..1): locationId, flowVersion, currentStep, draft, completedAt, updatedAt. Нет дублирования vertical/organization. Migration `20261004000052_onboarding_progress` создаёт пустую таблицу, FK, CHECK и RLS. Нет backfill или новых Beauty/Food domain tables.

[Runbook](migration-runbook.md) и [локальный rehearsal](migration-rehearsal.txt): apply, отказ down при сохранённых данных, успешный down пустой таблицы. Production apply не разрешён. Migration 51 и реальные pilot allowlists остаются отдельным решением владельца.

## Доказательства

Все DB проверки используют отдельный localhost PostgreSQL и синтетические данные, общий Supabase не используется.

| Проверка | Результат | Лог |
|---|---|---|
| Full unit | 3326 passed, 4 existing skipped | `tests/runs/logs/2026-10-04T14-09-42Z-unit-df25.log` |
| Full integration | 324 passed, 9 existing skipped | `tests/runs/logs/2026-10-04T14-13-25Z-integration-0b9a.log` |
| MV3 browser | 4 passed | `tests/runs/logs/2026-10-04T14-05-27Z-e2e-bbb2.log` |
| Typecheck (root/API/web) | PASS | `tests/runs/logs/2026-10-04T14-09-55Z-typecheck-8fb2.log` |
| Lint | PASS | `tests/runs/logs/2026-10-04T14-09-55Z-lint-c580.log` |

Browser suite: реальный Next.js, server actions, SharedOnboardingService/OnboardingService и PostgreSQL. Authentication в стенде синтетический, поэтому этот набор не доказывает production login или доставку verification email. Регистрация/verification отдельно покрыты regression MV2; реальный email smoke остаётся production checklist.

Проверены Beauty/Food reload, back/next, завершение и wrong vertical URL; READ_ONLY UI; Hospitality draft/reload и фактическое создание фонда/тарифа. Для каждого пилота 1440/390, light/dark, keyboard, axe и отсутствие горизонтального overflow. Стенд удаляет только собственные маркированные записи после прогона.

### Скриншоты

| Flow | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---|---|---|
| Beauty | [PNG](screenshots/BEAUTY-1440-light.png) | [PNG](screenshots/BEAUTY-1440-dark.png) | [PNG](screenshots/BEAUTY-390-light.png) | [PNG](screenshots/BEAUTY-390-dark.png) |
| Food | [PNG](screenshots/FOOD_SERVICE-1440-light.png) | [PNG](screenshots/FOOD_SERVICE-1440-dark.png) | [PNG](screenshots/FOOD_SERVICE-390-light.png) | [PNG](screenshots/FOOD_SERVICE-390-dark.png) |

## Review и scope

Новые зависимости отсутствуют. RequestActor/scope resolver, channels boundaries, Business.vertical и release gates не меняются. Hospitality domain не обобщается. Промежуточный main `b72c06fe` изменил только два CSS правила существующего owner dashboard; включён rebase без конфликтов. Этот фикс не относится к MV3.

В red/green журнале сохранены исходные отказы registry/context и READ_ONLY organization. Найденные в ходе проверки проблемы RLS-каталога, уборки browser fixtures и отступов исправлены; пороги тестов и snapshot baseline не ослаблялись. Полный production release-checks и полный desk UI suite в этом срезе не заявляются.

Production не изменён. MV4, Calendar, новые Beauty/Food tables, Floor Plan, Today и analytics не начаты. После отчёта и PR: STOP, merge MV3 требует следующего решения владельца.

Повторный inventory integration однажды завершился `socket hang up`; отдельный повтор прошёл без изменения кода. Финальный полный integration выполнен без параллельной нагрузки. Старые skips не изменялись.
