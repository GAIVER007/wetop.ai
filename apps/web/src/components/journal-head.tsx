import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import '../app/journal-head.css';

/**
 * Шапка журнала одна во всех направлениях (владелец 23.10.2026: «календарь в гостинице удобней, везде сделай так
 * одинаково», «шапку журнала сделай у всех одинаково»): строка 1, значок и заголовок, справа переход по дням или
 * периоду, «Во весь экран», «Быстрый отчёт» и главная кнопка; строка 2, итоги дня одной строкой; строка 3,
 * отборы раздела отдельной карточкой. Образец, календарь гостиницы (`chessboard/page.tsx`).
 */
export function JournalHead({
  icon = 'board',
  title,
  subtitle,
  nav,
  actions,
  summary,
  filters,
}: {
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  /** переход по дням (`DayNav`) или периоду (`DateRangePopover` в `.board-period`) */
  nav?: ReactNode;
  /** «Во весь экран», «Быстрый отчёт», главная кнопка, именно в этом порядке */
  actions?: ReactNode;
  /** итоги дня одной строкой (`SummaryLine`) */
  summary?: ReactNode;
  /** отборы раздела: специалисты, вид, залы, поиск, «Фильтры» */
  filters?: ReactNode;
}) {
  return (
    <div className="journal-head">
      <div className="journal-head__top">
        <div className="journal-head__heading">
          {/* заголовок страницы (h1) у `Page` с классом `journal-page` скрыт визуально и остаётся для читалки и тестов;
              видимый заголовок здесь, в одной строке с переходом по дням, как у календаря гостиницы */}
          <div className="journal-head__title" aria-hidden="true">
            <Icon name={icon} className="journal-head__icon" />
            {title}
          </div>
          {subtitle && <p className="journal-head__subtitle" aria-hidden="true">{subtitle}</p>}
        </div>
        <div className="journal-head__actions" role="group" aria-label="Период и действия журнала">
          {nav}
          {actions}
        </div>
      </div>
      {summary && <div className="journal-head__summary">{summary}</div>}
      {filters && (
        <div className="journal-head__filters" role="group" aria-label="Отборы журнала">
          {filters}
        </div>
      )}
    </div>
  );
}
