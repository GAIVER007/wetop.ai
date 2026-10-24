'use client';
import Link from 'next/link';
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
import { useLocale, useT } from '../../i18n/locale-provider';
import { intlLocale } from '../../i18n';

export function WeekCalendar({
  days,
  selectedDate,
  employees,
}: {
  days: BeautyDay[];
  selectedDate: string;
  employees: BeautyEmployeeRow[];
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
      <div className="beauty-bar">
        <EmployeeFilter
          options={options}
          value={employee}
          allLabel={t('Все специалисты')}
          kind="specialists"
          onChange={(id) => router.replace(href(selectedDate, true, id), { scroll: false })}
        />
        <Link href={shift(-7)} className="btn btn--secondary">
          {t('Предыдущая неделя')}
        </Link>
        <b>{displayPeriod(first.date, days.at(-1)!.date)}</b>
        <Link href={shift(7)} className="btn btn--secondary">
          {t('Следующая неделя')}
        </Link>
        <QuickReport
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
      </div>
      <CalendarLegend />
      <div className="beauty-week-calendar">
        {days.map((day) => {
          const masters = new Map(
            calendarColumns(day, employees, t).map((master) => [master.id, master.name]),
          );
          const rows = visible(day).sort(
            (a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id),
          );
          return (
            <Panel key={day.date} title={displayDate(day.date, 'full', locale)}>
              <Link className="btn btn--secondary" href={href(day.date, false)}>
                {t('Открыть день')}
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
                                t('Специалист недоступен')}
                            </span>
                          ))
                        ) : (
                          <>
                            <span>{row.serviceName}</span>
                            <span>{masters.get(row.employeeId) ?? t('Специалист недоступен')}</span>
                          </>
                        )}
                        <StatusBadge kind="beauty" value={row.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="beauty-note">{t('Записей нет')}</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
