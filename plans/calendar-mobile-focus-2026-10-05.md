# Календарь: возврат фокуса после закрытия панели

Status: owner approved the plan and explicitly authorized isolated parallel work on 2026-10-05. No shared development database, foreign files/processes or index are used.

## Проверенный недочёт

На авторизованном app.wetop.ai/chessboard при ширине 390px открыта панель свободной клетки. Внутри панели фокус установлен корректно. После Escape панель удаляется, document.activeElement становится BODY, фокус не возвращается в шахматку. Реальные брони, гости и блокировки не изменялись. Размер desktop восстановлен.

Все проверенные кнопки заголовка и навигации имеют высоту 44px. В панели кнопка закрытия 44x44px, действия высотой 44px, поля дат высотой 48px и шрифтом 16px. Горизонтального выхода страницы за экран не обнаружено. Поэтому увеличение этих элементов не требуется.

## Ограниченный план

1. После освобождения рабочего дерева добавить записываемый regression test: открыть свободную клетку R07, закрыть через Escape, проверить возврат фокуса к той же клетке и неизменную позицию сетки. Сначала получить RED.
2. Исправить возврат фокуса в существующей панели свободного периода. Закрытие кликом снаружи не должно перехватывать фокус у нажатого элемента. Прокрутка и закрытие не должны создавать запись или менять бронирование.
3. Проверить закрытие кнопкой, повторное открытие, выбор периода и ссылку с датами. Сохранить desktop-поведение и режим только чтения.
4. Получить GREEN через npm run test:record на изолированном fixture-стенде, один worker. Выполнить lint и typecheck. Нужные UI проверки: мобильный календарь, выделение периода, предпросмотр и клавиатурное управление.
5. Подготовить отдельный проверяемый коммит и включить его в main с сохранением чужих изменений. Выкладка только точного SHA с зелёным release-checks. Новые миграции в этот проход не входят.

## Текущий блокер

AGENTS.md §17 запрещает начинать кодовые изменения при чужих незакоммиченных файлах apps/packages/scripts. В основном дереве есть чужие изменения finance и today. Замки tests/runs/.locks отсутствуют, но это не отменяет проверку git status. Чужие файлы и процессы не трогать. Документацию правило разрешает менять.

AGENTS.md §1 требует подтверждения плана до изменения пользовательского сценария. Этот файл описывает конкретный объём следующего прохода; пока он не выдан за реализованную доработку.

## Источники

- Live DOM проверка рабочего календаря 05.10.2026, без данных гостей в отчёте.
- apps/web/src/app/chessboard/free-menu.tsx: Escape вызывает onClose без явного восстановления фокуса.
- apps/web/src/app/chessboard/board-grid.tsx: closeFreeMenu очищает состояние панели.
- UI/UX Pro Max: локальный поиск touch target mobile buttons, ux; размеры и расстояния нужно оценивать по платформе, существующие web-кнопки уже 44px.

## Approved implementation

Explicit Escape and close-button actions restore focus to the existing anchor cell with preventScroll. Non-focusable cells receive tabindex=-1, without adding thousands of cells to sequential keyboard navigation. Outside clicks and movement closures retain their prior behavior. The change is confined to FreeMenuPopover; no booking or financial rules change.
