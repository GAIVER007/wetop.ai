'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { JournalFilter, JournalHead, JournalSearch } from '../../components/journal-head';
import { DateRangePopover } from '../../components/date-range-popover';
import { SummaryLine } from '../../lib/summary-line';
import { useNarrow } from '../../lib/use-narrow';
import { beautyStatus } from '../../lib/status/beauty';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { JournalExpandButton } from '../../components/journal-expand';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Help, Panel, StatusBadge } from '../../components/ui';
import type { BeautyDay, BeautyEmployeeRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { CalendarLegend } from './calendar-legend';
import { clock } from './time';
import { calendarColumns, matchesAppointment } from './calendar-columns';

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
  today = new Date().toISOString().slice(0, 10),
}: {
  /** «День / Неделя» в строке отборов единой шапки */
  views?: ReactNode;
  days: BeautyDay[];
  selectedDate: string;
  employees: BeautyEmployeeRow[];
  /** сегодня по поясу филиала: быстрые недели в окне выбора */
  today?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const employee = params.get('employee') ?? '';
  const service = params.get('service') ?? '';
  const status = params.get('status') ?? '';
  const options = [
    ...new Map(
      days.flatMap((day) => calendarColumns(day, employees).map((c) => [c.id, c] as const)),
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
      label="Услуга"
      allLabel="Все услуги"
      value={service}
      onChange={(v) => setParam('service', v)}
      options={services.map((sv) => ({ value: sv.id, label: sv.name }))}
    />
  );
  const statusFilter = (
    <JournalFilter
      label="Статус записи"
      allLabel="Все статусы"
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
        title="Журнал"
        subtitle="Неделя специалистов"
        nav={
          <div className="board-period day-nav" role="group" aria-label="Неделя журнала">
            <DateRangePopover
              from={first.date}
              to={days.at(-1)!.date}
              today={today}
              compact
              onDay={(date) => router.push(href(date))}
              dayPresets={[
                { label: 'Эта неделя', date: today },
                { label: 'Следующая неделя', date: plusDays(today, 7) },
                { label: 'День', onSelect: () => router.push(href(selectedDate, false)) },
              ]}
              triggerTestId="week-nav-button"
            />
            <Link href={shift(-7)} className="icon-button" aria-label="Предыдущая неделя">
              <Icon name="chevron" className="rotate-left" />
            </Link>
            <Link href={shift(7)} className="icon-button" aria-label="Следующая неделя">
              <Icon name="chevron" />
            </Link>
          </div>
        }
        actions={
          <>
          <JournalExpandButton />
          <QuickReport
            text="Быстрый отчёт"
            key={`${selected.date}:${employee}`}
            date={selected.date}
            scope={[
              employee
                ? (options.find((e) => e.id === employee)?.name ?? 'Специалист недоступен')
                : 'Все специалисты',
              'Выбранный день',
              ...(service || status ? ['С учётом фильтров'] : []),
            ]}
            build={() => beautyQuickReport(visible(selected))}
          />
          </>
        }
        summary={
          <SummaryLine
            label="Итоги недели"
            testId="beauty-week-summary"
            parts={[
              { key: 'all', label: 'Записей за неделю', value: weekRows.length },
              {
                key: 'wait',
                label: 'ждём',
                value: weekRows.filter((r) => r.status === 'BOOKED' || r.status === 'CONFIRMED')
                  .length,
              },
              {
                key: 'done',
                label: 'завершено',
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
              label="Поиск в журнале"
              placeholder={narrow ? 'Клиент' : 'Клиент, телефон'}
            />
            <EmployeeFilter
              options={options}
              value={employee}
              allLabel="Все специалисты"
              kind="specialists"
              onChange={(id) => router.replace(href(selectedDate, true, id), { scroll: false })}
            />
            {serviceFilter}
            {statusFilter}
            <span className="journal-head__phone-only">
              <Help
                title={`Фильтры${service || status ? `\nАктивных: ${[service, status].filter(Boolean).length}` : ''}`}
              >
                <span className="sr-only">Услуга и статус</span>
              </Help>
            </span>
          </>
        }
        views={views}
      />
      <CalendarLegend />
      <div className="beauty-week-calendar">
        {days.map((day) => {
          const masters = new Map(
            calendarColumns(day, employees).map((master) => [master.id, master.name]),
          );
          const rows = visible(day).sort(
            (a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id),
          );
          return (
            <Panel key={day.date} title={displayDate(day.date, 'full')}>
              <Link className="btn btn--secondary" href={href(day.date, false)}>
                Открыть день
              </Link>
              {rows.length ? (
                <ul className="beauty-week-appointments">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`${href(day.date, false)}&appointment=${encodeURIComponent(row.id)}`}
                      >
                        <time dateTime={row.startsAt}>
                          {clock(row.startMinutes)}–{clock(row.endMinutes)}
                        </time>
                        <b>{row.customer.name}</b>
                        {row.items?.length ? (
                          row.items.map((item) => (
                            <span key={item.id}>
                              {clock(item.startMinutes)}–{clock(item.endMinutes)} ·{' '}
                              {item.serviceName} ·{' '}
                              {item.employeeName ||
                                masters.get(item.employeeId) ||
                                'Специалист недоступен'}
                            </span>
                          ))
                        ) : (
                          <>
                            <span>{row.serviceName}</span>
                            <span>{masters.get(row.employeeId) ?? 'Специалист недоступен'}</span>
                          </>
                        )}
                        <StatusBadge kind="beauty" value={row.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="beauty-note">Записей нет</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
