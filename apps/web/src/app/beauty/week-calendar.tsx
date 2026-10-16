import Link from 'next/link';
import { Panel, StatusBadge } from '../../components/ui';
import type { BeautyDay, BeautyEmployeeRow } from '../../lib/api';
import { displayDate, displayPeriod } from '../../lib/display-date';
import { CalendarLegend } from './calendar-legend';
import { clock } from './time';
import { calendarColumns } from './calendar-columns';

export function WeekCalendar({ days, employees }: { days: BeautyDay[]; employees: BeautyEmployeeRow[] }) {
  const first = days[0]!;
  const shift = (delta: number) => {
    const at = new Date(`${first.date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + delta);
    return `/calendar?date=${at.toISOString().slice(0, 10)}&view=week`;
  };
  return (
    <div data-testid="beauty-week">
      <div className="beauty-bar">
        <Link href={shift(-7)} className="btn btn--secondary">Предыдущая неделя</Link>
        <b>{displayPeriod(first.date, days.at(-1)!.date)}</b>
        <Link href={shift(7)} className="btn btn--secondary">Следующая неделя</Link>
      </div>
      <CalendarLegend />
      <div className="beauty-week-calendar">
        {days.map((day) => {
          const masters = new Map(calendarColumns(day, employees).map((master) => [master.id, master.name]));
          const rows = [...day.appointments].sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));
          return (
            <Panel key={day.date} title={displayDate(day.date, 'full')}>
              <Link className="btn btn--secondary" href={`/calendar?date=${day.date}`}>Открыть день</Link>
              {rows.length ? (
                <ul className="beauty-week-appointments">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <Link href={`/calendar?date=${day.date}&appointment=${encodeURIComponent(row.id)}`}>
                        <time dateTime={row.startsAt}>{clock(row.startMinutes)}–{clock(row.endMinutes)}</time>
                        <b>{row.customer.name}</b>
                        <span>{row.serviceName}</span>
                        <span>{masters.get(row.employeeId) ?? 'Мастер недоступен'}</span>
                        <StatusBadge kind="beauty" value={row.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="beauty-note">Записей нет</p>}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
