'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '../../components/use-confirm';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, EmptyState, Field, Input, Select } from '../../components/ui';
import { pluralRu } from '../../lib/plural';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import { createAppointment, moveAppointment, setAppointmentStatus } from './journal-actions';

/**
 * Журнал записей салона за день (срез B5). Столбцы это мастера филиала, строки время, плитка запись.
 *
 * Пустая клетка это кнопка: по ней открывается форма записи с уже подставленными мастером и временем.
 * Плитка открывает панель записи: перенос, состояние, отмена с вопросом.
 *
 * На телефоне сетки нет: там тот же день списком по времени. Сетка из шести столбцов на 390 px
 * нечитаема, а список отвечает на тот же вопрос «кто и когда придёт».
 */

const STEP = 30;
const PX_PER_MIN = 1.4;

const STATUS_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: 'Записан',
  CONFIRMED: 'Подтверждена',
  DONE: 'Выполнена',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменена',
};

const ACTION_WORD: Record<BeautyAppointmentRow['status'], string> = {
  BOOKED: 'Вернуть в записанные',
  CONFIRMED: 'Подтвердить',
  DONE: 'Выполнена',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменить запись',
};

type Panel =
  | { kind: 'new'; employeeId: string; startsAt: string; label: string }
  | { kind: 'card'; row: BeautyAppointmentRow }
  | null;

export function JournalBoard({ day, readOnly }: { day: BeautyDay; readOnly: boolean }) {
  const [panel, setPanel] = useState<Panel>(null);
  const router = useRouter();
  const canEdit = !readOnly;

  const from = Math.floor(day.bounds.fromMinutes / STEP) * STEP;
  const to = Math.ceil(day.bounds.toMinutes / STEP) * STEP;
  const slots: number[] = [];
  for (let m = from; m < to; m += STEP) slots.push(m);
  const height = (to - from) * PX_PER_MIN;

  const live = day.appointments.filter((a) => a.status !== 'CANCELLED');
  const startsAtOf = (minutes: number) => {
    // местная полночь филиала плюс минуты: на сервер уходит момент, а не «10:30 неизвестно где»
    const [y, m, d] = day.date.split('-').map(Number);
    const guess = Date.UTC(y as number, (m as number) - 1, d as number, 0, minutes);
    const offset = zoneOffsetMs(new Date(guess), day.location.timezone);
    return new Date(Date.UTC(y as number, (m as number) - 1, d as number, 0, minutes) - offset).toISOString();
  };

  return (
    <>
      <div className="beauty-bar">
        <form method="get" action="/beauty" className="beauty-pick">
          <Field label="День">
            <Input type="date" name="date" defaultValue={day.date} data-testid="beauty-day-date" />
          </Field>
          <Button type="submit" tone="secondary">
            Показать
          </Button>
        </form>
        <p role="status" data-testid="beauty-day-summary">
          {live.length === 0
            ? 'Записей на этот день нет'
            : `${pluralRu(live.length, ['запись', 'записи', 'записей'])} на ${pluralRu(day.columns.length, ['мастера', 'мастеров', 'мастеров'])}`}
        </p>
      </div>

      {day.columns.length === 0 ? (
        <EmptyState data-testid="beauty-day-empty" title="В этот день никто не работает">
          Поставьте мастеру график в этом филиале на странице «График», тогда появится сетка дня.
        </EmptyState>
      ) : (
        <>
          <div
            className="beauty-grid-day"
            data-testid="beauty-grid"
            style={{ gridTemplateColumns: `56px repeat(${day.columns.length}, minmax(160px, 220px))` }}
          >
            <div aria-hidden="true" />
            {day.columns.map((column) => (
              <h2 key={`head-${column.id}`} className="beauty-col-head">
                {column.name}
                {column.timeOff && <Badge>Отсутствие</Badge>}
              </h2>
            ))}
            <div className="beauty-hours" style={{ height }} aria-hidden="true">
              {slots.map((m) => (
                <div key={m} className="beauty-hour" style={{ height: STEP * PX_PER_MIN }}>
                  {m % 60 === 0 ? clock(m) : ''}
                </div>
              ))}
            </div>
            {day.columns.map((column) => (
              <div key={column.id} className="beauty-col-body" style={{ height }}>
                  {slots.map((m) => {
                    const works = column.intervals.some(
                      (i) => clockMinutes(i.timeFrom) <= m && m + STEP <= clockMinutes(i.timeTo),
                    );
                    const free =
                      works &&
                      !column.timeOff &&
                      !live.some(
                        (a) => a.employeeId === column.id && a.startMinutes < m + STEP && m < a.endMinutes,
                      );
                    return (
                      <div
                        key={m}
                        className={`beauty-slot${works ? '' : ' beauty-slot--off'}`}
                        style={{ top: (m - from) * PX_PER_MIN, height: STEP * PX_PER_MIN }}
                      >
                        {free && canEdit && (
                          <button
                            type="button"
                            className="beauty-slot-free"
                            aria-label={`${column.name}, ${clock(m)}, свободно`}
                            onClick={() =>
                              setPanel({
                                kind: 'new',
                                employeeId: column.id,
                                startsAt: startsAtOf(m),
                                label: `${column.name}, ${clock(m)}`,
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                  {day.appointments
                    .filter((a) => a.employeeId === column.id && a.status !== 'CANCELLED')
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`beauty-tile beauty-tile--${a.status.toLowerCase()}`}
                        style={{
                          top: (a.startMinutes - from) * PX_PER_MIN,
                          height: Math.max(STEP, a.endMinutes - a.startMinutes) * PX_PER_MIN,
                        }}
                        onClick={() => setPanel({ kind: 'card', row: a })}
                      >
                        <span className="beauty-tile-time">{clock(a.startMinutes)}</span>
                        <span className="beauty-tile-name">{a.customer.name}</span>
                        <span className="beauty-tile-service">{a.serviceName}</span>
                      </button>
                    ))}
              </div>
            ))}
          </div>

          <ol className="beauty-daylist" data-testid="beauty-day-list">
            {live.length === 0 && <li className="beauty-note">Записей на этот день нет</li>}
            {[...live]
              .sort((a, b) => a.startMinutes - b.startMinutes)
              .map((a) => (
                <li key={a.id}>
                  <button type="button" className="beauty-daylist-row" onClick={() => setPanel({ kind: 'card', row: a })}>
                    <strong>{clock(a.startMinutes)}</strong>
                    <span>{a.customer.name}</span>
                    <span className="beauty-note">
                      {a.serviceName}, {day.columns.find((c) => c.id === a.employeeId)?.name ?? 'мастер'}
                    </span>
                  </button>
                </li>
              ))}
          </ol>
        </>
      )}

      <p className="beauty-note" data-testid="beauty-journal-note">
        Чего в салоне пока нет: своего экрана клиентов с историей визитов и денег записи. Запись хранит цену
        на момент записи, но в кассу она ещё не попадает.
      </p>

      <Overlay
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.kind === 'card' ? 'Запись' : `Новая запись: ${panel?.label ?? ''}`}
        drawer
      >
        {panel?.kind === 'new' && (
          <NewAppointmentForm
            day={day}
            employeeId={panel.employeeId}
            startsAt={panel.startsAt}
            onDone={() => {
              setPanel(null);
              router.refresh();
            }}
          />
        )}
        {panel?.kind === 'card' && (
          <AppointmentCard
            day={day}
            row={panel.row}
            canEdit={canEdit}
            onDone={() => {
              setPanel(null);
              router.refresh();
            }}
          />
        )}
      </Overlay>
    </>
  );
}

function NewAppointmentForm({
  day,
  employeeId,
  startsAt,
  onDone,
}: {
  day: BeautyDay;
  employeeId: string;
  startsAt: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createAppointment, null);
  const [error, setError] = useState<string | null>(null);
  const column = day.columns.find((c) => c.id === employeeId);
  const offered = day.services.filter(
    (s) => s.sellable && (!column?.serviceIds.length || column.serviceIds.includes(s.id)),
  );
  const done = Boolean(state?.message) && !state?.error;
  // закрываем панель эффектом, а не прямо в рендере: иначе это побочное действие во время отрисовки
  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <form
      action={action}
      className="beauty-form"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        if (!String(data.get('serviceId') ?? '')) {
          event.preventDefault();
          setError('Выберите услугу');
          return;
        }
        if (!String(data.get('firstName') ?? '').trim()) {
          event.preventDefault();
          setError('Впишите имя клиента');
          return;
        }
        setError(null);
      }}
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <Field label="Услуга">
        <Select name="serviceId" required defaultValue="">
          <option value="" disabled>
            Выберите услугу
          </option>
          {offered.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}, {s.durationMinutes} мин
            </option>
          ))}
        </Select>
      </Field>
      {offered.length === 0 && (
        <p className="beauty-note">
          У этого мастера нет услуг, которые филиал оказывает. Включите услугу в филиале или добавьте её
          мастеру в умения.
        </p>
      )}
      <Field label="Имя клиента">
        <Input name="firstName" required maxLength={100} />
      </Field>
      <Field label={<span>Фамилия <small className="beauty-note">необязательно</small></span>}>
        <Input name="lastName" maxLength={100} />
      </Field>
      <Field label={<span>Телефон <small className="beauty-note">по нему узнаём постоянного клиента</small></span>}>
        <Input name="phone" maxLength={32} />
      </Field>
      <Field label={<span>Заметка <small className="beauty-note">необязательно</small></span>}>
        <Input name="notes" maxLength={2000} />
      </Field>
      {(error ?? state?.error) && <Alert>{error ?? state?.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Записываем…' : 'Записать'}
      </Button>
    </form>
  );
}

function AppointmentCard({
  day,
  row,
  canEdit,
  onDone,
}: {
  day: BeautyDay;
  row: BeautyAppointmentRow;
  canEdit: boolean;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(moveAppointment, null);
  const { ask, dialog } = useConfirm();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const master = day.columns.find((c) => c.id === row.employeeId);
  // поле datetime-local показывает местное время филиала, а на сервер уходит момент: без перевода
  // «13:00» уехало бы в часовом поясе того, кто открыл страницу
  const [localStart, setLocalStart] = useState(() => localInput(row.startsAt, day.location.timezone));
  const moved = Boolean(state?.message) && !state?.error;
  useEffect(() => {
    if (moved) onDone();
  }, [moved, onDone]);

  const change = async (status: BeautyAppointmentRow['status']) => {
    if (status === 'CANCELLED') {
      const ok = await ask({
        title: `Отменить запись: ${row.customer.name}, ${clock(row.startMinutes)}?`,
        body: 'Время мастера освободится. Деньги записи это отдельное решение, их здесь не трогаем.',
        confirmLabel: 'Отменить запись',
        tone: 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await setAppointmentStatus(row.id, status);
      if (result.error) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="beauty-form">
      <dl className="beauty-facts">
        <div>
          <dt>Клиент</dt>
          <dd>
            {row.customer.name}
            {row.customer.phone ? `, ${row.customer.phone}` : ''}
          </dd>
        </div>
        <div>
          <dt>Услуга</dt>
          <dd>{row.serviceName}</dd>
        </div>
        <div>
          <dt>Мастер</dt>
          <dd>{master?.name ?? 'не найден'}</dd>
        </div>
        <div>
          <dt>Время</dt>
          <dd>
            {clock(row.startMinutes)} до {clock(row.endMinutes)}
          </dd>
        </div>
        <div>
          <dt>Состояние</dt>
          <dd data-testid="beauty-card-status">{STATUS_WORD[row.status]}</dd>
        </div>
        {row.notes && (
          <div>
            <dt>Заметка</dt>
            <dd>{row.notes}</dd>
          </div>
        )}
      </dl>

      {canEdit && row.next.length > 0 && (
        <div className="beauty-bar">
          {row.next.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              tone={status === 'CANCELLED' ? 'danger' : 'secondary'}
              disabled={busy}
              onClick={() => void change(status)}
            >
              {ACTION_WORD[status]}
            </Button>
          ))}
        </div>
      )}

      {canEdit && row.next.length > 0 && (
        <form action={action} className="beauty-form">
          <input type="hidden" name="id" value={row.id} />
          <h3>Перенести</h3>
          <Field label="Мастер">
            <Select name="employeeId" defaultValue={row.employeeId}>
              {day.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Начало">
            <Input
              type="datetime-local"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              data-testid="beauty-move-start"
            />
          </Field>
          <input type="hidden" name="startsAt" value={instantOf(localStart, day.location.timezone)} />
          {state?.error && <Alert>{state.error}</Alert>}
          <Button type="submit" tone="secondary" disabled={pending}>
            {pending ? 'Переносим…' : 'Перенести'}
          </Button>
        </form>
      )}

      {error && <Alert>{error}</Alert>}
      {state?.message && !state.error && <p role="status">{state.message}</p>}
      {dialog}
    </div>
  );
}

/** «2026-10-12T13:00» в поясе филиала это какой момент */
function instantOf(local: string, timezone: string): string {
  const naive = Date.parse(`${local}:00Z`);
  if (Number.isNaN(naive)) return '';
  let guess = naive - zoneOffsetMs(new Date(naive), timezone);
  guess = naive - zoneOffsetMs(new Date(guess), timezone);
  return new Date(guess).toISOString();
}

function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function clockMinutes(value: string): number {
  const [hh, mm] = value.split(':');
  return Number(hh) * 60 + Number(mm);
}

/** Насколько местное время филиала впереди UTC в этот момент */
function zoneOffsetMs(at: Date, timezone: string): number {
  const parts = new Map(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return (
    Date.UTC(
      Number(parts.get('year')),
      Number(parts.get('month')) - 1,
      Number(parts.get('day')),
      Number(parts.get('hour')),
      Number(parts.get('minute')),
      Number(parts.get('second')),
    ) - at.getTime()
  );
}

/** Момент в вид для `datetime-local` в поясе филиала */
function localInput(iso: string, timezone: string): string {
  const at = new Date(iso);
  const parts = new Map(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}`;
}
