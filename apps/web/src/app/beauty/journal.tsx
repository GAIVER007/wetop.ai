'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, Field, Select } from '../../components/ui';
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
import { clock, clockMinutes, instantOf } from './time';
import { moveAppointment } from './journal-actions';
import { beautyStatus } from '../../lib/status/beauty';
import { CalendarLegend } from './calendar-legend';

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
  appointmentId,
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  employees: BeautyEmployeeRow[];
  readOnly: boolean;
  appointmentId?: string | undefined;
}) {
  const columns = calendarColumns(day, employees);
  const [panel, setPanel] = useState<Panel>(() => {
    const row = day.appointments.find((item) => item.id === appointmentId);
    return row ? { kind: 'card', row } : null;
  });
  const [chosen, setSelected] = useState(columns[0]?.id ?? '');
  // отборы эталона владельца (13.10.2026): мастер в колонке слева, услуга и статус в строке над сеткой
  const [master, setMaster] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const selected = columns.some((column) => column.id === chosen) ? chosen : (columns[0]?.id ?? '');
  const router = useRouter();
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moveError, setMoveError] = useState('');
  const [moving, startMove] = useTransition();
  const movable = (row: BeautyAppointmentRow) => !readOnly && !moving &&
    (row.status === 'BOOKED' || row.status === 'CONFIRMED');
  const from = Math.floor(day.bounds.fromMinutes / STEP) * STEP;
  const to = Math.ceil(day.bounds.toMinutes / STEP) * STEP;
  const slots = Array.from({ length: (to - from) / STEP }, (_, i) => from + i * STEP);
  const height = (to - from) * PX_PER_MIN;
  const live = day.appointments.filter(
    (a) =>
      a.status !== 'CANCELLED' &&
      (!service || a.serviceId === service) &&
      (!status || a.status === status),
  );
  const shown = master ? columns.filter((c) => c.id === master) : columns;
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  const done = () => {
    setPanel(null);
    router.refresh();
  };
  const column = (employee: BeautyDayColumn) => (
    <div
      className="beauty-col-body"
      style={{ height }} /* slop-allow: inline-style высота колонки из длины рабочего дня */
    >
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
        const slot = { top: (m - from) * PX_PER_MIN, height: STEP * PX_PER_MIN };
        const target = `${employee.id}:${m}`;
        const draggedRow = day.appointments.find((row) => row.id === dragged);
        const canDrop = works && !occupied && draggedRow && movable(draggedRow);
        return (
          <div
            key={m}
            className={`beauty-slot${works ? '' : ' beauty-slot--off'}${dropTarget === target ? ' beauty-slot--drop' : ''}`}
            style={slot} /* slop-allow: inline-style место слота из минут расписания */
            onDragOver={(event) => {
              if (!canDrop) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget(target);
            }}
            onDragLeave={() => setDropTarget((current) => current === target ? null : current)}
            onDrop={(event) => {
              if (!canDrop) return;
              event.preventDefault();
              setDragged(null);
              setDropTarget(null);
              setMoveError('');
              const form = new FormData();
              form.set('id', draggedRow.id);
              form.set('employeeId', employee.id);
              form.set('startsAt', instantOf(`${day.date}T${clock(m)}`, day.location.timezone));
              startMove(async () => {
                const result = await moveAppointment(null, form);
                if (result.error) setMoveError(result.error);
                else router.refresh();
              });
            }}
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
            draggable={movable(a)}
            onDragStart={(event) => {
              if (!movable(a)) { event.preventDefault(); return; }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', a.id);
              setDragged(a.id);
              setMoveError('');
            }}
            onDragEnd={() => { setDragged(null); setDropTarget(null); }}
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
  const emptyTimeline = (
    <div
      className="beauty-col-body"
      style={/* slop-allow: inline-style высота пустой шкалы из границ рабочего дня */ { height }}
      data-testid="beauty-empty-timeline"
      role="group"
      aria-label="Расписание без назначенных мастеров"
    >
      {slots.map((m) => (
        <div
          key={m}
          className="beauty-slot"
          style={/* slop-allow: inline-style положение клетки из минуты рабочего дня */ { top: (m - from) * PX_PER_MIN, height: STEP * PX_PER_MIN }}
        />
      ))}
    </div>
  );
  return (
    <>
      <div className="beauty-bar">
        <div className="beauty-filters">
          <Select
            aria-label="Мастер"
            value={master}
            onChange={(e) => setMaster(e.target.value)}
          >
            <option value="">Все мастера</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Услуга" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Все услуги</option>
            {day.services.map((sv) => (
              <option key={sv.id} value={sv.id}>
                {sv.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Статус записи" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            {Object.entries(beautyStatus)
              .filter(([key]) => key !== 'CANCELLED')
              .map(([key, st]) => (
                <option key={key} value={key}>
                  {st.label}
                </option>
              ))}
          </Select>
        </div>
        <DateBar date={day.date} path="/calendar" />
        <Button
          disabled={readOnly || !day.columns.length || !day.services.length}
          onClick={() =>
            setPanel({ kind: 'new', employeeId: selected, time: clock(day.bounds.fromMinutes) })
          }
        >
          + Новая запись
        </Button>
      </div>
      <p className="beauty-note" data-testid="beauty-day-summary">
        {live.length ? `Записей: ${live.length}` : 'Записей на этот день нет'}
      </p>
      <CalendarLegend />
      {moving && <p role="status">Переносим запись…</p>}
      {moveError && <Alert>{moveError}</Alert>}
      {(!columns.length || !day.services.length) && (
        <p className="beauty-note" role="status">
          Для новой записи нужны услуги и мастера с рабочим графиком.{' '}
          {!day.services.length && <Link href="/services">Добавить услугу</Link>}{' '}
          {!columns.length && <Link href="/employees">Добавить мастера</Link>}
        </p>
      )}
      <div className="beauty-layout">
        {!!columns.length && (
          <aside className="beauty-masters" aria-label="Мастера">
            <h2 className="beauty-masters__title">Мастера</h2>
            <ul>
              <li>
                <button type="button" aria-pressed={!master} onClick={() => setMaster('')}>
                  <span className="beauty-avatar beauty-avatar--all" aria-hidden="true">
                    {columns.length}
                  </span>
                  <span>
                    Все мастера <small>({columns.length})</small>
                  </span>
                </button>
              </li>
              {columns.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={master === c.id}
                    onClick={() => setMaster(master === c.id ? '' : c.id)}
                  >
                    <span className="beauty-avatar" aria-hidden="true">
                      {initials(c.name)}
                    </span>
                    <span>
                      {c.name}
                      <small>
                        {c.timeOff
                          ? c.timeOffReason || 'Отсутствие'
                          : c.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') || 'Выходной'}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <div className="beauty-board">
        <div
          className="beauty-grid-day"
          data-testid="beauty-grid"
          role="region"
          aria-label="Расписание дня"
          tabIndex={0}
          style={{
            gridTemplateColumns: `56px repeat(${Math.max(1, shown.length)}, minmax(180px, 1fr))`,
          }}
        >
          <div aria-hidden="true" />
          {!columns.length && <h2 className="beauty-col-head">Расписание дня</h2>}
          {shown.map((e) => (
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
          {!columns.length && emptyTimeline}
          {shown.map((e) => (
            <div key={e.id}>{column(e)}</div>
          ))}
        </div>
        <div className="beauty-mobile-calendar" data-testid="beauty-mobile-calendar">
          {!columns.length && (
            <div className="beauty-mobile-timeline">
              {hours}
              {emptyTimeline}
            </div>
          )}
          {!!columns.length && (
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
          )}
          {columns
            .filter((e) => e.id === selected)
            .map((e) => (
              <div key={e.id}>
                <p className="beauty-note">
                  {e.timeOff
                    ? e.timeOffReason || 'Отсутствие'
                    : e.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') || 'Выходной'}
                </p>
                <div className="beauty-mobile-timeline">
                  {hours}
                  {column(e)}
                </div>
              </div>
            ))}
        </div>
        </div>
      </div>
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
