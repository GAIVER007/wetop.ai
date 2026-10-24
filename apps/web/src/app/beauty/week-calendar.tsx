'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { JournalHead } from '../../components/journal-head';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Panel, StatusBadge } from '../../components/ui';
import type { BeautyDay, BeautyEmployeeRow } from '../../lib/api';
import { displayDate, displayPeriod } from '../../lib/display-date';
import { CalendarLegend } from './calendar-legend';
import { clock } from './time';
import { calendarColumns, matchesAppointment } from './calendar-columns';

export function WeekCalendar({
  days,
  selectedDate,
  employees,
  views,
}: {
  /** «День / Неделя» в строке отборов единой шапки */
  views?: ReactNode;
  days: BeautyDay[];
  selectedDate: string;
  employees: BeautyEmployeeRow[];
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
  const visible = (day: BeautyDay) =>
    day.appointments.filter(
      (r) => matchesAppointment(r, employee, service) && (!status || r.status === status),
    );
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
            <b className="day-nav__label">{displayPeriod(first.date, days.at(-1)!.date)}</b>
            <Link href={shift(-7)} className="icon-button" aria-label="Предыдущая неделя">
              <Icon name="chevron" className="rotate-left" />
            </Link>
            <Link href={shift(7)} className="icon-button" aria-label="Следующая неделя">
              <Icon name="chevron" />
            </Link>
          </div>
        }
        actions={
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
        }
        filters={
          <>
            <EmployeeFilter
              options={options}
              value={employee}
              allLabel="Все специалисты"
              kind="specialists"
              onChange={(id) => router.replace(href(selectedDate, true, id), { scroll: false })}
            />
            {views}
          </>
        }
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
