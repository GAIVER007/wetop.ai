'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { JournalFilter, JournalHead, JournalSearch, FiltersTitle } from '../../components/journal-head';
import { DateRangePopover } from '../../components/date-range-popover';
import { SummaryLine } from '../../lib/summary-line';
import { useNarrow } from '../../lib/use-narrow';
import { beautyStatus } from '../../lib/status/beauty';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { JournalExpandButton } from '../../components/journal-expand';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Help } from '../../components/ui';
import type { BeautyDay, BeautyEmployeeRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { CalendarLegend } from './calendar-legend';
import { clock } from './time';
import { calendarColumns, matchesAppointment } from './calendar-columns';
import { useLocale, useT } from '../../i18n/locale-provider';
import { intlLocale, msg } from '../../i18n';

const plusDays = (date: string, n: number) => {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
};

export function WeekCalendar({
  days,
  selectedDate,
  employees,
  views,
  canCreate = false,
  today = new Date().toISOString().slice(0, 10),
}: {
  /** «Новая запись» в шапке, как в дне и у «Новой брони» гостиницы: открывает выбранный день с формой записи */
  canCreate?: boolean;
  /** «День / Неделя» в строке отборов единой шапки */
  views?: ReactNode;
  days: BeautyDay[];
  selectedDate: string;
  employees: BeautyEmployeeRow[];
  /** сегодня по поясу филиала: быстрые недели в окне выбора */
  today?: string;
}) {
  const router = useRouter();
  const t = useT();
  const locale = intlLocale(useLocale());
  const params = useSearchParams();
  const employee = params.get('employee') ?? '';
  const service = params.get('service') ?? '';
  const status = params.get('status') ?? '';
  const options = [
    ...new Map(
      days.flatMap((day) => calendarColumns(day, employees, t).map((c) => [c.id, c] as const)),
    ).values(),
  ];
  const href = (date: string, week = true, master = employee) => {
    const query = new URLSearchParams(params.toString());
    query.set('date', date);
    if (week) query.set('view', 'week');
    else query.delete('view');
    if (master) query.set('employee', master);
    else query.delete('employee');
    return `/calendar?${query}`;
  };
  const [query, setQuery] = useState('');
  const narrow = useNarrow();
  // отборы недели в адресе, как у дня: услуга и статус переживают переход «День / Неделя»
  const setParam = (key: 'service' | 'status', value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/calendar?${next}`, { scroll: false });
  };
  const found = (r: BeautyDay['appointments'][number]) => {
    const q = query.trim().toLocaleLowerCase('ru');
    if (!q) return true;
    const digits = q.replace(/\D/g, '');
    return (
      r.customer.name.toLocaleLowerCase('ru').includes(q) ||
      (digits.length >= 3 && (r.customer.phone ?? '').replace(/\D/g, '').includes(digits))
    );
  };
  const visible = (day: BeautyDay) =>
    day.appointments.filter(
      (r) =>
        matchesAppointment(r, employee, service) && (!status || r.status === status) && found(r),
    );
  const services = [
    ...new Map(days.flatMap((day) => day.services.map((sv) => [sv.id, sv] as const))).values(),
  ];
  const serviceFilter = (
    <JournalFilter
      label={t('Услуга')}
      allLabel={t('Все услуги')}
      value={service}
      onChange={(v) => setParam('service', v)}
      options={services.map((sv) => ({ value: sv.id, label: sv.name }))}
    />
  );
  const statusFilter = (
    <JournalFilter
      label={t('Статус записи')}
      allLabel={t('Все статусы')}
      value={status}
      onChange={(v) => setParam('status', v)}
      options={Object.entries(beautyStatus)
        .filter(([key]) => key !== 'CANCELLED')
        .map(([value, st]) => ({ value, label: st.label }))}
    />
  );
  const weekRows = days.flatMap((day) => visible(day)).filter((r) => r.status !== 'CANCELLED');
  const selected = days.find((d) => d.date === selectedDate) ?? days[0]!;
  const first = days[0]!;
  const shift = (delta: number) => {
    const at = new Date(`${first.date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + delta);
    return href(at.toISOString().slice(0, 10));
  };
  return (
    <div data-testid="beauty-week">
      <JournalHead
        title={t('Журнал')}
        subtitle={t('Неделя специалистов')}
        nav={
          <div className="board-period day-nav" role="group" aria-label={t('Неделя журнала')}>
            <DateRangePopover
              from={first.date}
              to={days.at(-1)!.date}
              today={today}
              compact
              onDay={(date) => router.push(href(date))}
              dayPresets={[
                { label: msg('Эта неделя'), date: today },
                { label: msg('Следующая неделя'), date: plusDays(today, 7) },
                { label: msg('День'), onSelect: () => router.push(href(selectedDate, false)) },
              ]}
              triggerTestId="week-nav-button"
            />
            <Link href={shift(-7)} className="icon-button" aria-label={t('Предыдущая неделя')}>
              <Icon name="chevron" className="rotate-left" />
            </Link>
            <Link href={shift(7)} className="icon-button" aria-label={t('Следующая неделя')}>
              <Icon name="chevron" />
            </Link>
          </div>
        }
        actions={
          <>
          <JournalExpandButton />
          <QuickReport
            text={t('Быстрый отчёт')}
            key={`${selected.date}:${employee}`}
            date={selected.date}
            scope={[
              employee
                ? (options.find((e) => e.id === employee)?.name ?? t('Специалист недоступен'))
                : t('Все специалисты'),
              t('Выбранный день'),
              ...(service || status ? [t('С учётом фильтров')] : []),
            ]}
            build={() => beautyQuickReport(visible(selected))}
          />
          {canCreate && (
            <Link
              className="btn"
              prefetch={false}
              href={`${href(selected.date, false)}&new=1`}
            >
              <Icon name="plus" aria-hidden="true" />
              {t('Новая запись')}
            </Link>
          )}
          </>
        }
        summary={
          <SummaryLine
            label={t('Итоги недели')}
            testId="beauty-week-summary"
            parts={[
              { key: 'all', label: t('Записей за неделю'), value: weekRows.length },
              {
                key: 'wait',
                label: t('ждём'),
                value: weekRows.filter((r) => r.status === 'BOOKED' || r.status === 'CONFIRMED')
                  .length,
              },
              {
                key: 'done',
                label: t('завершено'),
                value: weekRows.filter((r) => r.status === 'DONE').length,
              },
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
            {serviceFilter}
            {statusFilter}
            {/* «Фильтры» видны и на компьютере, как в дне и у календаря гостиницы; легенда внутри, как в дне */}
            <Help title={<FiltersTitle active={[service, status].filter(Boolean).length} />}>
              <span className="sr-only">{t('Услуга и статус')}</span>
              <CalendarLegend />
            </Help>
          </>
        }
        views={views}
      />
      {/* неделя как строка месячного календаря (владелец 25.10.2026): семь колонок, день сверху, записи плашками */}
      <div className="beauty-week-calendar" role="list" aria-label={t('Неделя журнала')}>
        {days.map((day) => {
          const masters = new Map(
            calendarColumns(day, employees, t).map((master) => [master.id, master.name]),
          );
          const rows = visible(day).sort(
            (a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id),
          );
          const live = rows.filter((r) => r.status !== 'CANCELLED').length;
          const at = new Date(`${day.date}T12:00:00Z`);
          const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(at);
          return (
            <section
              key={day.date}
              role="listitem"
              className={`beauty-week-day${day.date === today ? ' is-today' : ''}`}
              aria-label={displayDate(day.date, 'full', locale)}
            >
              <Link
                className="beauty-week-day__head"
                href={href(day.date, false)}
                aria-label={t('Открыть день: {date}', { date: displayDate(day.date, 'full', locale) })}
                aria-current={day.date === today ? 'date' : undefined}
              >
                <span className="beauty-week-day__weekday">{weekday}</span>
                <b className="beauty-week-day__num">{Number(day.date.slice(8, 10))}</b>
                {live > 0 && <span className="beauty-week-day__count">{live}</span>}
              </Link>
              {rows.length > 0 && (
                <ul className="beauty-week-appointments">
                  {rows.map((row) => {
                    const who = row.items?.length
                      ? [...new Set(row.items.map((item) => item.employeeName || masters.get(item.employeeId) || t('Специалист недоступен')))].join(', ')
                      : (masters.get(row.employeeId) ?? t('Специалист недоступен'));
                    const what = row.items?.length ? row.items.map((item) => item.serviceName).join(', ') : row.serviceName;
                    return (
                      <li key={row.id}>
                        <Link
                          className={`beauty-week-chip beauty-week-chip--${row.status.toLowerCase()}`}
                          href={`${href(day.date, false)}&appointment=${encodeURIComponent(row.id)}`}
                          title={`${clock(row.startMinutes)}–${clock(row.endMinutes)}, ${row.customer.name}, ${what}, ${who}, ${t(beautyStatus[row.status].label)}`}
                        >
                          <time dateTime={row.startsAt}>{clock(row.startMinutes)}</time>
                          <b>{row.customer.name}</b>
                          <span>{what}</span>
                          <span>{who}</span>
                          <span className="sr-only">{t(beautyStatus[row.status].label)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
