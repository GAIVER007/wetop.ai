# UI3.2: последовательные срезы для review

Предложение, не разрешение реализации. Все пути относительно корня clone. Для каждого среза максимум пять перечисленных файлов; если фактический diff шире, выделить следующий PR. Общие проверки и состояния: plan.md §7. Реальные PR не созданы. Каждый срез оставляет API примитивов обратно совместимым.

## P0. Нормативный контракт (два docs-only среза, S/M)

- [ ] P0a: DESIGN.md, DECISIONS.md. Свести UI3.1 и таблицу UI3.2 в существующие разделы, убрать противоречивые актуальные предписания.
- [ ] P0b: CLAUDE.md, apps/web/CLAUDE.md. Ссылки на единый источник, без дублирования чисел. После P0a.
- [ ] Приёмка: каждое число связано с действующим token/CSS; отсутствует второй дизайн-контракт; согласованные решения явно отделены от будущих требований.
- [ ] Проверка: docs diff и двусторонняя сверка с кодом; не нужен перезапуск базы.

Параллельная зависимость: закрыть UI3.1 acceptance отдельной задачей, не прятать её исправления в PR кнопок. Отчёт с двумя runtime-пробами не заменяет исходный тест /hotel-settings.

## A. Кнопки, первый runtime-срез (M, после P0 и согласования)

Файлы: apps/web/src/components/ui.tsx; apps/web/src/app/components.css; apps/web/src/app/design-system/page.tsx; apps/web/src/components/primitives.test.ts; tests/ui/ds1b-primitives.spec.ts.

- [ ] Свести primary/secondary/danger/ghost и icon-button к существующим размерам/состояниям; остальные tones не удалить. Loading остаётся aria-busy + disabled + текст.
- [ ] Сохранить type/name/value/formAction, ссылки .btn и поведение submit. Не назначать type=button глобально: часть действующих форм полагается на submit.
- [ ] Приёмка: состояния различимы в двух темах; keyboard focus и доступное имя icon-button; mobile target44; повторный submit не создаёт вторую операцию.
- [ ] Проверка: primitives, ds1b, design-system, mobile-adaptation; smoke настройки/новая бронь/финансы/Beauty/Food; before/after без смены baseline.

## Checkpoint A

- [ ] Представить diff, результаты по реальным потребителям и скриншоты. Не переходить автоматически к миграции всех экранов.

## B1. Поля и validation (M, после A)

Файлы: components/ui.tsx; app/components.css; app/design-system/page.tsx; components/primitives-ds1c.test.ts; tests/ui/ds1c-primitives.spec.ts (все под apps/web/src, кроме tests).

- [ ] Input/Select/Textarea/Field: label/hint/error, disabled/readOnly/required, длинный текст и native validation; сохранить имена полей и ввод после отказа.
- [ ] Не создавать новый Select engine; перепроверить CSS arrow и native keyboard.
- [ ] Приёмка/проверка: DS1c плюс reservation-tariff/fixed-occupancy, guest-wizard; error не стирает данные и связан aria-describedby.

## B2. Checkbox и Switch (S/M, после B1)

Файлы: apps/web/src/components/switch.tsx; apps/web/src/app/components.css; apps/web/src/app/design-system/page.tsx; tests/ui/ds1c-primitives.spec.ts.

- [ ] Унифицировать existing checkbox/switch поверхности; native checked/name/value остаются прежними.
- [ ] Приёмка/проверка: label и Space, disabled, focus, submit unchecked/checked соответствует прежнему контракту; target44 на мобильных.

## C1. Окна и подтверждения (M, после A/B1)

Файлы: components/overlay.tsx; components/confirm-dialog.tsx; app/components.css; app/design-system/demos.tsx; tests/ui/ds1c-primitives.spec.ts.

- [ ] Размеры sm/md/lg из текущих tokens, длинный заголовок, viewport clamp, loading/error в содержимом; существующий механизм dialog сохранить.
- [ ] Приёмка/проверка: nested Escape закрывает один слой, Tab не уходит под модальное окно, фокус возвращается, отмена не вызывает mutation; исходные confirmation flows сохраняются.

## C2. Route drawer (S/M, после C1)

Файлы: components/route-drawer.tsx; app/components.css; tests/ui/chessboard-card.spec.ts; tests/ui/reservations-v2.spec.ts.

- [ ] Согласовать поверхность drawer, не менять URL/close callbacks и intercepting routes.
- [ ] Приёмка/проверка: прямой URL, открытие из списка, back/forward/reload, два вложенных окна; mobile width без scroll страницы.

## D1. Panel и KPI (M, после A)

Файлы: components/ui.tsx; components/kpi-tile.tsx; app/components.css; app/design-system/page.tsx; tests/ui/ds1b-primitives.spec.ts.

- [ ] Единая поверхность Panel/Stat/KpiTile; не унифицировать бизнес-значения под один тип карточки.
- [ ] Приёмка/проверка: 0/нет данных/длинное название/большие числа, ссылки доступны, реальные значения прежние; smoke sales и ai-seller как потребителей KpiTile.

## D2. Составные карточки (S/M, после D1)

Файлы: components/section-cards.tsx; app/components.css; app/design-system/page.tsx; tests/ui/design-system.spec.ts.

- [ ] Описать композиции карточки объекта/сотрудника/брони из существующих примитивов; перенос экранов отдельно, не массово.
- [ ] Приёмка/проверка: нет новой копии универсальной Card API; статус/действия доступны, длинный контент не обрезается без возможности просмотра.

## E. Table (M, после A/B1)

Файлы: components/ui.tsx; app/components.css; app/design-system/page.tsx; components/primitives-ds1c.test.ts; tests/ui/ds1c-primitives.spec.ts.

- [ ] Сохранить normal/compact, caption, sticky варианты и legacy интерфейс; единый ритм ячеек.
- [ ] Сортировка/фильтры/пагинация остаются у потребителей, текущие query names не менять.
- [ ] Приёмка/проверка: sticky header/column при скролле, responsive, длинные ячейки, empty; smoke inventory-catalog, guests-bookings, reservations-v2, финансы. Массовый перевод legacy Table выделить в будущие малые PR.

## F1. DateInput (M, после B1/C1)

Файлы: components/date-field.tsx; app/components.css; app/design-system/page.tsx; tests/ui/ds1c-primitives.spec.ts.

- [ ] Сохранить native input, property date, keyboard и mobile picker; только общие состояния/поверхность.
- [ ] Приёмка/проверка: leap day, месяц/год, min/max, empty/error, timezone объекта; PeriodPicker потребители не сломаны.

## F2. Контракт диапазона (docs + отдельный будущий пилот)

- [ ] В DESIGN.md описать draft/applied и popover для UI3.3; не превращать все три PeriodPicker потребителя в новый сценарий автоматически.
- [ ] Реализация range adapter для шахматки входит в UI3.3-1 после отдельного утверждения. Общая поверхность переиспользует C1/F1; при выделении Calendar-части новый компонент сначала внести в DESIGN §8.

## G. Графики (три независимых S/M, не блокируют шахматку)

- [ ] G1: components/line-chart.tsx, app/components.css, app/design-system/page.tsx, tests/ui/market-charts.spec.ts. Проверить series/legend/accessible table, empty/error/loading, числа не изменены.
- [ ] G2: components/day-bars.tsx, app/components.css, tests/ui/design-system.spec.ts. Проверить подписи, 0/пропуски/большие числа, keyboard/tooltip где уже поддерживается.
- [ ] G3: components/donut-share.tsx, components/share-bar.tsx, app/components.css, tests/ui/design-system.spec.ts. Проверить доли/легенду/цвета/суммы и состояния; форматирование и расчёт не переписывать.

## H. Общая приёмка

- [ ] На окончательном SHA: lint, typecheck, unit; полный действующий UI-набор и проверка трёх вертикалей по TESTING.md.
- [ ] Никакого автоматического snapshot update; старые красные проверки имеют отдельный статус.
- [ ] У каждого семейства приложены screenshots/consumer matrix и явные пределы проверки.
- [ ] Для старта шахматки готовы P0, A, B1, C1/C2, D1, E, F1/F2 contract; G и D2 не являются искусственным блокером.
- [ ] UI3.3 утверждён отдельно; runtime UI3.3 не начинать до этого checkpoint.
