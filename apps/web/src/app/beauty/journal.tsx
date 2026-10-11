'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Badge, Button, EmptyState, Field, Select } from '../../components/ui';
import type {
  BeautyAppointmentRow,
  BeautyCustomerRow,
  BeautyDay,
  BeautyDayColumn,
  BeautyEmployeeRow,
} from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { AppointmentCard } from './appointment-card';
import { AppointmentForm } from './appointment-form';
import { calendarColumns } from './calendar-columns';
import { DateBar } from './date-bar';
import { clock, clockMinutes } from './time';
import { beautyStatus } from '../../lib/status/beauty';

const STEP = 30;
const PX_PER_MIN = 1.5;
type Panel =
  | { kind: 'new'; employeeId: string; time: string }
  | { kind: 'card'; row: BeautyAppointmentRow }
  | null;

export function JournalBoard({
  day,
  customers,
  employees,
  readOnly,
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  employees: BeautyEmployeeRow[];
  readOnly: boolean;
}) {
  const columns = calendarColumns(day, employees);
  const [panel, setPanel] = useState<Panel>(null);
  const [chosen, setSelected] = useState(columns[0]?.id ?? '');
  const selected = columns.some((column) => column.id === chosen) ? chosen : (columns[0]?.id ?? '');
  const router = useRouter();
  const from = Math.floor(day.bounds.fromMinutes / STEP) * STEP;
  const to = Math.ceil(day.bounds.toMinutes / STEP) * STEP;
  const slots = Array.from({ length: (to - from) / STEP }, (_, i) => from + i * STEP);
  const height = (to - from) * PX_PER_MIN;
  const live = day.appointments.filter((a) => a.status !== 'CANCELLED');
  const done = () => {
    setPanel(null);
    router.refresh();
  };
  const column = (employee: BeautyDayColumn) => (
    <div className="beauty-col-body" style={{ height }}>
      {slots.map((m) => {
        const works =
          !employee.timeOff &&
          employee.intervals.some(
            (i) => clockMinutes(i.timeFrom) <= m && m + STEP <= clockMinutes(i.timeTo),
          );
        const occupied = live.some(
          (a) =>
            a.employeeId === employee.id &&
            a.status !== 'NO_SHOW' &&
            a.startMinutes < m + STEP &&
            m < a.endMinutes,
        );
        return (
          <div
            key={m}
            className={`beauty-slot${works ? '' : ' beauty-slot--off'}`}
            style={{ top: (m - from) * PX_PER_MIN, height: STEP * PX_PER_MIN }}
          >
            {works && !occupied && (
              <button
                type="button"
                className="beauty-slot-free"
                disabled={readOnly}
                aria-label={`${employee.name}, ${clock(m)}, свободно`}
                onClick={() => setPanel({ kind: 'new', employeeId: employee.id, time: clock(m) })}
              />
            )}
          </div>
        );
      })}
      {live
        .filter((a) => a.employeeId === employee.id)
        .map((a) => (
          <button
            key={a.id}
            type="button"
            className={`beauty-tile beauty-tile--${a.status.toLowerCase()}`}
            style={{
              top: (a.startMinutes - from) * PX_PER_MIN,
              height: Math.max(24, a.endMinutes - a.startMinutes) * PX_PER_MIN,
            }}
            title={`${clock(a.startMinutes)}–${clock(a.endMinutes)}, ${a.customer.name}, ${a.serviceName}, ${formatMoney(a.priceMinor, a.currency)}, ${beautyStatus[a.status].label}`}
            onClick={() => setPanel({ kind: 'card', row: a })}
          >
            <span className="beauty-tile-time">
              {clock(a.startMinutes)}–{clock(a.endMinutes)}
            </span>
            <strong className="beauty-tile-name">{a.customer.name}</strong>
            <span className="beauty-tile-service">{a.serviceName}</span>
            <span className="beauty-tile-service">
              {formatMoney(a.priceMinor, a.currency)} / {beautyStatus[a.status].label}
            </span>
          </button>
        ))}
    </div>
  );
  const hours = (
    <div className="beauty-hours" style={{ height }} aria-hidden="true">
      {slots.map((m) => (
        <div key={m} className="beauty-hour" style={{ height: STEP * PX_PER_MIN }}>
          {clock(m)}
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div className="beauty-bar">
        <DateBar date={day.date} path="/calendar" />
        <Button
          disabled={readOnly || !day.columns.length || !day.services.length}
          onClick={() => setPanel({ kind: 'new', employeeId: selected, time: '09:00' })}
        >
          + Новая запись
        </Button>
      </div>
      <p className="beauty-note" data-testid="beauty-day-summary">
        {live.length ? `Записей: ${live.length}` : 'Записей на этот день нет'} /{' '}
        {day.location.timezone}
      </p>
      {!live.length && (!columns.length || !day.services.length) ? (
        <EmptyState
          title="Пока нечего показывать"
          actions={
            <Link className="btn btn--secondary" href="/services">
              Добавить услугу
            </Link>
          }
        >
          Добавьте услуги и мастеров, чтобы начать принимать записи.
        </EmptyState>
      ) : (
        <>
          <div
            className="beauty-grid-day"
            data-testid="beauty-grid"
            style={{
              gridTemplateColumns: `56px repeat(${columns.length}, minmax(180px, 1fr))`,
            }}
          >
            <div aria-hidden="true" />
            {columns.map((e) => (
              <h2 key={e.id} className="beauty-col-head">
                {e.name}
                <small>
                  {e.timeOff ? (
                    <Badge>{e.timeOffReason || 'Отсутствие'}</Badge>
                  ) : e.intervals.length ? (
                    e.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ')
                  ) : (
                    'Выходной'
                  )}
                </small>
              </h2>
            ))}
            {hours}
            {columns.map((e) => (
              <div key={e.id}>{column(e)}</div>
            ))}
          </div>
          <div className="beauty-mobile-calendar" data-testid="beauty-mobile-calendar">
            <Field label="Мастер календаря">
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {columns.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.timeOff ? ' (отсутствие)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {columns
              .filter((e) => e.id === selected)
              .map((e) => (
                <div key={e.id}>
                  <p className="beauty-note">
                    {e.timeOff
                      ? e.timeOffReason || 'Отсутствие'
                      : e.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') ||
                        'Выходной'}
                  </p>
                  <div className="beauty-mobile-timeline">
                    {hours}
                    {column(e)}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
      <Overlay
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.kind === 'card' ? 'Запись' : 'Новая запись'}
        drawer
      >
        {panel?.kind === 'new' && (
          <AppointmentForm
            day={day}
            customers={customers}
            employeeId={panel.employeeId}
            time={panel.time}
            onDone={done}
          />
        )}
        {panel?.kind === 'card' && (
          <AppointmentCard
            day={{ ...day, columns }}
            row={panel.row}
            canEdit={!readOnly}
            onDone={done}
          />
        )}
      </Overlay>
    </>
  );
}
