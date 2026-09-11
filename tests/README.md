# tests

| Папка | Что покрывает |
|---|---|
| `unit/` | Функции, доменные правила, расчёты денег и дат |
| `integration/` | API endpoints, БД, адаптеры интеграций (sandbox) |
| `e2e/` | Playwright, критичные сценарии стойки |

Инструменты: Vitest (unit, integration), Playwright (e2e). Запуск: `npm test`, полная проверка: `npm run check`.
Первый тест — `unit/scaffold.test.ts`: пакеты `@pms/*` резолвятся по имени.

## Правила

1. **Red before green** (AGENTS.md §6): новый bugfix или business rule начинается
   с падающего теста. Тест, который никогда не был красным, не считается доказательством.
2. **No real guest data** (AGENTS.md §8, ADR-010): все тестовые гости вымышленные.
   Запрещено копировать реальные ФИО, телефоны, паспорта, email, документы в fixtures.
3. Минимальное покрытие — 80%, включая unit, integration и E2E.

## Критичные E2E-сценарии

- [x] Номерной фонд: страница показывает 88 единиц, фильтр по категории — `e2e/inventory.spec.ts` (08.09.2026)
- [x] Создание брони → появление в шахматке → изменение availability — `e2e/manual-reservation.spec.ts` (09.09.2026)
- [x] Check-in → in-house → check-out — `e2e/check-in-out.spec.ts`; полный день гостя с услугой, оплатой и выездом — `e2e/full-day.spec.ts` (10.09.2026)
- [x] Room move с пересчётом, «+ 1 ночь», отказ по занятой ячейке — `e2e/desk-tasks.spec.ts` (10.09.2026)
- [x] Изменение дат, редактирование брони, групповая бронь — `e2e/desk-edit.spec.ts` (11.09.2026)
- [x] Оплата → частичная оплата → refund → сторно — `e2e/finance.spec.ts` (09.09.2026)
- [x] Штраф при отмене по политике тарифа — `e2e/cancellation-penalty.spec.ts` (10.09.2026)
- [x] Channex: сценарии сертификации 1–11 из интерфейса PMS — `e2e/channex-certification.spec.ts` (09.09.2026)
- [x] Повторная ревизия Channex не создаёт дубль; перенесённая из Exely бронь канала опознаётся по номеру OTA — `apps/api/src/channels/inbound.controller.test.ts` (модульные, на фейковом репозитории)
- [x] Переселение перетаскиванием в шахматке; печатные формы RU/KZ (регистрационная карта, договор, счёт) и журнал — `e2e/chessboard-drag.spec.ts`, `e2e/print-forms.spec.ts`, `e2e/print-and-journal.spec.ts` (11.09.2026)
- [x] Блокировки и уборка ячеек — `e2e/unit-blocks.spec.ts`; ранний заезд и поздний выезд — `e2e/stay-extras.spec.ts`; экран «Сегодня» — `e2e/desk-day.spec.ts` (10–11.09.2026)
- [ ] Получение настоящей OTA-брони из production Channex — после сертификации (Gate 9)

## Интеграционные тесты и живая БД

`tests/integration` ходит в dev-БД через пулер Supabase. В `vitest.config.ts` это отдельный проект с
`fileParallelism: false`: параллельные PrismaClient вычерпывают сессии пулера, и 11.09.2026 три файла
отвалились по обрыву соединения, просидев 2,5 часа на таймаутах; по одному проходят за ~2,5 минуты.
Запуск только их: `npx vitest run --project integration`.

Брони автотестов e2e занимают настоящие ячейки и убираются `tests/e2e-teardown.ts` после прогона;
вручную — `npm run e2e:cleanup`.
