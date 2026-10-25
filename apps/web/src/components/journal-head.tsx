import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { Input, Select } from './ui';
import { msg } from '../i18n';
import { Labelled, T } from '../i18n/locale-provider';
import '../app/journal-head.css';

/**
 * Шапка журнала одна во всех направлениях (владелец 23.10.2026: «календарь в гостинице удобней, везде сделай так
 * одинаково», «шапку журнала сделай у всех одинаково»; 24.10.2026: «везде единая, удобная, с выбором даты,
 * специалиста, услуг»). Строка 1: значок и заголовок, справа день или период, «Во весь экран», «Быстрый отчёт»,
 * главная кнопка. Строка 2: итоги дня одной строкой. Строка 3: карточка отборов в одном порядке, как у календаря
 * гостиницы: поиск, выборы (кто, что, статус), «Фильтры», вид справа. Решение:
 * docs/decisions/2026-10-24-journal-head-filters.md.
 */
export function JournalHead({
  icon = 'board',
  title,
  subtitle,
  nav,
  actions,
  summary,
  filters,
  views,
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
  /** отборы раздела: `JournalSearch`, `JournalFilter`/`EmployeeFilter`, «Фильтры» */
  filters?: ReactNode;
  /** вид экрана («День / Неделя», «План зала / Расписание», «Шкала / Список»): всегда последним, справа */
  views?: ReactNode;
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
        <Labelled className="journal-head__actions" role="group" label={msg('Период и действия журнала')}>
          {nav}
          {actions}
        </Labelled>
      </div>
      {summary && <div className="journal-head__summary">{summary}</div>}
      {(filters || views) && (
        <Labelled className="journal-head__filters" role="group" label={msg('Отборы журнала')}>
          {filters}
          {views && <div className="journal-head__views">{views}</div>}
        </Labelled>
      )}
    </div>
  );
}

/** Подпись «Фильтры» строки отборов со значком, как кнопка «Фильтры» календаря гостиницы (владелец 24.10.2026) */
export function FiltersTitle({ active = 0 }: { active?: number }) {
  return (
    <>
      <Icon name="filter" aria-hidden="true" />
      <T text={msg('Фильтры')} />
      {active > 0 && (
        <>
          {'\n'}
          <T text={msg('Активных: {n}')} vars={{ n: active }} />
        </>
      )}
    </>
  );
}

/** Поиск в строке отборов: то же поле, что «Поиск в календаре» гостиницы; Ctrl/Cmd+K ставит курсор сюда (§40) */
export function JournalSearch({
  value,
  onChange,
  label,
  placeholder,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  /** подпись для читалки: «Поиск в журнале» */
  label: string;
  placeholder: string;
  /** Enter: открыть первую найденную запись */
  onEnter?: () => void;
}) {
  return (
    <label className="journal-search">
      <Icon name="search" className="journal-search__icon" />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        data-page-search=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </label>
  );
}

/** Выбор в строке отборов («Все услуги», «Все статусы», «Все зоны»): одна ширина и вид во всех журналах */
export function JournalFilter({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  /** подпись для читалки и тестов: «Услуга», «Статус записи» */
  label: string;
  allLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select className="journal-filter" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
