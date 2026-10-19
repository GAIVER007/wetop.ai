'use client';
import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, Field, Help, Select } from '../../components/ui';
import type {
  BeautyAppointmentRow,
  BeautyCustomerRow,
  BeautyDay,
  BeautyDayColumn,
  BeautyEmployeeRow,
} from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { AppointmentCard } from './appointment-card';
import { AppointmentEditor } from './appointment-editor';
import { appointmentSegments, calendarColumns, matchesAppointment } from './calendar-columns';
import { DateBar } from './date-bar';
import { clock, clockMinutes, instantOf } from './time';
import { moveAppointment } from './journal-actions';
import { beautyStatus } from '../../lib/status/beauty';
import { CalendarLegend } from './calendar-legend';

const STEP = 30;
type Panel =
  | { kind: 'new'; employeeId: string; time: string }
  | { kind: 'card'; row: BeautyAppointmentRow }
  | null;

export function JournalBoard({
  day,
  customers,
  employees,
  readOnly,
  canCreate = !readOnly,
  canUpdate = !readOnly,
  canPay = !readOnly,
  canRefund = false,
  canIssueReview = false,
  canAdjustPrice = false,
  appointmentId,
  scopeKey = '',
  creationUnavailableReason,
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  employees: BeautyEmployeeRow[];
  readOnly: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canPay?: boolean;
  /** возврат по выполненной записи (§54): право `refunds` */
  canRefund?: boolean;
  canIssueReview?: boolean;
  canAdjustPrice?: boolean;
  appointmentId?: string | undefined;
  scopeKey?: string;
  creationUnavailableReason?: string;
}) {
  const columns = calendarColumns(day, employees);
  const [compact, setCompact] = useState(false);
  const PX_PER_MIN = compact ? 1 : 1.5;
  const [panel, setPanel] = useState<Panel>(() => {
    const row = day.appointments.find((item) => item.id === appointmentId);
    return row ? { kind: 'card', row } : null;
  });
  const params = useSearchParams();
  const pathname = usePathname();
  const [filters, updateFilters] = useOptimistic(
    {
      employee: params.get('employee') ?? '',
      service: params.get('service') ?? '',
      status: params.get('status') ?? '',
    },
    (current, change: Partial<{ employee: string; service: string; status: string }>) => ({
      ...current,
      ...change,
    }),
  );
  const { employee: master, service, status } = filters;
  const selected = master || columns[0]?.id || '';
  const router = useRouter();
  const [filterPending, startFilterTransition] = useTransition();
  const applyFilters = (next: typeof filters) => {
    startFilterTransition(() => {
      updateFilters(next);
      const query = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) query.set(key, value);
        else query.delete(key);
      }
      router.replace(`${pathname}?${query}`, { scroll: false });
    });
  };
  const setFilter = (key: keyof typeof filters, value: string) =>
    applyFilters({ ...filters, [key]: value });
  const setMaster = (value: string) => setFilter('employee', value);
  const setService = (value: string) => setFilter('service', value);
  const setStatus = (value: string) => setFilter('status', value);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moveError, setMoveError] = useState('');
  const [moving, startMove] = useTransition();
  const movable = (row: BeautyAppointmentRow) =>
    canUpdate && !moving && (row.status === 'BOOKED' || row.status === 'CONFIRMED');
  const from = Math.floor(day.bounds.fromMinutes / STEP) * STEP;
  const to = Math.ceil(day.bounds.toMinutes / STEP) * STEP;
  const slots = Array.from({ length: (to - from) / STEP }, (_, i) => from + i * STEP);
  const height = (to - from) * PX_PER_MIN;
  const reportRows = day.appointments.filter(
    (a) => matchesAppointment(a, master, service) && (!status || a.status === status),
  );
  const segments = appointmentSegments(day.appointments);
  const live = reportRows.filter((a) => a.status !== 'CANCELLED');
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
        const occupied = segments.some(
          (a) =>
            a.employeeId === employee.id &&
            a.status !== 'CANCELLED' &&
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
            onDragLeave={() => setDropTarget((current) => (current === target ? null : current))}
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
            {!works &&
              (m === from || employee.intervals.some((i) => clockMinutes(i.timeTo) === m)) && (
                <span className="beauty-slot-state">Вне графика</span>
              )}
            {works && !occupied && (
              <button
                type="button"
                className="beauty-slot-free"
                disabled={!canCreate}
                aria-label={`${employee.name}, ${clock(m)}, свободно`}
                onClick={() => setPanel({ kind: 'new', employeeId: employee.id, time: clock(m) })}
              />
            )}
          </div>
        );
      })}
      {segments
        .filter(
          (a) =>
            a.employeeId === employee.id &&
            a.status !== 'CANCELLED' &&
            a.status !== 'NO_SHOW' &&
            !live.some((visible) => visible.id === a.id),
        )
        .map((a) => (
          <div
            key={`hidden-${a.segmentKey}`}
            className="beauty-tile beauty-tile--hidden"
            style={{
              /* slop-allow: inline-style положение и высота скрытой записи из минут визита */
              top: (a.startMinutes - from) * PX_PER_MIN,
              height: Math.max(24, a.endMinutes - a.startMinutes) * PX_PER_MIN,
            }}
          >
            <span>
              {clock(a.startMinutes)}–{clock(a.endMinutes)}
            </span>
            <strong>Занято, скрыто фильтром</strong>
          </div>
        ))}
      {appointmentSegments(live)
        .filter((a) => a.employeeId === employee.id)
        .map((a) => (
          <button
            key={a.segmentKey}
            type="button"
            draggable={movable(a) && a.startsAt === a.appointment.startsAt}
            onDragStart={(event) => {
              if (!movable(a) || a.startsAt !== a.appointment.startsAt) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', a.id);
              setDragged(a.id);
              setMoveError('');
            }}
            onDragEnd={() => {
              setDragged(null);
              setDropTarget(null);
            }}
            className={`beauty-tile beauty-tile--${a.status.toLowerCase()}`}
            style={{
              top: (a.startMinutes - from) * PX_PER_MIN,
              height: Math.max(24, a.endMinutes - a.startMinutes) * PX_PER_MIN,
            }}
            title={`${clock(a.startMinutes)}–${clock(a.endMinutes)}, ${a.customer.name}, ${a.serviceName}, ${formatMoney(a.priceMinor, a.currency)}, ${beautyStatus[a.status].label}`}
            onClick={() => setPanel({ kind: 'card', row: a.appointment })}
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
    <div className="beauty-hours" style={/* slop-allow: inline-style высота шкалы из минут расписания */ { height }} aria-hidden="true">
      {slots.map((m) => (
        <div key={m} className="beauty-hour" style={/* slop-allow: inline-style высота шага из минут расписания */ { height: STEP * PX_PER_MIN }}>
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
      aria-label="Расписание без назначенных специалистов"
    >
      {slots.map((m) => (
        <div
          key={m}
          className="beauty-slot"
          style={
            /* slop-allow: inline-style положение клетки из минуты рабочего дня */ {
              top: (m - from) * PX_PER_MIN,
              height: STEP * PX_PER_MIN,
            }
          }
        />
      ))}
    </div>
  );
  return (
    <>
      <div className="beauty-bar beauty-calendar-toolbar">
        <div className="beauty-calendar-actions">
          <EmployeeFilter
            options={columns}
            value={master}
            onChange={setMaster}
            allLabel="Все специалисты"
            kind="specialists"
          />
          <DateBar date={day.date} path="/calendar" filters={filters} />
          <Button tone="secondary" aria-pressed={compact} onClick={() => setCompact(!compact)}>
            Компактный вид
          </Button>
          <QuickReport
            key={`${day.date}:${master}`}
            date={day.date}
            scope={[
              day.location.name ?? 'Салон',
              master
                ? (columns.find((c) => c.id === master)?.name ?? 'Специалист недоступен')
                : 'Все специалисты',
              ...(service || status ? ['С учётом фильтров журнала'] : []),
            ]}
            build={() => beautyQuickReport(reportRows)}
          />
          <Button
            disabled={
              filterPending ||
              !canCreate ||
              !day.columns.some((c) => c.id === selected) ||
              !day.services.length
            }
            onClick={() =>
              setPanel({ kind: 'new', employeeId: selected, time: clock(day.bounds.fromMinutes) })
            }
          >
            + Новая запись
          </Button>
        </div>
        <Help
          title={`Фильтры${master || service || status ? `\nАктивных: ${[master, service, status].filter(Boolean).length}` : ''}`}
        >
          <div className="beauty-filters">
            <Field label={<span>Услуга</span>}>
              <Select
                aria-label="Услуга"
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                <option value="">Все услуги</option>
                {day.services.map((sv) => (
                  <option key={sv.id} value={sv.id}>
                    {sv.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<span>Статус</span>}>
              <Select
                aria-label="Статус записи"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Все статусы</option>
                {Object.entries(beautyStatus)
                  .filter(([key]) => key !== 'CANCELLED')
                  .map(([key, st]) => (
                    <option key={key} value={key}>
                      {st.label}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <CalendarLegend />
          <p className="beauty-note">
            Свободно: пустая клетка. Вне графика: нет доступной кнопки. Скрытые занятые интервалы
            обозначены текстом.
          </p>
        </Help>
      </div>
      {(master || service || status) && (
        <div className="beauty-active-filters" role="status">
          <span>
            {[
              columns.find((c) => c.id === master)?.name,
              day.services.find((s) => s.id === service)?.name,
              status ? beautyStatus[status as keyof typeof beautyStatus]?.label : '',
            ]
              .filter(Boolean)
              .map((label, index) => (
                <span className="beauty-selection-line" key={index}>
                  {label}
                </span>
              ))}
          </span>
          <Button
            tone="secondary"
            onClick={() => {
              applyFilters({ employee: '', service: '', status: '' });
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      )}
      <p className="beauty-note" data-testid="beauty-day-summary">
        {live.length
          ? `Записей: ${live.length}`
          : service || status || master
            ? 'По выбранным фильтрам записей не найдено'
            : 'Записей на этот день нет'}
      </p>
      {creationUnavailableReason && <Alert>{creationUnavailableReason}</Alert>}
      {moving && <p role="status">Переносим запись…</p>}
      {moveError && <Alert>{moveError}</Alert>}
      {(!columns.length || !day.services.length) && (
        <p className="beauty-note" role="status">
          Для новой записи нужны услуги и специалисты с рабочим графиком.{' '}
          {!day.services.length && <Link href="/services">Добавить услугу</Link>}{' '}
          {!columns.length && <Link href="/employees">Добавить специалиста</Link>}
        </p>
      )}
      <div className="beauty-layout">
        {!!columns.length && (
          <aside className="beauty-masters" aria-label="Специалисты">
            <h2 className="beauty-masters__title">Специалисты</h2>
            <ul>
              <li>
                <button type="button" aria-pressed={!master} onClick={() => setMaster('')}>
                  <span className="beauty-avatar beauty-avatar--all" aria-hidden="true">
                    {columns.length}
                  </span>
                  <span>
                    Все специалисты <small>({columns.length})</small>
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
                          : c.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') ||
                            'Выходной'}
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
              /* slop-allow: inline-style число колонок из количества выбранных мастеров */
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
            {columns
              .filter((e) => e.id === selected)
              .map((e) => (
                <div key={e.id}>
                  <p className="beauty-current-master">{e.name}</p>
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
        </div>
      </div>
      <AppointmentEditor
        canAdjustPrice={canAdjustPrice}
        open={canCreate && panel?.kind === 'new'}
        onClose={() => setPanel(null)}
        day={day}
        customers={customers}
        scopeKey={scopeKey}
        employeeId={panel?.kind === 'new' ? panel.employeeId : selected}
        time={panel?.kind === 'new' ? panel.time : clock(day.bounds.fromMinutes)}
        onDone={done}
      />
      <Overlay
        open={panel?.kind === 'card'}
        onClose={() => setPanel(null)}
        title={panel?.kind === 'card' ? 'Запись' : 'Новая запись'}
        size="lg"
        className="appointment-card-modal"
      >
        {panel?.kind === 'card' && (
          <AppointmentCard
            canAdjustPrice={canAdjustPrice}
            scopeKey={scopeKey}
            day={{ ...day, columns }}
            row={panel.row}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canPay={canPay}
            canRefund={canRefund}
            canIssueReview={canIssueReview}
            onDone={done}
          />
        )}
      </Overlay>
    </>
  );
}
