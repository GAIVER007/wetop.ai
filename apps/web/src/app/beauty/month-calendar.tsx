'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { JournalFilter, JournalHead, JournalSearch, FiltersTitle } from '../../components/journal-head';
import { DateRangePopover } from '../../components/date-range-popover';
import { SummaryLine } from '../../lib/summary-line';
import { useNarrow } from '../../lib/use-narrow';
import { matchesCustomer } from '../../lib/customer-match';
import { beautyStatus } from '../../lib/status/beauty';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { JournalExpandButton } from '../../components/journal-expand';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Help } from '../../components/ui';
import type { BeautyAppointmentRow, BeautyDay, BeautyEmployeeRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { StatusChips } from './calendar-legend';
import { clock } from './time';
import { calendarColumns, matchesAppointment } from './calendar-columns';
import { useLocale, useT } from '../../i18n/locale-provider';
import { intlLocale, msg } from '../../i18n';
import { monthGrid, plusDays, shiftMonth } from './month-grid';

type Row = BeautyAppointmentRow & { localDate: string };
/** в клетке дня видно не больше трёх записей, остальные «ещё N» (эскиз А, владелец 26.10.2026) */
const SHOWN = 3;

/**
 * Месяц журнала салона (владелец 26.10.2026: «кнопку Неделя замени на Месяц и сделай чёткий месячный график», эскиз А
 * «Записи в клетках»). Сетка 7 × 5–6 с понедельника, записи временем и именем, цвет полосы по статусу, число записей
 * дня, «ещё N», сегодня в рамке, дни соседних месяцев приглушены. Номер дня открывает день журнала.
 */
export function MonthCalendar({
  day,
  rows,
  selectedDate,
  employees,
  views,
  canCreate = false,
  today = new Date().toISOString().slice(0, 10),
}: {
  /** выбранный день: услуги для отбора и мастера для подписей */
  day: BeautyDay;
  /** записи сетки месяца одним запросом `/beauty/appointments/period` */
  rows: Row[];
  canCreate?: boolean;
  /** «День / Месяц» в строке отборов единой шапки */
  views?: ReactNode;
  selectedDate: string;
  employees: BeautyEmployeeRow[];
  today?: string;
}) {
  const router = useRouter();
  const t = useT();
  const locale = intlLocale(useLocale());
  const params = useSearchParams();
  const employee = params.get('employee') ?? '';
  const service = params.get('service') ?? '';
  const status = params.get('status') ?? '';
  const grid = monthGrid(selectedDate);
  const masterNames = new Map<string, string>([
    ...calendarColumns(day, employees, t).map((c) => [c.id, c.name] as const),
    ...employees.map((e) => [e.id, e.name] as const),
  ]);
  const options = [...new Map([
    ...calendarColumns(day, employees, t).map((c) => [c.id, c] as const),
    ...rows.flatMap((r) =>
      (r.items?.length ? r.items : [r]).map(
        (item) =>
          [
            item.employeeId,
            {
              id: item.employeeId,
              name:
                ('employeeName' in item && item.employeeName) ||
                masterNames.get(item.employeeId) ||
                t('Специалист недоступен'),
            },
          ] as const,
      ),
    ),
  ]).values()];
  const href = (date: string, month = true, master = employee) => {
    const query = new URLSearchParams(params.toString());
    query.set('date', date);
    if (month) query.set('view', 'month');
    else query.delete('view');
    if (master) query.set('employee', master);
    else query.delete('employee');
    return `/calendar?${query}`;
  };
  const [query, setQuery] = useState('');
  const narrow = useNarrow();
  const setParam = (key: 'service' | 'status', value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/calendar?${next}`, { scroll: false });
  };
  const visible = rows
    .filter(
      (r) =>
        matchesAppointment(r, employee, service) &&
        (!status || r.status === status) &&
        matchesCustomer(query, r.customer),
    )
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));
  const byDay = new Map<string, Row[]>();
  for (const r of visible) byDay.set(r.localDate, [...(byDay.get(r.localDate) ?? []), r]);
  const monthRows = visible.filter(
    (r) => r.localDate.slice(0, 7) === grid.month && r.status !== 'CANCELLED',
  );
  const services = day.services;
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${grid.month}-15T12:00:00Z`));
  const weekdays = grid.days.slice(0, 7).map((d) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)),
  );
  return (
    <div data-testid="beauty-month">
      <JournalHead
        title={t('Журнал')}
        subtitle={t('Месяц специалистов')}
        nav={
          <div className="board-period day-nav" role="group" aria-label={t('Месяц журнала')}>
            <DateRangePopover
              from={grid.days[0]!}
              to={grid.days.at(-1)!}
              today={today}
              compact
              onDay={(date) => router.push(href(date))}
              dayPresets={[
                { label: msg('Сегодня'), onSelect: () => router.push(href(today, false)) },
                { label: msg('Вчера'), onSelect: () => router.push(href(plusDays(today, -1), false)) },
                { label: msg('Этот месяц'), onSelect: () => router.push(href(today)) },
              ]}
              triggerTestId="month-nav-button"
            />
            <span className="beauty-month__title" data-testid="beauty-month-title">
              {monthTitle}
            </span>
            <Link href={href(shiftMonth(selectedDate, -1))} className="icon-button" aria-label={t('Предыдущий месяц')}>
              <Icon name="chevron" className="rotate-left" />
            </Link>
            <Link href={href(shiftMonth(selectedDate, 1))} className="icon-button" aria-label={t('Следующий месяц')}>
              <Icon name="chevron" />
            </Link>
          </div>
        }
        actions={
          <>
            <JournalExpandButton />
            <QuickReport
              text={t('Быстрый отчёт')}
              key={`${selectedDate}:${employee}`}
              date={selectedDate}
              scope={[
                employee
                  ? (options.find((e) => e.id === employee)?.name ?? t('Специалист недоступен'))
                  : t('Все специалисты'),
                t('Выбранный день'),
                ...(service || status ? [t('С учётом фильтров')] : []),
              ]}
              build={() => beautyQuickReport(byDay.get(selectedDate) ?? [])}
            />
            {canCreate && (
              <Link className="btn" prefetch={false} href={`${href(selectedDate, false)}&new=1`}>
                <Icon name="plus" aria-hidden="true" />
                {t('Новая запись')}
              </Link>
            )}
          </>
        }
        summary={
          <SummaryLine
            label={t('Итоги месяца')}
            testId="beauty-month-summary"
            parts={[
              { key: 'all', label: t('Записей за месяц'), value: monthRows.length },
              {
                key: 'wait',
                label: t('ждём'),
                value: monthRows.filter((r) => r.status === 'BOOKED' || r.status === 'CONFIRMED').length,
              },
              { key: 'done', label: t('завершено'), value: monthRows.filter((r) => r.status === 'DONE').length },
              { key: 'noshow', label: t('не пришли'), value: monthRows.filter((r) => r.status === 'NO_SHOW').length },
            ]}
          />
        }
        filters={
          <>
            <JournalSearch
              value={query}
              onChange={setQuery}
              label={t('Поиск в журнале')}
              placeholder={narrow ? t('Клиент') : t('Клиент, телефон')}
            />
            <EmployeeFilter
              options={options}
              value={employee}
              allLabel={t('Все специалисты')}
              kind="specialists"
              onChange={(id) => router.replace(href(selectedDate, true, id), { scroll: false })}
            />
            <JournalFilter
              label={t('Услуга')}
              allLabel={t('Все услуги')}
              value={service}
              onChange={(v) => setParam('service', v)}
              options={services.map((sv) => ({ value: sv.id, label: sv.name }))}
            />
            <JournalFilter
              label={t('Статус записи')}
              allLabel={t('Все статусы')}
              value={status}
              onChange={(v) => setParam('status', v)}
              options={Object.entries(beautyStatus)
                .filter(([key]) => key !== 'CANCELLED')
                .map(([value, st]) => ({ value, label: st.label }))}
            />
            <span className="journal-head__phone-only">
              <Help title={<FiltersTitle active={[service, status].filter(Boolean).length} />}>
                <span className="sr-only">{t('Услуга и статус')}</span>
                <StatusChips value={status} onChange={(v) => setParam('status', v)} />
              </Help>
            </span>
            <div className="journal-head__desk-only">
              <StatusChips value={status} onChange={(v) => setParam('status', v)} />
            </div>
          </>
        }
        views={views}
      />
      <div className="beauty-month-weekdays" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i} className={i > 4 ? 'is-weekend' : undefined}>
            {w}
          </span>
        ))}
      </div>
      <div
        className="beauty-month-calendar"
        role="list"
        aria-label={t('Месяц журнала')}
        data-weeks={grid.days.length / 7}
      >
        {grid.days.map((date, index) => {
          const dayRows = byDay.get(date) ?? [];
          const live = dayRows.filter((r) => r.status !== 'CANCELLED').length;
          const other = date.slice(0, 7) !== grid.month;
          const classes = [
            'beauty-month-day',
            other ? 'is-other' : '',
            index % 7 > 4 ? 'is-weekend' : '',
            date === today ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={date} role="listitem" className={classes} aria-label={displayDate(date, 'full', locale)}>
              <Link
                className="beauty-month-day__head"
                href={href(date, false)}
                prefetch={false}
                aria-label={t('Открыть день: {date}', { date: displayDate(date, 'full', locale) })}
                aria-current={date === today ? 'date' : undefined}
              >
                <b className="beauty-month-day__num">{Number(date.slice(8, 10))}</b>
                {live > 0 && <span className="beauty-month-day__count">{live}</span>}
              </Link>
              {dayRows.length > 0 && (
                <ul className="beauty-month-appointments">
                  {dayRows.slice(0, SHOWN).map((row) => {
                    const who = row.items?.length
                      ? [...new Set(row.items.map((item) => item.employeeName || masterNames.get(item.employeeId) || t('Специалист недоступен')))].join(', ')
                      : (masterNames.get(row.employeeId) ?? t('Специалист недоступен'));
                    const what = row.items?.length ? row.items.map((item) => item.serviceName).join(', ') : row.serviceName;
                    return (
                      <li key={row.id}>
                        <Link
                          className={`beauty-month-chip beauty-week-chip--${row.status.toLowerCase()}`}
                          prefetch={false}
                          href={`${href(date, false)}&appointment=${encodeURIComponent(row.id)}`}
                          title={`${clock(row.startMinutes)}–${clock(row.endMinutes)}, ${row.customer.name}, ${what}, ${who}, ${t(beautyStatus[row.status].label)}`}
                        >
                          <time dateTime={row.startsAt}>{clock(row.startMinutes)}</time>
                          <b>{row.customer.name}</b>
                          <span className="sr-only">
                            {what}, {who}, {t(beautyStatus[row.status].label)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {dayRows.length > SHOWN && (
                    <li>
                      <Link className="beauty-month-more" prefetch={false} href={href(date, false)}>
                        {t('ещё {n}', { n: dayRows.length - SHOWN })}
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
