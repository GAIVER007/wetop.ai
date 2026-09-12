# PMS MVP

Собственная PMS для действующего объекта размещения (88 номеров/единиц инвентаря)
в Казахстане. Цель — заменить Exely на реальном объекте и прожить в новой системе
полный операционный день без возврата в старую PMS.

## Объект

**Luxx Aparts**, Алматы. Хостел: **88 единиц продажи = 16 отдельных номеров + 72 койко-места**,
максимум 92 гостя. Загрузка августа 2026 — 80,8% (2203 из 2728 единице-суток), 1044 заезда в месяц,
оборот проживания 15,7 млн ₸. Восемь OTA через Exely Channel Manager,
прямые продажи — 37,4% заездов.

Полная фактура: [OBJECT.md](OBJECT.md). Что из этого следует: [FINDINGS.md](FINDINGS.md).

## Статус на 12.09.2026

Срезы 1–7 (фонд, шахматка, тарифы и ручная бронь, Channex, стойка, финансы, печатные формы) сделаны
и доказаны сверками с Exely. Срез 8 «Аналитика сайта» (свой счётчик посещений, ADR-025) и срез 9 «Бронирование с сайта» (виджет, ADR-026)
сделаны 12.09.2026 — `reports/web-analytics-2026-09-12.md`, `reports/web-booking-2026-09-12.md`; на настоящий
сайт ставятся после постоянного адреса API (Q-112). Хронология по дням и что ждёт владельца — [CLAUDE.md](CLAUDE.md) §2,
что делать прямо сейчас — [ONBOARDING.md](ONBOARDING.md).

| Гейт | Состояние |
|---|---|
| 1 Inventory | ✅ 88/88 против живого Exely — `reports/inventory-2026-09-10.md` |
| 2 Chessboard | ✅ сутки сходятся в ноль на 08.09, 09.09, 10.09 — `reports/double-entry-*.md` |
| 3 Reservation | ✅ бронь со стойки меняет остаток — `tests/e2e/manual-reservation.spec.ts` |
| 4 Front Desk | ✅ полный день гостя — `tests/e2e/full-day.spec.ts`, `desk-tasks.spec.ts` |
| 5 Channex Sandbox | 🟡 обе стороны живьём, шесть каналов, webhook — `reports/channex-day-2026-09-11.md`; форма сертификации за владельцем |
| 6 Finance | ✅ 1449 из 1449 балансов до тиына — `reports/balances-2026-09-08.md` |
| 7 Kazakhstan | ❌ не начат: провайдер ККМ не выбран (Q-050), eQonaq отложен владельцем; в коде только порты |
| 8 Parallel Day | 🟡 механизм сошёлся, смена людьми назначена на 17.09 — `plans/parallel-day-2026-09-17.md` |
| 9–10 OTA | ❌ до сертификации Channex и базы в Казахстане — `CUTOVER.md`, условие допуска |

[DATA_MODEL.md](DATA_MODEL.md) v1.2 утверждён полностью (§6 Folio — 09.09.2026, ADR-014; §11 Аналитика сайта и бронирование с сайта — 12.09.2026, ADR-025, ADR-026).

## Запуск

```bash
npm install                                    # Node 24 (.nvmrc); ключи владелец вписывает в .env по .env.example
npx tsx scripts/imports/src/cli-check-env.ts   # секреты на месте; значения не печатает
npm run dev -w apps/api                        # API на 127.0.0.1:3001
npm run dev -w apps/web                        # стойка на 127.0.0.1:3000
scripts/ops/channex-tunnel.sh                  # публичный адрес для webhook Channex на время разработки
npm test                                       # vitest: модульные параллельно, интеграционные (живая dev-БД) по одному
npm run e2e                                    # Playwright, 18 файлов сценариев; брони и сайты автотестов убираются сами
npm run morning                                # утренний отчёт в reports/morning/
npm run analytics:retention -- --dry           # счётчик сайта: сессии старше 13 месяцев (без --dry — удалить)
npm run reconcile:day -- 2026-09-17            # двойной ввод: сутки против живого Exely
```

## Навигация

| Файл | Что внутри |
|---|---|
| [AGENTS.md](AGENTS.md) | Правила для AI-агентов. Читать первым. |
| [SPEC.md](SPEC.md) | Что строим и что НЕ строим |
| [DATA_MODEL.md](DATA_MODEL.md) | Модель данных v1.2, утверждена полностью (§11 — 12.09.2026) |
| [DECISIONS.md](DECISIONS.md) | ADR — принятые архитектурные решения |
| [QUESTIONS.md](QUESTIONS.md) | Открытые вопросы. Агент не имеет права гадать. |
| [GLOSSARY.md](GLOSSARY.md) | Термины |
| [PLAN.md](PLAN.md) | План на 8 недель + гейты |
| [CUTOVER.md](CUTOVER.md) | Переезд с Exely на Channex по каналам, условие допуска по ПД |
| [SECURITY.md](SECURITY.md) | Персональные данные, секреты, доступы |
| [OBJECT.md](OBJECT.md) | **Паспорт объекта.** Факты из Exely: фонд, тарифы, каналы, деньги |
| [FINDINGS.md](FINDINGS.md) | **Находки аудита.** Улики ручной работы, дефекты данных, приоритеты |
| [ONBOARDING.md](ONBOARDING.md) | Что делать прямо сейчас, по шагам |
| [HANDOFF.md](HANDOFF.md) | **Передача проекта.** Промпты для AI-сессии, точки входа в код, чеклист приёмки |
| [TZ-EXELY-AUDIT.md](TZ-EXELY-AUDIT.md) | ТЗ на аудит текущей PMS. Аудит сдан 07.09.2026 |
| [docs/site/install-2026-09-12.md](docs/site/install-2026-09-12.md) | **Установка на сайт:** код счётчика и виджета бронирования, куда вставлять, проверка, постоянный адрес |

## Директории

```
docs/                  vendor-документация: Channex (сайт целиком), Exely (API 1.5.0); eQonaq и fiscal — исследования без документации
project-input/         реальные данные объекта (не коммитятся, кроме аудита без ПД)
  exely/audit-2026-09-07/   сданный аудит: ответы, инвентарь, справочники
templates/             опросник администраторов, гид по съёмке экранов, шаблоны выгрузок
outbox/                письма провайдерам и их статус
plans/                 планы срезов и дней, пакет сертификации Channex
reports/               доказательства: сверки, отчёты дней, скриншоты, утренние отчёты
apps/web               Next.js стойка: «Сегодня», шахматка, брони, гости, счета, тарифы, каналы, журнал, печать RU/KZ; общая навигация, токены `app/globals.css` и компоненты `src/components` (ADR-027)
apps/api               NestJS API (localhost:3001): inventory, units, chessboard, reservations, guests, desk, finance, rates, channels
packages/database      Prisma schema, 8 миграций
packages/domain        бизнес-правила: доступность, ограничения, финансы, штрафы, шахматка
packages/integrations  Exely (импорт по API), Channex (клиент, ARI, webhook), порты eQonaq и fiscal без реализации (ADR-004)
packages/shared        общие типы и утилиты
tests/                 unit / integration (живая dev-БД) / e2e (Playwright)
scripts/imports        импорт из Exely: фонд, тарифы, календарь цен, брони, услуги; синхронизация суток
scripts/reconciliation сверки с Exely и Channex, утренний отчёт, уборка броней автотестов
scripts/ops            туннель и регистрация webhook Channex на время разработки
```

## Definition of Done всего MVP

См. хвост [SPEC.md](SPEC.md). Коротко: сотрудник отрабатывает смену, ни разу не открыв Exely,
и все цифры сходятся с Exely с расхождением **0**.
