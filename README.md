# WETOP.AI

**WETOP.AI** — multi-tenant B2B-платформа для управления сервисным бизнесом.

Платформа объединяет ежедневные операции, клиентов, расписание, продажи, финансы,
аналитику, автоматизацию и интеграции в одном рабочем пространстве. Одна компания
может управлять несколькими бизнесами и филиалами разных отраслей.

Первый рабочий vertical — **Hospitality**. Следующий vertical — **Beauty**: его модель
утверждена, но реализация ещё не начата.

```text
WETOP Platform
└── Partner / Organization
    └── Business
        └── Location
            └── Vertical Domain
```

Сайт продукта: [wetop.ai](https://wetop.ai)

## Product vision

WETOP превращает разрозненные инструменты сервисного бизнеса в одну платформу:
сотрудник работает с конкретным филиалом, управляющий видит бизнес целиком,
владелец — всю компанию, а Platform Admin управляет партнёрами и общими сервисами.

Принципы платформы:

- tenant — `Organization`, внутри которого могут жить разные бизнесы;
- vertical определяется на уровне `Business`;
- ежедневная работа выполняется на уровне `Location`;
- Hospitality и Beauty используют общий Platform Core, но остаются независимыми
  bounded contexts;
- PostgreSQL — источник правды, деньги хранятся в integer minor units, даты
  проживания отделены от UTC timestamps;
- внешние события идемпотентны и имеют состояние обработки, ошибки, повторы и аудит;
- возможность не считается готовой без проверяемого доказательства.

Утверждённая модель описана в [ARCHITECTURE.md](ARCHITECTURE.md).

## Platform architecture

| Уровень | Назначение |
|---|---|
| **WETOP Platform** | Партнёры, доступ, расширения, поддержка и platform administration |
| **Partner / Organization** | Компания-клиент и tenant: пользователи, бизнесы и расширения |
| **Business** | Направление или бренд; хранит `vertical = HOSPITALITY | BEAUTY` |
| **Location** | Конкретный филиал или физический объект |
| **Vertical Domain** | Отраслевая операционная модель |

Platform P1 уже реализует цепочку:

```text
Organization → Business → Location → Property
```

`Property` остаётся Hospitality-специфичной сущностью. Существующие брони,
размещения, тарифы, платежи и channel mappings не переименовываются и не переносятся.
Следующий этап — контекст запроса со scope
`ORGANIZATION | BUSINESS | LOCATION`; он утверждён, но ещё не завершён.

## Verticals

### Hospitality

Hospitality — первый рабочий vertical и основной реализованный продуктовый контур.

**Operations**

- Today — операционный центр смены;
- шахматка, бронирования, группы и гости;
- заселение, выселение, продление и переселение;
- housekeeping, блокировки, неисправности и журнал действий.

**Inventory**

- объекты размещения, категории и физические комнаты;
- номера и койко-места как `InventoryUnit`;
- доступность, назначения (`Allocation`) и защита от пересечений;
- управление фондом и статусами уборки.

**Sales**

- тарифные планы, цены и ограничения продаж;
- Channel Manager через адаптер Channex;
- OTA-брони, сайт и виджет бронирования;
- AI seller для сайта и WhatsApp.

**Finance and analytics**

- folio, начисления, услуги, оплаты, возвраты и долги;
- occupancy, revenue, sold nights, бронирования, отмены, источники и категории;
- аналитика сайта без хранения лишних персональных данных;
- decimal-safe расчёты без JavaScript `float` для денег.

### Beauty

Beauty — следующий vertical. Его целевая модель утверждена в
[DATA_MODEL.md](DATA_MODEL.md) и [ARCHITECTURE.md](ARCHITECTURE.md), но код домена и
пользовательские сценарии ещё не реализованы.

Целевая модель включает:

- `Customer` и связь клиента с Business;
- `Employee`, `EmployeeLocation` и `EmployeeService`;
- `BeautyService` и `LocationService`;
- `WorkingHours`, `TimeOff`, `Appointment` и расписание.

Beauty не переиспользует гостиничные `Reservation`, `InventoryUnit` или
`Property`. Общими остаются Platform Core, tenant isolation, доступ, аудит,
расширения и инфраструктура.

## Platform administration

В репозитории уже есть отдельный platform layer:

- `platform_admins` и защищённый раздел «Платформа»;
- организации-партнёры, состояния и роли;
- расширения, включая entitlement `AI_SELLER`;
- управление ИИ-продавцом;
- техническая поддержка и аудит административных действий.

Полная целевая зона Platform Admin — партнёры, планы, подписки, platform billing,
расширения, поддержка, system health и журнал платформы. Не все блоки реализованы;
фактический статус фиксируется в [CLAUDE.md](CLAUDE.md) и отчётах.

## Multi-tenancy and security

Tenant WETOP — `Organization`. `Business` и `Location` — уровни владения внутри
tenant, а не отдельные арендаторы.

Контур безопасности включает:

- контекст пользователя и организации;
- роли `OWNER`, `MANAGER`, `STAFF` и отдельный Platform Admin;
- tenant columns и проверки видимости;
- PostgreSQL RLS, роли `wetop_app` / `wetop_service` и tenant policies;
- audit log для критичных действий;
- закрытую регистрацию до прохождения RLS-gate для внешних партнёров;
- секреты только в environment / secret storage;
- минимизацию ПД, backup и rollback procedures.

RLS-схема и политики реализованы; включение прикладной роли на production выполняется
по отдельному проверяемому runbook. Подробности:
[SECURITY.md](SECURITY.md) и [docs/ops/rls.md](docs/ops/rls.md).

## Integrations

Интеграции изолированы от доменной логики адаптерами в `packages/integrations`.

| Интеграция | Назначение | Статус |
|---|---|---|
| **Channex** | OTA-брони, изменения, отмены и ARI | Рабочий Hospitality-контур; cutover управляется отдельными гейтами |
| **Exely** | Исторический импорт и сверки | Не является текущим источником правды |
| **Email** | Подтверждение почты и системные письма | Реализовано |
| **Telegram** | Операционные уведомления и сторож | Реализовано |
| **WhatsApp** | Канал AI seller | Поддержан сервисом и включается для организации |
| **eQonaq** | Уведомления о гостях | Отложено; порт не равен production-интеграции |
| **Fiscal provider** | Фискальные чеки | Не выбран и не реализован; исключён из текущего MVP |

Vendor API используются только по документации в `docs/`; production API остаются
read-only до соответствующего cutover approval.

## AI

`apps/ai-seller` — отдельный Python/FastAPI-сервис в двух ролях:

- **Seller** отвечает гостям в чате сайта и WhatsApp через узкий API наличия и цены;
- **Support** помогает пользователям платформы и получает только разрешённый
  технический контекст.

Сервис не входит в образ стойки и не читает базу напрямую. Связь идёт через
ограниченные API и service keys; организация передаётся явно. Подробнее:
[apps/README.md](apps/README.md) и
[docs/assistant/README.md](docs/assistant/README.md).

## Finance and analytics

Hospitality finance построен вокруг `Folio`, `Charge`, `Payment`,
`PaymentAllocation` и `Refund`. Деньги хранятся в minor units и защищены
доменными инвариантами и ограничениями базы.

Операционная аналитика использует бронирования, загрузку, продажи, категории, каналы
и сайт. Консолидированная модель Location → Business → Organization, расходы,
прибыль и валютная консолидация входят в целевую архитектуру, но пока не выдаются
за завершённый модуль.

## Technology stack

- **Frontend:** Next.js 16, React 19, TypeScript;
- **Backend:** NestJS 12, TypeScript, modular monolith;
- **AI service:** Python, FastAPI;
- **Database:** PostgreSQL, Prisma, SQL migrations with rollback;
- **Testing:** Vitest, Playwright, Supertest, axe-core;
- **Infrastructure:** Docker Compose, Cloudflare Tunnel, Cloudflare Pages;
- **Monorepo:** npm workspaces, Node.js 24 via `.nvmrc`.

## Repository structure

```text
apps/
  web/              Hospitality workspace и Platform Admin
  api/              API платформы, вертикали и интеграционных дверей
  site/             публичный сайт wetop.ai
  ai-seller/        AI seller и support agent
packages/
  domain/           бизнес-правила без HTTP и vendor SDK
  database/         Prisma schema, миграции, RLS и PostgreSQL
  integrations/     внешние адаптеры
  shared/           общие типы, money, даты и ошибки
scripts/
  imports/          импорт и исторические сверки
  reconciliation/   контрольные отчёты
  ops/              backup, deploy, guard и обслуживание
  preview/          локальные preview и demo-контуры
tests/               unit, integration, e2e, UI и журнал доказательств
deploy/              Docker Compose production-контура
design/              токены и источники дизайн-системы
docs/                runbooks и vendor-документация
plans/               утверждённые планы
reports/             результаты проверок и приёмки
```

Карты приложений и пакетов: [apps/README.md](apps/README.md) и
[packages/README.md](packages/README.md).

## Local development

Требования: Node.js 24, npm и локальный PostgreSQL для integration/e2e. Секреты
заполняются владельцем по `.env.example`; проверки не печатают их значения.

```bash
scripts/ops/repo-sync.sh
npm install
npx tsx scripts/imports/src/cli-check-env.ts

npm run db:local
npm run dev -w apps/api
npm run dev -w apps/web
```

Адреса: web — `127.0.0.1:3000`, API — `127.0.0.1:3001`, публичный сайт —
`127.0.0.1:3002` (`npm run dev -w apps/site`).

Безопасный UI-preview на вымышленных данных:

```bash
npm run dev:demo
```

Demo mode запрещён в production. См. [ONBOARDING.md](ONBOARDING.md).

## Testing philosophy

Проект следует правилу **red → green**: bugfix или business rule сначала фиксируется
падающим тестом, затем исправляется и подтверждается зелёным прогоном.

Проверки включают typecheck, lint, unit, integration, database e2e, UI regression,
browser acceptance, accessibility и reconciliation reports.

```bash
npm run test:status
npm run test:record -- typecheck
npm run test:record -- lint
npm run test:record -- unit
npm run test:record -- integration
npm run test:record -- e2e
```

Актуальные результаты находятся в `tests/runs/` и `reports/`, правила — в
[TESTING.md](TESTING.md). README намеренно не фиксирует количество тестов или SHA.

## Deployment

Production использует Docker Compose, PostgreSQL с контролируемыми миграциями,
Cloudflare Tunnel, Cloudflare Pages, health checks, backup и rollback.

Миграции применяются только с backup, validation и rollback procedure. Push или
успешная сборка сами по себе не считаются deployment. Runbooks:
[docs/deploy.md](docs/deploy.md) и [docs/ops/backups.md](docs/ops/backups.md).

## Current status

- **работает:** Hospitality, Platform P1
  (`Organization → Business → Location → Property`), учётные записи и роли,
  Platform Admin foundation, AI seller/support, integration и deployment;
- **реализовано, но включается отдельным gate:** production RLS application role и
  внешний self-service tenant onboarding;
- **утверждено, но не завершено:** RequestActor/scope, полноценный multi-business /
  multi-location switcher, управленческая аналитика;
- **целевая модель:** Beauty;
- **не заявляется готовым:** cutover каналов или новый внешний партнёр без гейтов.

Оперативный статус — [CLAUDE.md](CLAUDE.md) §2, история —
[docs/history.md](docs/history.md), доказательства — `tests/runs/` и `reports/`.

## First production pilot — Luxx Aparts

Первый реальный Hospitality-объект — **Luxx Aparts, Алматы**.

- 16 отдельных номеров;
- 72 койко-места;
- 88 sale units;
- до 92 гостей.

В модели это один Partner / Organization, один Business с
`vertical = HOSPITALITY`, одна Location и существующий Property. Luxx — production
pilot: система должна выдержать операционный день без потери броней, а критичные
цифры — сходиться с контрольными источниками без расхождения.

См. [OBJECT.md](OBJECT.md), [FINDINGS.md](FINDINGS.md) и
[CUTOVER.md](CUTOVER.md).

## Roadmap

1. Завершить production-gates tenant isolation и RLS.
2. Развить platform context до Business / Location scope.
3. Добавить переключение бизнесов и филиалов.
4. Расширить Platform Admin, subscriptions и platform billing.
5. Реализовать Beauty отдельными проверяемыми фазами.
6. Развивать управленческие финансы и агрегированную аналитику.

Изменения данных, денег, бронирований, availability или production-интеграций
проходят через `DATA_MODEL.md`, `DECISIONS.md` и при необходимости
`QUESTIONS.md`.

## Documentation map

| Документ | Назначение |
|---|---|
| [AGENTS.md](AGENTS.md) | Обязательные правила работы |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Архитектура платформы |
| [SPEC.md](SPEC.md) | Scope и DoD Hospitality MVP |
| [DATA_MODEL.md](DATA_MODEL.md) | Контролируемая модель данных |
| [DECISIONS.md](DECISIONS.md) | Архитектурные решения |
| [QUESTIONS.md](QUESTIONS.md) | Открытые развилки |
| [SECURITY.md](SECURITY.md) | Доступ, tenant isolation и секреты |
| [DESIGN.md](DESIGN.md) | Дизайн-система |
| [TESTING.md](TESTING.md) | Модель доказательств |
| [CLAUDE.md](CLAUDE.md) | Оперативный статус |
| [ONBOARDING.md](ONBOARDING.md) | Локальный запуск |
| [HANDOFF.md](HANDOFF.md) | Передача проекта |
| [GLOSSARY.md](GLOSSARY.md) | Термины |
| [docs/deploy.md](docs/deploy.md) | Deployment и rollback |
| [docs/README.md](docs/README.md) | Карта документации |

README описывает продукт и устойчивые границы. Ежедневные результаты, SHA, временные
CI-проблемы и состояние PR хранятся в журналах, планах и отчётах.
