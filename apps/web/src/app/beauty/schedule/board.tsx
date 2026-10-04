'use client';
import { useActionState, useState, useTransition } from 'react';
import { parseTimeOffInput, parseWorkingHoursWeek } from '@pms/domain';
import { useConfirm } from '../../../components/use-confirm';
import { Overlay } from '../../../components/overlay';
import { Alert, Button, EmptyState, Field, Input, Select, Table } from '../../../components/ui';
import { pluralRu } from '../../../lib/plural';
import type { BeautySchedule, BeautyWorkingInterval } from '../../../lib/api';
import {
  addBeautyTimeOff,
  removeBeautyTimeOff,
  saveBeautyEmployeeLocations,
  saveBeautyWorkingHours,
} from '../actions';

/**
 * График мастера (срез B4, Q-251): неделя в этом филиале, отсутствия и филиалы мастера.
 *
 * Неделя уходит на сервер одним списком интервалов: он заменяет прежний график, поэтому убранная строка
 * убирается, а не копится. Проверка перед отправкой идёт тем же разбором домена, что и на сервере, чтобы
 * ввод не стирался отказом (так же сделано в срезах SET3 и B3).
 */

const DAYS: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  0: 'Воскресенье',
};

type Slot = { timeFrom: string; timeTo: string };

export function ScheduleBoard({ data, canEdit }: { data: BeautySchedule; canEdit: boolean }) {
  const [editing, setEditing] = useState<'week' | 'timeOff' | 'locations' | null>(null);
  const master = data.employee;

  if (!master)
    return (
      <EmptyState data-testid="beauty-schedule-empty" title="Мастеров пока нет">
        Сначала добавьте мастера на странице «Мастера», потом поставьте ему график.
      </EmptyState>
    );

  const hours = data.week.reduce((sum, day) => sum + minutesOf(day.intervals), 0);
  return (
    <>
      <form className="beauty-pick" method="get" action="/beauty/schedule">
        <Field label="Мастер">
          <Select name="employee" defaultValue={master.id} data-testid="beauty-schedule-master">
            {data.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.active ? '' : ' (в архиве)'}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" tone="secondary">
          Показать
        </Button>
      </form>

      <p role="status" data-testid="beauty-schedule-summary">
        {master.worksHere
          ? hours === 0
            ? 'График в этом филиале не задан: мастер здесь не принимает'
            : `В неделю ${weekText(hours)} в этом филиале`
          : 'Мастер в этом филиале не работает: поставьте его в филиал, тогда появится график'}
      </p>

      <section className="beauty-section">
        <div className="beauty-bar">
          <h2>Неделя</h2>
          {canEdit && master.worksHere && (
            <Button type="button" onClick={() => setEditing('week')}>
              Изменить график
            </Button>
          )}
        </div>
        <Table className="beauty-week-table">
          <thead>
            <tr>
              <th>День</th>
              <th>Работает</th>
            </tr>
          </thead>
          <tbody>
            {data.week.map((day) => (
              <tr key={day.weekday}>
                <td>{DAYS[day.weekday]}</td>
                <td>
                  {day.intervals.length === 0
                    ? 'Выходной'
                    : day.intervals.map((i) => `${i.timeFrom} до ${i.timeTo}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section className="beauty-section">
        <div className="beauty-bar">
          <h2>Отсутствия</h2>
          {canEdit && (
            <Button type="button" tone="secondary" onClick={() => setEditing('timeOff')}>
              Добавить отсутствие
            </Button>
          )}
        </div>
        <p className="beauty-note">
          Отсутствие ставится на всю сеть: мастера нет ни в одном филиале. Уже созданные записи оно не
          отменяет, их показывает отдельно.
        </p>
        {data.timeOffs.length === 0 ? (
          <p data-testid="beauty-timeoffs-empty">Отсутствий впереди нет</p>
        ) : (
          <TimeOffTable employeeId={master.id} rows={data.timeOffs} canEdit={canEdit} />
        )}
      </section>

      <section className="beauty-section">
        <div className="beauty-bar">
          <h2>Филиалы мастера</h2>
          {canEdit && data.locations.length > 0 && (
            <Button type="button" tone="secondary" onClick={() => setEditing('locations')}>
              Изменить филиалы
            </Button>
          )}
        </div>
        <p data-testid="beauty-schedule-locations">
          {data.locations.filter((l) => l.assigned).length === 0
            ? 'Мастер пока не поставлен ни в один филиал'
            : data.locations
                .filter((l) => l.assigned)
                .map((l) => l.name)
                .join(', ')}
        </p>
      </section>

      <Overlay
        open={editing === 'week'}
        onClose={() => setEditing(null)}
        title={`График: ${master.name}`}
        drawer
      >
        {editing === 'week' && <WeekForm employeeId={master.id} week={data.week} />}
      </Overlay>
      <Overlay
        open={editing === 'timeOff'}
        onClose={() => setEditing(null)}
        title={`Отсутствие: ${master.name}`}
        drawer
      >
        {editing === 'timeOff' && <TimeOffForm employeeId={master.id} />}
      </Overlay>
      <Overlay
        open={editing === 'locations'}
        onClose={() => setEditing(null)}
        title={`Филиалы: ${master.name}`}
        drawer
      >
        {editing === 'locations' && (
          <LocationsForm employeeId={master.id} locations={data.locations} />
        )}
      </Overlay>
    </>
  );
}

function WeekForm({ employeeId, week }: { employeeId: string; week: BeautySchedule['week'] }) {
  const [state, action, pending] = useActionState(saveBeautyWorkingHours, null);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<number, Slot[]>>(() =>
    Object.fromEntries(week.map((day) => [day.weekday, day.intervals.map((i) => ({ ...i }))])),
  );

  const intervals: BeautyWorkingInterval[] = week.flatMap((day) =>
    (slots[day.weekday] ?? [])
      .filter((s) => s.timeFrom || s.timeTo)
      .map((s) => ({ weekday: day.weekday, timeFrom: s.timeFrom, timeTo: s.timeTo })),
  );

  const change = (weekday: number, index: number, patch: Partial<Slot>) =>
    setSlots((prev) => ({
      ...prev,
      [weekday]: (prev[weekday] ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));

  return (
    <form
      action={action}
      className="beauty-form"
      onSubmit={(event) => {
        // тем же разбором, что на сервере: отказ не должен стирать уже набранную неделю
        const parsed = parseWorkingHoursWeek({ intervals });
        if (!parsed.ok) {
          event.preventDefault();
          setError(parsed.reason);
          return;
        }
        setError(null);
      }}
    >
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="intervals" value={JSON.stringify(intervals)} />
      {week.map((day) => {
        const rows = slots[day.weekday] ?? [];
        return (
          <div key={day.weekday} role="group" aria-label={DAYS[day.weekday]} className="beauty-week-row">
            <span className="beauty-week-name">{DAYS[day.weekday]}</span>
            <div className="beauty-week-slots">
              {rows.length === 0 && <span className="beauty-note">Выходной</span>}
              {rows.map((slot, index) => (
                <span key={index} className="beauty-week-slot">
                  <Input
                    className="beauty-time"
                    value={slot.timeFrom}
                    inputMode="numeric"
                    placeholder="09:00"
                    aria-label={`${DAYS[day.weekday]}: начало`}
                    onChange={(e) => change(day.weekday, index, { timeFrom: e.target.value })}
                  />
                  <span aria-hidden="true">до</span>
                  <Input
                    className="beauty-time"
                    value={slot.timeTo}
                    inputMode="numeric"
                    placeholder="18:00"
                    aria-label={`${DAYS[day.weekday]}: конец`}
                    onChange={(e) => change(day.weekday, index, { timeTo: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    aria-label={`${DAYS[day.weekday]}: убрать интервал`}
                    onClick={() =>
                      setSlots((prev) => ({
                        ...prev,
                        [day.weekday]: (prev[day.weekday] ?? []).filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Убрать
                  </Button>
                </span>
              ))}
              <Button
                type="button"
                size="sm"
                tone="secondary"
                onClick={() =>
                  setSlots((prev) => ({
                    ...prev,
                    [day.weekday]: [...(prev[day.weekday] ?? []), { timeFrom: '', timeTo: '' }],
                  }))
                }
              >
                {rows.length === 0 ? 'Сделать рабочим' : 'Ещё интервал'}
              </Button>
            </div>
          </div>
        );
      })}
      {(error ?? state?.error) && <Alert>{error ?? state?.error}</Alert>}
      {!error && state?.message && <p role="status">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить график'}
      </Button>
    </form>
  );
}

function TimeOffForm({ employeeId }: { employeeId: string }) {
  const [state, action, pending] = useActionState(addBeautyTimeOff, null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={action}
      className="beauty-form"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = parseTimeOffInput({
          dateFrom: String(data.get('dateFrom') ?? ''),
          dateTo: String(data.get('dateTo') ?? ''),
          reason: String(data.get('reason') ?? ''),
        });
        if (!parsed.ok) {
          event.preventDefault();
          setError(parsed.reason);
          return;
        }
        setError(null);
      }}
    >
      <input type="hidden" name="id" value={employeeId} />
      <Field label="С какого дня">
        <Input name="dateFrom" type="date" required />
      </Field>
      <Field label="По какой день включительно">
        <Input name="dateTo" type="date" required />
      </Field>
      <Field label={<span>Причина <small className="beauty-note">необязательно</small></span>}>
        <Input name="reason" maxLength={200} placeholder="отпуск, учёба, больничный" />
      </Field>
      {(error ?? state?.error) && <Alert>{error ?? state?.error}</Alert>}
      {!error && state?.message && <p role="status">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Добавить отсутствие'}
      </Button>
    </form>
  );
}

function TimeOffTable({
  employeeId,
  rows,
  canEdit,
}: {
  employeeId: string;
  rows: BeautySchedule['timeOffs'];
  canEdit: boolean;
}) {
  const { ask, dialog } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string, label: string) => {
    const ok = await ask({
      title: `Снять отсутствие ${label}?`,
      body: 'Мастер снова будет считаться работающим в эти дни.',
      confirmLabel: 'Снять отсутствие',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await removeBeautyTimeOff(employeeId, id);
      setError(result.error ?? null);
    });
  };

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Когда</th>
            <th>Причина</th>
            <th>Записи в эти дни</th>
            {canEdit && <th className="sr-only">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.dateFrom === row.dateTo
                  ? dayText(row.dateFrom)
                  : `${dayText(row.dateFrom)} до ${dayText(row.dateTo)}`}
              </td>
              <td>{row.reason ?? 'Не указана'}</td>
              <td>
                {row.appointments === 0
                  ? 'Записей нет'
                  : pluralRu(row.appointments, ['запись', 'записи', 'записей'])}
              </td>
              {canEdit && (
                <td>
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    disabled={pending}
                    onClick={() =>
                      void remove(
                        row.id,
                        row.dateFrom === row.dateTo
                          ? dayText(row.dateFrom)
                          : `${dayText(row.dateFrom)} до ${dayText(row.dateTo)}`,
                      )
                    }
                  >
                    Убрать
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      {error && <Alert>{error}</Alert>}
      {dialog}
    </>
  );
}

function LocationsForm({
  employeeId,
  locations,
}: {
  employeeId: string;
  locations: BeautySchedule['locations'];
}) {
  const [state, action, pending] = useActionState(saveBeautyEmployeeLocations, null);
  return (
    <form action={action} className="beauty-form">
      <input type="hidden" name="id" value={employeeId} />
      <fieldset className="beauty-skills">
        <legend>Где мастер работает</legend>
        {locations.map((location) => (
          <label key={location.id} className="beauty-check">
            <input
              type="checkbox"
              name="locationIds"
              value={location.id}
              defaultChecked={location.assigned}
            />
            {location.name}
          </label>
        ))}
      </fieldset>
      <p className="beauty-note">
        Снятый филиал забирает и график мастера в нём. Если там остались будущие записи, филиал не
        снимется: сначала разберитесь с записями.
      </p>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <p role="status">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить филиалы'}
      </Button>
    </form>
  );
}

/** «9 часов», «9 часов 30 минут»: округлять до часов нельзя, полчаса смены это полчаса смены */
function weekText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = pluralRu(h, ['час', 'часа', 'часов']);
  const rest = pluralRu(m, ['минута', 'минуты', 'минут']);
  if (h === 0) return rest;
  return m === 0 ? hours : `${hours} ${rest}`;
}

function minutesOf(intervals: Array<{ timeFrom: string; timeTo: string }>): number {
  return intervals.reduce((sum, i) => sum + Math.max(0, clock(i.timeTo) - clock(i.timeFrom)), 0);
}

function clock(value: string): number {
  const [hh, mm] = value.split(':');
  return Number(hh) * 60 + Number(mm);
}

/** «2026-10-12» в «12.10.2026»: даты человеку всегда в его виде (DESIGN.md) */
function dayText(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}
