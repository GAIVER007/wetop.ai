# Журнал прогонов тестов

Строки дописывает `npm run test:record` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
| 28.09.2026 22:47 | unit (частично: packages/domain/src/availability apps/api/src/reservations/stay-offers.test.ts apps/api/src/auth/route-access.test.ts tests/unit/design-slop.tes | ✅ 31 из 31 | 8 с | 1caae4a +50 | [лог](logs/2026-09-28T17-47-47Z-unit-42d8.log) | AV2 после слияния main (сброс платформы) |
| 28.09.2026 22:52 | unit (частично: apps/web/src/lib/booking-link.test.ts) | ❌ код выхода 1 | 1 с | c4d62c8 +1 | [лог](logs/2026-09-28T17-52-16Z-unit-3519.log) | AV3 red: разбора ссылки в форму брони ещё нет |
| 28.09.2026 22:52 | unit (частично: apps/web/src/lib/booking-link.test.ts) | ✅ 5 из 5 | 1 с | c4d62c8 +2 | [лог](logs/2026-09-28T17-52-44Z-unit-2e61.log) | AV3 green: разбор и сборка ссылки в форму брони |
| 28.09.2026 22:52 | unit (частично: apps/web/src/app/reservations/actions.test.ts) | ❌ упало 1 из 6 | 1 с | c4d62c8 +3 | [лог](logs/2026-09-28T17-52-56Z-unit-a0ab.log) | AV3 red: «Автоматически» ещё не переводится в autoAssign |
| 28.09.2026 22:53 | unit (частично: apps/web/src/app/reservations/actions.test.ts) | ✅ 6 из 6 | 1 с | c4d62c8 +4 | [лог](logs/2026-09-28T17-53-06Z-unit-1e33.log) | AV3 green: «Автоматически» → autoAssign |
| 28.09.2026 22:56 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts --grep AV3 --workers=1) | ❌ упало 1 из 1 | 2 мин 52 с | c4d62c8 +5 | [лог](logs/2026-09-28T17-56-56Z-e2e-e03d.log) | AV3 red: на прежнем экране нет списка мест и «Выбрать автоматически» |
| 28.09.2026 23:00 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/fund-workspace.spec.ts tests/ui/availability-gate.spec.ts tests/ui/workspace.spec.ts tests/ui/cha | ❌ упало 1 из 137 | 11 мин 38 с | c4d62c8 +10 | [лог](logs/2026-09-28T18-00-02Z-e2e-1870.log) | AV3 green: список мест, автовыбор, заполненная форма брони; спеки, задетые формой |
| 28.09.2026 23:12 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/workspace.spec.ts --grep новая бронь: резюме выбора --workers=1) | ✅ 1 из 1 | 9 с | 908b109 +1 | [лог](logs/2026-09-28T18-12-08Z-e2e-d49c.log) | AV3: спек резюме брони берёт первую настоящую ячейку, а не второй пункт списка |
| 28.09.2026 23:12 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/availability-gate.spec.ts --workers=1) | ✅ 2 из 2 | 17 с | 908b109 +2 | [лог](logs/2026-09-28T18-12-39Z-e2e-989b.log) | AV3: витрина light/dark, форма брони — страницей |
| 28.09.2026 23:13 | e2e (частично: --config tests/ui/playwright.config.ts tests/ui/availability-gate.spec.ts --workers=1) | ✅ 2 из 2 | 18 с | 908b109 +2 | [лог](logs/2026-09-28T18-13-21Z-e2e-2be6.log) | AV3: витрина, телефон — снимок от начала страницы |
| 28.09.2026 23:14 | unit | ✅ 2159 из 2162, пропущено 3 | 1 мин 24 с | 908b109 | [лог](logs/2026-09-28T18-14-13Z-unit-3a2a.log) | AV3: полный unit на ветке (слит main со сбросом платформы) |
