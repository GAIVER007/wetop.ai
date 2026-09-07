# PMS MVP

Собственная PMS для действующего объекта размещения (88 номеров/единиц инвентаря)
в Казахстане. Цель — заменить Exely на реальном объекте и прожить в новой системе
полный операционный день без возврата в старую PMS.

## Статус

**Неделя 1 — сбор данных. Production feature code = 0 строк.**

Разработка бронирований, шахматки и тарифов не начинается до утверждения
[DATA_MODEL.md](DATA_MODEL.md) на реальных выгрузках объекта.

## Навигация

| Файл | Что внутри |
|---|---|
| [AGENTS.md](AGENTS.md) | Правила для AI-агентов. Читать первым. |
| [SPEC.md](SPEC.md) | Что строим и что НЕ строим |
| [DATA_MODEL.md](DATA_MODEL.md) | Модель данных (DRAFT, не утверждена) |
| [DECISIONS.md](DECISIONS.md) | ADR — принятые архитектурные решения |
| [QUESTIONS.md](QUESTIONS.md) | Открытые вопросы. Агент не имеет права гадать. |
| [GLOSSARY.md](GLOSSARY.md) | Термины |
| [PLAN.md](PLAN.md) | План на 8 недель + гейты |
| [CUTOVER.md](CUTOVER.md) | Переезд с Exely на Channex по каналам |
| [SECURITY.md](SECURITY.md) | Персональные данные, секреты, доступы |
| [ONBOARDING.md](ONBOARDING.md) | Что делать прямо сейчас, по шагам |

## Директории

```
docs/                vendor-документация (Channex, eQonaq, fiscal, Exely)
project-input/       реальные данные объекта (выгрузки, скриншоты, формы, интервью)
templates/           шаблоны выгрузок и опросников
outbox/              письма провайдерам (Exely, Channex, eQonaq)
apps/web             Next.js frontend        (пусто до Gate 0)
apps/api             NestJS backend          (пусто до Gate 0)
packages/database    Prisma schema/миграции  (пусто до утверждения DATA_MODEL)
packages/domain      бизнес-логика
packages/integrations адаптеры Channex/eQonaq/fiscal
packages/shared      общие типы и утилиты
tests/               unit / integration / e2e
scripts/imports      импорт выгрузок Exely
scripts/reconciliation сверка новой PMS с Exely
```

## Definition of Done всего MVP

См. хвост [SPEC.md](SPEC.md). Коротко: сотрудник отрабатывает смену, ни разу не открыв Exely,
и все цифры сходятся с Exely с расхождением **0**.
