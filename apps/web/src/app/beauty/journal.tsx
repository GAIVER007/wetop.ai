'use client';
import Link from 'next/link';
import { useOptimistic, useState, useTransition, type ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, EmptyState, Field, Help, Select } from '../../components/ui';
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
  views,
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
  /** «День / Неделя» в строке инструментов рядом с датой (аудит 21.10.2026, п. 34) */
  views?: ReactNode;
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
  // линия «сейчас» только на сегодняшнем дне филиала, минуты по поясу филиала
  const [nowMinutes] = useState<number | null>(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: day.location.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    if (`${get('year')}-${get('month')}-${get('day')}` !== day.date) return null;
    return Number(get('hour')) * 60 + Number(get('minute'));
  });
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
  // запись создать не из чего: нет услуг или специалистов с графиком (аудит 21.10.2026, п. 13, 15, 36)
  const notReady = !columns.length || !day.services.length;
  const nowLine = nowMinutes !== null && nowMinutes >= from && nowMinutes <= to && (
    <div
      className="beauty-now"
      data-testid="beauty-now"
      aria-hidden="true"
      style={{ top: (nowMinutes - from) * PX_PER_MIN }} /* slop-allow: inline-style положение линии «сейчас» */
    />
  );
  const column = (employee: BeautyDayColumn) => (
    <div
      className="beauty-col-body"
      style={{ height }} /* slop-allow: inline-style высота колонки из длины рабочего дня */
    >
      {nowLine}
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
                data-time={`+ ${clock(m)}`}
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
          {views}
          {/* Вид и отчёт: в панели на широком экране, в «Фильтрах» на телефоне (сетка дня на первом экране). */}
          <span className="beauty-calendar-wide">
            <Button tone="secondary" aria-pressed={compact} onClick={() => setCompact(!compact)}>
              Компактный вид
            </Button>
            {/* у кнопки отчёта был только значок: видимая подпись (аудит 21.10.2026, п. 14) */}
            <QuickReport
              text="Быстрый отчёт"
              key={`${day.date}:${master}:wide`}
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
          </span>
          <Button
            disabled={
              filterPending ||
              !canCreate ||
              !day.columns.some((c) => c.id === selected) ||
              !day.services.length
            }
            title={notReady ? 'Сначала добавьте услугу и специалиста с графиком' : undefined}
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
          <div className="beauty-calendar-narrow">
          <Button tone="secondary" aria-pressed={compact} onClick={() => setCompact(!compact)}>
            Компактный вид
          </Button>
          <QuickReport
            key={`${day.date}:${master}:narrow`}
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
          </div>
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
      {notReady && (
        <EmptyState
          role="status"
          className="beauty-setup-empty"
          actions={
            <>
              {!day.services.length && (
                <Link className="btn btn--secondary" href="/services">
                  Добавить услугу
                </Link>
              )}
              {!columns.length && (
                <Link className="btn btn--secondary" href="/employees?new=1">
                  Добавить специалиста
                </Link>
              )}
            </>
          }
        >
          Для новой записи нужны услуги и специалисты с рабочим графиком.
        </EmptyState>
      )}
      {/* без специалистов сетку не рисуем: пустая колонка часов ничего не говорит (п. 36) */}
      {columns.length > 0 && (
      <div className="beauty-layout">
        <div className="beauty-board">
          <div
            className="beauty-grid-day"
            data-testid="beauty-grid"
            role="region"
            aria-label="Расписание дня"
            tabIndex={0}
            style={{
              /* slop-allow: inline-style число колонок из количества выбранных мастеров */
              gridTemplateColumns: `56px repeat(${Math.max(1, shown.length)}, minmax(${shown.length > 6 ? 150 : 180}px, 1fr))`,
            }}
          >
            <div aria-hidden="true" />
            {shown.map((e) => (
              <h2 key={e.id} className="beauty-col-head">
                {/* журнал на весь экран (владелец 20.10.2026): специалист в шапке своей колонки, без списка слева */}
                <button
                  type="button"
                  className="beauty-col-person"
                  aria-pressed={master === e.id}
                  title={master === e.id ? 'Показать всех специалистов' : `Показать только: ${e.name}`}
                  onClick={() => setMaster(master === e.id ? '' : e.id)}
                >
                  <span className="beauty-avatar" aria-hidden="true">
                    {initials(e.name)}
                  </span>
                  <span className="beauty-col-person__name">{e.name}</span>
                  <span className="beauty-col-person__count" data-testid="beauty-col-count">
                    {live.filter((a) => a.employeeId === e.id).length || ''}
                  </span>
                </button>
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
            {shown.map((e) => (
              <div key={e.id}>{column(e)}</div>
            ))}
          </div>
          <div className="beauty-mobile-calendar" data-testid="beauty-mobile-calendar">
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
      )}
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
