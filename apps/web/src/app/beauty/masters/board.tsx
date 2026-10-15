'use client';
import { useActionState, useRef, useState, useTransition } from 'react';
import { parseEmployeeInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button, Field, Input } from '../../../components/ui';
import { pluralRu } from '../../../lib/plural';
import type {
  BeautyEmployeeRow,
  BeautyServiceRow,
  BeautySchedule,
  BeautyDay,
} from '../../../lib/api';
import { WeekForm, TimeOffForm, TimeOffTable, LocationsForm } from '../schedule/board';
import { loadBeautySchedule, saveBeautyEmployee } from '../actions';

/**
 * Мастера салона (DATA_MODEL §19, срез B3). Мастер это сотрудник сети, не филиала: филиалы ведёт отдельная
 * связь, и новый мастер сразу начинает работать в выбранном филиале, иначе он нигде не работает.
 * Умения приходят одним списком, чтобы снятая галочка снималась, а не копилась.
 */
type Editing = { mode: 'new' } | { mode: 'edit'; row: BeautyEmployeeRow } | null;

/** Инициалы для кружка карточки: первые буквы первых двух слов имени */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function MastersBoard({
  items,
  services,
  canEdit,
  today,
  locations,
}: {
  items: BeautyEmployeeRow[];
  services: BeautyServiceRow[];
  canEdit: boolean;
  today: BeautyDay;
  locations: BeautySchedule['locations'];
}) {
  const [selection, setEditing] = useState<Editing>(null);
  const editing =
    selection?.mode === 'edit'
      ? { ...selection, row: items.find((row) => row.id === selection.row.id) ?? selection.row }
      : selection;
  const focusedEmployee = useRef<string | null>(null);
  const [tab, setTab] = useState('Основное');
  const [schedule, setSchedule] = useState<BeautySchedule | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, load] = useTransition();
  const open = (row: BeautyEmployeeRow) => {
    focusedEmployee.current = row.id;
    setEditing({ mode: 'edit', row });
    setTab('Основное');
    setSchedule(null);
    setLoadError('');
    load(async () => {
      const result = await loadBeautySchedule(row.id);
      if (focusedEmployee.current !== row.id) return;
      if (result.data) setSchedule(result.data);
      else setLoadError(result.error ?? 'Не удалось загрузить');
    });
  };
  const refreshSchedule = async () => {
    if (editing?.mode !== 'edit') return;
    const result = await loadBeautySchedule(editing.row.id);
    if (focusedEmployee.current !== editing.row.id) return;
    if (result.data) setSchedule(result.data);
    else setLoadError(result.error ?? 'Не удалось обновить график');
  };
  const names = new Map(services.map((s) => [s.id, s.name]));
  return (
    <>
      <div className="beauty-bar">
        <p role="status">
          {items.length === 0
            ? 'Добавьте первого мастера'
            : `Мастеров: ${items.length}, из них в архиве ${items.filter((i) => !i.active).length}`}
        </p>
        {canEdit && (
          <Button type="button" onClick={() => setEditing({ mode: 'new' })}>
            Добавить мастера
          </Button>
        )}
      </div>
      <ul className="beauty-master-cards">
        {items.map((row) => {
          const column = today.columns.find((e) => e.id === row.id);
          const onShift = !!column && !column.timeOff && column.intervals.length > 0;
          const hours = column?.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ');
          const appointments = today.appointments.filter(
            (a) => a.employeeId === row.id && a.status !== 'CANCELLED',
          ).length;
          const categories = [
            ...new Set(
              row.serviceIds
                .map((id) => services.find((s) => s.id === id)?.category)
                .filter((c): c is string => Boolean(c)),
            ),
          ];
          return (
            <li key={row.id} className="beauty-master-card">
              <div className="beauty-master-card__head">
                <span className="beauty-card-avatar" aria-hidden="true">
                  {initials(row.name)}
                </span>
                <div className="beauty-master-card__name">
                  <b>{row.name}</b>
                  <span className="beauty-note">
                    {categories.join(', ') || 'Специализация не указана'}
                  </span>
                </div>
              </div>
              <div className="beauty-master-card__state">
                {!row.active ? (
                  <Badge>В архиве</Badge>
                ) : onShift ? (
                  <Badge tone="ok">На смене</Badge>
                ) : (
                  <Badge>Выходной</Badge>
                )}
                {row.active && (
                  <span className="beauty-note">
                    {pluralRu(appointments, ['запись', 'записи', 'записей'])} сегодня
                  </span>
                )}
              </div>
              <p className="beauty-note">{onShift ? `Сегодня ${hours}` : 'Сегодня не работает'}</p>
              <p className="beauty-master-card__skills">
                {row.serviceIds.length === 0
                  ? 'Услуги не выбраны'
                  : row.serviceIds
                      .map((id) => names.get(id))
                      .filter(Boolean)
                      .join(', ')}
              </p>
              <p className="beauty-note">
                {locations
                  .filter((l) => row.locationIds.includes(l.id))
                  .map((l) => l.name)
                  .join(', ') || 'Филиалы не назначены'}
              </p>
              <Button type="button" size="sm" tone="secondary" onClick={() => open(row)}>
                Открыть
              </Button>
            </li>
          );
        })}
      </ul>
      <Overlay
        open={editing !== null}
        onClose={() => {
          focusedEmployee.current = null;
          setEditing(null);
        }}
        title={editing?.mode === 'edit' ? 'Мастер' : 'Новый мастер'}
        drawer
      >
        {editing?.mode === 'new' && <MasterForm row={null} services={services} />}
        {editing?.mode === 'edit' && (
          <>
            <div className="beauty-detail-tabs" role="group" aria-label="Разделы сотрудника">
              {['Основное', 'Услуги', 'Филиалы', 'График', 'Отсутствия'].map((label) => (
                <Button
                  key={label}
                  tone={tab === label ? 'primary' : 'secondary'}
                  onClick={() => setTab(label)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {(tab === 'Основное' || tab === 'Услуги') &&
              (canEdit ? (
                <MasterForm
                  key={editing.row.id + tab}
                  row={editing.row}
                  services={services}
                  section={tab === 'Услуги' ? 'skills' : 'basic'}
                />
              ) : (
                <dl className="beauty-facts">
                  <dt>Мастер</dt>
                  <dd>{editing.row.name}</dd>
                  <dt>Услуги</dt>
                  <dd>
                    {editing.row.serviceIds.map((id) => names.get(id)).join(', ') || 'Не назначены'}
                  </dd>
                  <dt>Телефон</dt>
                  <dd>{editing.row.phone ?? 'Не указан'}</dd>
                </dl>
              ))}
            {loading && <p role="status">Загружаем график…</p>}
            {loadError && <Alert>{loadError}</Alert>}
            {schedule &&
              tab === 'Филиалы' &&
              (canEdit ? (
                <LocationsForm
                  employeeId={editing.row.id}
                  locations={schedule.locations}
                  onSaved={refreshSchedule}
                />
              ) : (
                <p>
                  {schedule.locations
                    .filter((l) => l.assigned)
                    .map((l) => l.name)
                    .join(', ') || 'Не назначены'}
                </p>
              ))}
            {schedule &&
              tab === 'График' &&
              (canEdit && schedule.employee?.worksHere ? (
                <WeekForm
                  employeeId={editing.row.id}
                  week={schedule.week}
                  onSaved={refreshSchedule}
                />
              ) : (
                <div>
                  {schedule.week.map((d) => (
                    <p key={d.weekday}>
                      {
                        [
                          'Воскресенье',
                          'Понедельник',
                          'Вторник',
                          'Среда',
                          'Четверг',
                          'Пятница',
                          'Суббота',
                        ][d.weekday]
                      }
                      :{' '}
                      {d.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') || 'Выходной'}
                    </p>
                  ))}
                </div>
              ))}
            {schedule && tab === 'Отсутствия' && (
              <>
                <TimeOffTable
                  employeeId={editing.row.id}
                  rows={schedule.timeOffs}
                  canEdit={canEdit}
                  onSaved={refreshSchedule}
                />
                {canEdit && <TimeOffForm employeeId={editing.row.id} onSaved={refreshSchedule} />}
              </>
            )}
          </>
        )}
      </Overlay>
    </>
  );
}

function MasterForm({
  row,
  services,
  section = 'all',
}: {
  row: BeautyEmployeeRow | null;
  section?: 'all' | 'basic' | 'skills';
  services: BeautyServiceRow[];
}) {
  const [state, action, pending] = useActionState(saveBeautyEmployee, null);
  const [error, setError] = useState<string | null>(null);
  const chosen = new Set(row?.serviceIds ?? []);
  return (
    <form
      action={action}
      className="beauty-form"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = parseEmployeeInput({
          name: String(data.get('name') ?? ''),
          phone: String(data.get('phone') ?? ''),
          email: String(data.get('email') ?? ''),
          active: data.get('active') === 'on',
        });
        if (!parsed.ok) {
          event.preventDefault();
          setError(parsed.reason);
          return;
        }
        setError(null);
      }}
    >
      <input type="hidden" name="id" value={row?.id ?? ''} />
      {section === 'skills' ? (
        <>
          <input type="hidden" name="name" value={row?.name ?? ''} />
          <input type="hidden" name="phone" value={row?.phone ?? ''} />
          <input type="hidden" name="email" value={row?.email ?? ''} />
          {row?.active && <input type="hidden" name="active" value="on" />}
        </>
      ) : (
        <>
          <Field label="Имя мастера">
            <Input name="name" required maxLength={200} defaultValue={row?.name ?? ''} />
          </Field>
          <Field
            label={
              <span>
                Телефон <small className="beauty-note">необязательно</small>
              </span>
            }
          >
            <Input name="phone" maxLength={32} defaultValue={row?.phone ?? ''} />
          </Field>
          <Field
            label={
              <span>
                Почта <small className="beauty-note">необязательно</small>
              </span>
            }
          >
            <Input name="email" type="email" maxLength={320} defaultValue={row?.email ?? ''} />
          </Field>
          <label className="beauty-check">
            <input type="checkbox" name="active" defaultChecked={row?.active ?? true} />
            Мастер работает
          </label>
        </>
      )}
      {section === 'basic' ? (
        row?.serviceIds.map((id) => <input key={id} type="hidden" name="serviceIds" value={id} />)
      ) : (
        <fieldset className="beauty-skills">
          <legend>Что умеет</legend>
          {services.length === 0 ? (
            <p className="beauty-note">Сначала добавьте услуги в каталог салона.</p>
          ) : (
            services.map((service) => (
              <label key={service.id} className="beauty-check">
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  defaultChecked={chosen.has(service.id)}
                />
                {service.name}
              </label>
            ))
          )}
        </fieldset>
      )}
      {(error ?? state?.error) && <Alert>{error ?? state?.error}</Alert>}
      {!error && state?.message && <p role="status">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить мастера'}
      </Button>
    </form>
  );
}
