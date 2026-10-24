'use client';
import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { parseWorkingHoursWeek } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Switch } from '../../../components/switch';
import { Alert, Button, Field, Input, Select, Table } from '../../../components/ui';
import type {
  BeautySchedule,
  BeautyTimeOff,
  BeautyWeekDay,
  BeautyWorkingInterval,
} from '../../../lib/api';
import { DEFAULT_SLOT, shiftWeek, weekDates } from './week';
import {
  addBeautyTimeOff,
  removeBeautyTimeOff,
  saveBeautyEmployeeLocations,
  saveBeautyWorkingHours,
  loadBeautySchedule,
} from '../actions';
import { applyWeekPreset, WEEK_PRESETS } from '../../../components/employee-portal/week-presets';

/**
 * График мастеров (поручение владельца 17.10.2026): сетка недели, строки мастера, колонки даты.
 *
 * Переключатель меняет только эту дату (решение по поручению владельца, Q-SCHED-1): выключить рабочий по
 * шаблону день значит однодневное отсутствие (модель отсутствий §19, без миграций), включить снова значит
 * снять это отсутствие. Дня сверх недельного шаблона в модели нет, поэтому выходной по графику ведёт в окно
 * часов мастера: шаблон правится только там. Отсутствие на несколько дней видно только для чтения.
 * Уже созданные записи выключение дня не отменяет: число таких записей показывается предупреждением.
 *
 * Неделя уходит на сервер одним списком интервалов: он заменяет прежний график, поэтому убранная строка
 * убирается, а не копится. Проверка перед отправкой идёт тем же разбором домена, что и на сервере.
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
/** «изменится каждый понедельник / каждую среду / каждое воскресенье» */
const EVERY: Record<number, string> = {
  1: 'каждый понедельник',
  2: 'каждый вторник',
  3: 'каждую среду',
  4: 'каждый четверг',
  5: 'каждую пятницу',
  6: 'каждую субботу',
  0: 'каждое воскресенье',
};

type Slot = { timeFrom: string; timeTo: string };

export interface GridMaster {
  id: string;
  name: string;
  week: BeautyWeekDay[];
  weekRevision: string | null;
  timeOffs: BeautyTimeOff[];
}

export interface WeekGridData {
  location: { id: string; name: string | null } | null;
  /** Понедельник показанной недели, YYYY-MM-DD */
  monday: string;
  masters: GridMaster[];
  /** Мастера бизнеса, которые в этом филиале не работают: в сетке их нет */
  elsewhere: number;
  /** Профессии для отбора: группы услуг, назначенных мастерам филиала (Q-SCHED-2) */
  groups?: string[];
  group?: string | null;
}

const dayMonth = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const shortDay = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' });
const label = (date: string) => dayMonth.format(new Date(`${date}T12:00:00Z`));

export function ScheduleBoard({ data, canEdit }: { data: WeekGridData; canEdit: boolean }) {
  const [editing, setEditing] = useState<{ master: GridMaster; weekday?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // переключатель отзывается сразу; после ответа сервера правду показывает свежий график страницы
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const days = weekDates(data.monday);
  const shift = (n: number) =>
    `?week=${shiftWeek(data.monday, n)}${data.group ? `&group=${encodeURIComponent(data.group)}` : ''}`;

  const toggle = (master: GridMaster, date: string, on: boolean, dayOff?: BeautyTimeOff) => {
    const key = `${master.id}:${date}`;
    // вне перехода: обновление внутри async-перехода React показывает только после его конца
    setOptimistic((prev) => ({ ...prev, [key]: on }));
    start(async () => {
      let result: { error?: string; message?: string };
      if (on && dayOff) result = await removeBeautyTimeOff(master.id, dayOff.id);
      else {
        const form = new FormData();
        form.set('id', master.id);
        form.set('dateFrom', date);
        form.set('dateTo', date);
        result = await addBeautyTimeOff(null, form);
      }
      setError(result.error ? `${master.name}: ${result.error}` : null);
      setNotice(
        result.error
          ? null
          : on
            ? `${master.name}, ${label(date)}: снова рабочий день`
            : `${master.name}, ${label(date)}: ${result.message ?? 'день выключен'}`,
      );
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  };

  return (
    <>
      <nav className="beauty-week-nav" aria-label="Неделя">
        <Link className="btn btn--secondary btn--sm" href={shift(-7)}>
          Прошлая неделя
        </Link>
        <span data-testid="beauty-week-range">
          {label(days[0]!.date)} – {label(days[6]!.date)}
        </span>
        <Link className="btn btn--secondary btn--sm" href={shift(7)}>
          Следующая неделя
        </Link>
      </nav>
      {(data.groups?.length ?? 0) > 0 && (
        <form className="beauty-pick" method="get" action="/beauty/schedule">
          <input type="hidden" name="week" value={data.monday} />
          <Field label="Профессия">
            <Select name="group" defaultValue={data.group ?? ''}>
              <option value="">Все специалисты</option>
              {data.groups!.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" tone="secondary">
            Показать
          </Button>
        </form>
      )}
      <p className="beauty-note">
        Переключатель меняет только эту дату.
        {canEdit && ' Выходной по графику и часы работы меняются в окне специалиста: нажмите на его имя.'}
      </p>
      {error && <Alert>{error}</Alert>}
      {/* записи в выключенный день не отменяются: тогда это предупреждение, а не просто отметка */}
      {notice &&
        (notice.includes('никто не отменил') ? (
          <Alert tone="warning">{notice}</Alert>
        ) : (
          <p role="status">{notice}</p>
        ))}
      <Table className="beauty-week-grid" aria-busy={busy}>
        <thead>
          <tr>
            <th scope="col">Специалисты</th>
            {days.map((d) => (
              <th key={d.date} scope="col">
                {label(d.date)}, {shortDay.format(new Date(`${d.date}T12:00:00Z`))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.masters.map((m) => (
            <tr key={m.id}>
              <th scope="row">
                {canEdit ? (
                  <Button type="button" tone="ghost" size="sm" onClick={() => setEditing({ master: m })}>
                    {m.name}
                  </Button>
                ) : (
                  <span>{m.name}</span>
                )}
                {/* новый специалист без часов (онбординг 21.10.2026): к нему нельзя записаться, кнопка сразу под именем */}
                {canEdit && m.week.every((w) => w.intervals.length === 0) && (
                  <Button
                    type="button"
                    size="sm"
                    className="beauty-week-unset"
                    data-testid="beauty-week-unset"
                    onClick={() => setEditing({ master: m })}
                  >
                    Задать часы<span className="sr-only">: {m.name}</span>
                  </Button>
                )}
              </th>
              {days.map((d) => {
                const hours = m.week.find((w) => w.weekday === d.weekday)?.intervals ?? [];
                const absent = m.timeOffs.find((t) => t.dateFrom <= d.date && d.date <= t.dateTo);
                // однодневное отсутствие это выключенная дата: её переключатель включает обратно
                const dayOff = absent && absent.dateFrom === absent.dateTo ? absent : undefined;
                const templateOff = hours.length === 0;
                const works = optimistic[`${m.id}:${d.date}`] ?? (!templateOff && !absent);
                const text = templateOff
                  ? 'Выходной по графику'
                  : absent && !dayOff
                    ? 'Отсутствует'
                    : works
                      ? 'Работает'
                      : 'Не работает';
                return (
                  <td
                    key={d.date}
                    className={works ? 'is-on' : 'is-off'}
                    data-label={label(d.date)}
                  >
                    {canEdit && !templateOff && (!absent || dayOff) ? (
                      <Switch
                        name={`works-${m.id}-${d.date}`}
                        label={
                          <>
                            {text}
                            <span className="sr-only">
                              : {m.name}, {label(d.date)}
                            </span>
                          </>
                        }
                        checked={works}
                        disabled={busy}
                        onChange={(on) => toggle(m, d.date, on, dayOff)}
                      />
                    ) : (
                      <span>{text}</span>
                    )}
                    {works && (
                      <small className="beauty-note">
                        {hours.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ')}
                      </small>
                    )}
                    {absent?.reason && <small className="beauty-note">{absent.reason}</small>}
                    {canEdit && templateOff && (
                      <Button
                        type="button"
                        tone="ghost"
                        size="sm"
                        onClick={() => setEditing({ master: m, weekday: d.weekday })}
                      >
                        Изменить график<span className="sr-only">: {m.name}, {label(d.date)}</span>
                      </Button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {data.masters.length === 0 && (
            <tr>
              <td colSpan={8} data-testid="beauty-schedule-empty">
                {data.group ? 'Специалистов этой профессии в филиале нет.' : 'В этом филиале пока нет специалистов.'}{' '}
                {canEdit && <Link href="/employees">Добавить специалиста</Link>}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      {data.elsewhere > 0 && (
        <p className="beauty-note">
          Специалистов из других филиалов здесь не видно: {data.elsewhere}. Поставить специалиста в этот
          филиал можно в его карточке, раздел «Филиалы».
        </p>
      )}
      <Overlay
        open={canEdit && editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Часы работы: ${editing.master.name}` : ''}
        drawer
      >
        {canEdit && editing && (
          <>
            {editing.weekday !== undefined && (
              <p className="beauty-note" data-testid="beauty-week-hint">
                Это обычная неделя специалиста: {DAYS[editing.weekday]?.toLowerCase()} изменится{' '}
                {EVERY[editing.weekday]}, а не одна дата.
              </p>
            )}
            <WeekForm
              key={editing.master.id}
              employeeId={editing.master.id}
              week={editing.master.week}
              expectedRevision={editing.master.weekRevision ?? undefined}
              scopeKey={data.location?.id ?? ''}
            />
          </>
        )}
      </Overlay>
    </>
  );
}

export function WeekForm({
  employeeId,
  onSaved,
  week,
  save = saveBeautyWorkingHours,
  expectedRevision,
  scopeKey = '',
  loadCurrent = loadBeautySchedule,
}: {
  scopeKey?: string | undefined;
  employeeId: string;
  expectedRevision?: string | undefined;
  onSaved?: () => Promise<void>;
  week: BeautySchedule['week'];
  /** Действие сохранения недели: салонное по умолчанию, ресторан передаёт своё (Q-REST-11) */
  save?: typeof saveBeautyWorkingHours;
  loadCurrent?: (
    employeeId: string,
  ) => Promise<{
    data?: {
      week: BeautySchedule['week'];
      weekRevision?: string | null;
      location: { id: string } | null;
    };
    error?: string | null;
  }>;
}) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof saveBeautyWorkingHours>> | null, form: FormData) => {
      const result = await save(prev, form);
      if (!result.error) await onSaved?.();
      return result;
    },
    null,
  );
  const [originalRevision, setOriginalRevision] = useState(expectedRevision);
  const [comparison, setComparison] = useState<{
    week: BeautySchedule['week'];
    weekRevision?: string | null;
  } | null>(null);
  const [checking, check] = useTransition();
  useEffect(() => {
    if (state?.revision) setOriginalRevision(state.revision);
  }, [state?.revision]);
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
      <input type="hidden" name="scopeKey" value={scopeKey} />
      {(originalRevision ?? state?.revision) && (
        <input type="hidden" name="expectedRevision" value={originalRevision ?? state?.revision} />
      )}
      <p className="beauty-note">
        Это обычный недельный график: он повторяется каждую неделю. Дни без интервалов: регулярные
        выходные. Новый рабочий день получает часы первого рабочего дня, их можно поправить.
      </p>
      {/* быстрый шаблон недели (онбординг 21.10.2026): заполняет все дни одним нажатием */}
      <div className="beauty-week-presets" role="group" aria-label="Быстро заполнить неделю">
        <span className="beauty-note">Заполнить:</span>
        {WEEK_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            tone="secondary"
            onClick={() =>
              setSlots((prev) =>
                Object.fromEntries(
                  applyWeekPreset(
                    week.map((day) => ({ weekday: day.weekday, intervals: prev[day.weekday] ?? [] })),
                    preset,
                  ).map((day) => [day.weekday, day.intervals]),
                ),
              )
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {week.map((day) => {
        const rows = slots[day.weekday] ?? [];
        return (
          <div
            key={day.weekday}
            role="group"
            aria-label={DAYS[day.weekday]}
            className="beauty-week-row"
          >
            <span className="beauty-week-name">{DAYS[day.weekday]}</span>
            <div className="beauty-week-slots">
              {rows.length === 0 && <span className="beauty-note">Выходной</span>}
              {rows.map((slot, index) => (
                <span key={index} className="beauty-week-slot">
                  <span aria-hidden="true">С</span>
                  <Input
                    className="beauty-time"
                    value={slot.timeFrom}
                    inputMode="numeric"
                    aria-label={`${DAYS[day.weekday]}: начало`}
                    onChange={(e) => change(day.weekday, index, { timeFrom: e.target.value })}
                  />
                  <span aria-hidden="true">До</span>
                  <Input
                    className="beauty-time"
                    value={slot.timeTo}
                    inputMode="numeric"
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
                    // новый рабочий день сразу с часами: пустые поля с подсказкой «09:00» выглядели
                    // заполненными, при сохранении отбрасывались, и день не сохранялся (приёмка 17.10.2026)
                    [day.weekday]: [
                      ...(prev[day.weekday] ?? []),
                      (prev[day.weekday] ?? []).length === 0
                        ? { ...(Object.values(prev).find((d) => d.length)?.[0] ?? DEFAULT_SLOT) }
                        : { timeFrom: '', timeTo: '' },
                    ],
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
      {state?.error && scopeKey && (
        <Button
          type="button"
          tone="secondary"
          disabled={checking}
          onClick={() =>
            check(async () => {
              const result = await loadCurrent(employeeId);
              if (result.error) {
                setError(result.error);
                return;
              }
              if (result.data?.location?.id !== scopeKey) return;
              setComparison(result.data);
            })
          }
        >
          Сравнить с актуальным графиком
        </Button>
      )}
      {comparison && (
        <section className="panel">
          <h3>Сохранено на сервере</h3>
          <ul>
            {comparison.week.map((day) => (
              <li key={day.weekday}>
                {DAYS[day.weekday]}:{' '}
                {day.intervals.map((i) => `${i.timeFrom} до ${i.timeTo}`).join(', ') || 'Выходной'}
              </li>
            ))}
          </ul>
          <p>Ваш ввод остаётся в форме; он не отправлен поверх чужих изменений.</p>
          <Button
            type="button"
            tone="secondary"
            onClick={() => {
              setSlots(
                Object.fromEntries(
                  comparison.week.map((d) => [d.weekday, d.intervals.map((i) => ({ ...i }))]),
                ),
              );
              setOriginalRevision(comparison.weekRevision ?? undefined);
              setComparison(null);
            }}
          >
            Принять сохранённый график
          </Button>
        </section>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить график'}
      </Button>
    </form>
  );
}

export function LocationsForm({
  employeeId,
  onSaved,
  locations,
}: {
  employeeId: string;
  onSaved?: () => Promise<void>;
  locations: BeautySchedule['locations'];
}) {
  const [state, action, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof saveBeautyEmployeeLocations>> | null,
      form: FormData,
    ) => {
      const result = await saveBeautyEmployeeLocations(prev, form);
      if (!result.error) await onSaved?.();
      return result;
    },
    null,
  );
  return (
    <form action={action} className="beauty-form">
      <input type="hidden" name="id" value={employeeId} />
      <fieldset className="beauty-skills">
        <legend>Где специалист работает</legend>
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
        Снятый филиал забирает и график специалиста в нём. Если там остались будущие записи, филиал не
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
