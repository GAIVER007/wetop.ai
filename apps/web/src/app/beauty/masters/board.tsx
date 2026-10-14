'use client';
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs } from '../../../components/tabs';
import {
  EmployeeProfile,
  EmployeeTransitionGuard,
} from '../../../components/employee-workspace/workspace';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button } from '../../../components/ui';
import { pluralRu } from '../../../lib/plural';
import type {
  BeautyEmployeeRow,
  BeautyServiceRow,
  BeautySchedule,
  BeautyDay,
} from '../../../lib/api';
import { clearPendingCreation, pendingCreation } from '../creation-key';
import { WeekForm, TimeOffForm, TimeOffTable, LocationsForm } from '../schedule/board';
import { loadBeautySchedule, loadBeautyEmployee, saveBeautyEmployee } from '../actions';

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
  scopeKey = '',
  initialEmployeeId = '',
  unavailable = false,
}: {
  items: BeautyEmployeeRow[];
  services: BeautyServiceRow[];
  canEdit: boolean;
  today: BeautyDay;
  locations: BeautySchedule['locations'];
  scopeKey?: string;
  initialEmployeeId?: string;
  unavailable?: boolean;
}) {
  const router = useRouter();
  const [selection, setEditing] = useState<Editing>(null);
  const editing = selection;
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const guard = useRef<(action: () => void) => void>((action) => action());
  const registerGuard = useCallback((request: (action: () => void) => void) => {
    guard.current = request;
  }, []);
  const requested = useRef(false);
  const initialRequest = useRef(initialEmployeeId);
  const historyPosition = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const generation = useRef(0);
  const createdNavigation = useRef<string | null>(null);
  useEffect(() => {
    if (initialEmployeeId === createdNavigation.current) createdNavigation.current = null;
  }, [initialEmployeeId]);
  const setAddress = (id: string | null, push = false) => {
    const url = new URL(location.href);
    if (id) {
      url.searchParams.set('employee', id);
      url.hash = 'profile';
    } else {
      url.searchParams.delete('employee');
      url.hash = '';
    }
    if (push)
      history.pushState({ ...history.state, peoplePosition: ++historyPosition.current }, '', url);
    else
      history.replaceState({ ...history.state, peoplePosition: historyPosition.current }, '', url);
    window.dispatchEvent(new Event('employee-address'));
  };
  const focusedEmployee = useRef<string | null>(null);
  const [schedule, setSchedule] = useState<BeautySchedule | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, load] = useTransition();
  const open = (row: BeautyEmployeeRow) => {
    const version = ++generation.current;
    focusedEmployee.current = row.id;
    setEditing({ mode: 'edit', row });
    setAddress(row.id, true);
    setSchedule(null);
    setLoadError('');
    load(async () => {
      const result = await loadBeautySchedule(row.id);
      if (focusedEmployee.current !== row.id || version !== generation.current) return;
      if (result.data) {
        setSchedule(result.data);
        setLoadError('');
      } else setLoadError(result.error ?? 'Не удалось загрузить');
    });
  };
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const id = initialRequest.current || pendingCreation(scopeKey, 'employee');
    const row = itemsRef.current.find((item) => item.id === id);
    if (row) {
      // A URL or a pending operation can select only an authorized row from this scope.
      const version = ++generation.current;
      focusedEmployee.current = row.id;
      setEditing({ mode: 'edit', row });
      if (!initialRequest.current) setAddress(row.id);
      clearPendingCreation(scopeKey, 'employee', row.id);
      load(async () => {
        const result = await loadBeautySchedule(row.id);
        if (version !== generation.current) return;
        if (result.data) {
          setSchedule(result.data);
          setLoadError('');
        } else setLoadError(result.error ?? 'Не удалось загрузить');
      });
    }
    return () => {
      requested.current = false;
      generation.current++;
    };
  }, [scopeKey]);
  useEffect(() => {
    let url = location.href;
    let position = historyPosition.current;
    let returning = false;
    let accepted = false;
    let delta = -1;
    const remember = () => {
      url = location.href;
      position = historyPosition.current;
      history.replaceState({ ...history.state, peoplePosition: position }, '', url);
    };
    const sync = () => {
      const id = new URL(location.href).searchParams.get('employee');
      const row = itemsRef.current.find((item) => item.id === id);
      generation.current++;
      focusedEmployee.current = row?.id ?? null;
      setEditing(row ? { mode: 'edit', row } : null);
      setSchedule(null);
      setLoadError('');
      if (row) {
        const version = generation.current;
        load(async () => {
          const result = await loadBeautySchedule(row.id);
          if (generation.current !== version) return;
          if (result.data) {
            setSchedule(result.data);
            setLoadError('');
          } else setLoadError(result.error ?? 'Не удалось загрузить');
        });
      }
      remember();
    };
    const pop = (event: PopStateEvent) => {
      if (accepted) {
        accepted = false;
        historyPosition.current =
          typeof event.state?.peoplePosition === 'number'
            ? event.state.peoplePosition
            : position + delta;
        sync();
        return;
      }
      if (returning) {
        returning = false;
        event.stopImmediatePropagation();
        guard.current(() => {
          accepted = true;
          history.go(delta);
        });
        return;
      }
      // Native history cannot be cancelled. Return to our entry first, then ask before leaving it.
      if (location.href === url) return;
      delta =
        typeof event.state?.peoplePosition === 'number'
          ? event.state.peoplePosition - position
          : -1;
      if (delta === 0) {
        sync();
        return;
      }
      returning = true;
      event.stopImmediatePropagation();
      history.go(-delta);
    };
    const scopeSwitch = () => {
      generation.current++;
      focusedEmployee.current = null;
      setSchedule(null);
    };
    window.addEventListener('wetop-scope-switch', scopeSwitch);
    window.addEventListener('popstate', pop, true);
    window.addEventListener('employee-address', remember);
    // Our pushes/replacements do not emit popstate; track their resulting URL after render/click.
    const click = () => {
      queueMicrotask(remember);
    };
    document.addEventListener('click', click);
    document.addEventListener('keydown', click);
    remember();
    return () => {
      window.removeEventListener('wetop-scope-switch', scopeSwitch);
      window.removeEventListener('popstate', pop, true);
      window.removeEventListener('employee-address', remember);
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', click);
      generation.current++;
    };
  }, []);
  const savedChild = async () => {
    const form = lastSubmit.current;
    form?.dispatchEvent(new CustomEvent('employee-save-result', { bubbles: true, detail: true }));
    await refreshSchedule();
  };
  const lastSubmit = useRef<HTMLFormElement | null>(null);
  const savedProfile = (row: BeautyEmployeeRow) => {
    const created = editing?.mode === 'new';
    setEditing({ mode: 'edit', row });
    if (created) {
      setSchedule(null);
      setLoadError('');
      setNotice('Мастер создан');
      const url = new URL(location.href);
      url.searchParams.set('employee', row.id);
      url.hash = 'profile';
      createdNavigation.current = row.id;
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
      focusedEmployee.current = row.id;
      const version = ++generation.current;
      load(async () => {
        const result = await loadBeautySchedule(row.id);
        if (version !== generation.current) return;
        if (result.data) {
          setSchedule(result.data);
          setLoadError('');
        }
      });
    } else setNotice('Профиль сохранён');
  };
  const close = () => {
    generation.current++;
    focusedEmployee.current = null;
    setEditing(null);
    setAddress(null);
    if (createdNavigation.current) {
      createdNavigation.current = null;
      router.replace(`${location.pathname}${location.search}`, { scroll: false });
    }
  };
  const refreshSchedule = async () => {
    if (editing?.mode !== 'edit') return;
    const version = generation.current;
    const result = await loadBeautySchedule(editing.row.id);
    if (focusedEmployee.current !== editing.row.id || generation.current !== version) return;
    if (result.data) {
      setSchedule(result.data);
      setLoadError('');
    } else setLoadError(result.error ?? 'Не удалось обновить график');
  };
  const names = new Map(services.map((s) => [s.id, s.name]));
  return (
    <>
      {unavailable && <Alert>Мастер недоступен в текущем контексте.</Alert>}
      {notice && <p role="status">{notice}</p>}
      <div className="beauty-bar">
        <p role="status">
          {items.length === 0
            ? 'Добавьте первого мастера'
            : `Мастеров: ${items.length}, из них в архиве ${items.filter((i) => !i.active).length}`}
        </p>
        {canEdit && (
          <Button
            type="button"
            onClick={() =>
              guard.current(() => {
                generation.current++;
                focusedEmployee.current = null;
                setSchedule(null);
                setLoadError('');
                setEditing({ mode: 'new' });
                setNotice('');
              })
            }
          >
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
              <Button type="button" size="sm" tone="secondary" onClick={() => guard.current(() => open(row))}>
                Открыть
              </Button>
            </li>
          );
        })}
      </ul>
      <Overlay
        open={editing !== null}
        onClose={() => guard.current(close)}
        title={editing?.mode === 'edit' ? 'Мастер' : 'Новый мастер'}
        drawer
        size={editing?.mode === 'edit' ? 'lg' : 'md'}
        trapFocus
      >
        <EmployeeTransitionGuard
          register={registerGuard}
          discard={() => setEpoch((value) => value + 1)}
        >
          <div
            key={`${scopeKey}:${editing?.mode === 'edit' ? editing.row.id : 'new'}:${epoch}`}
            onSubmitCapture={(event) => {
              if (event.target instanceof HTMLFormElement) lastSubmit.current = event.target;
            }}
          >
            {editing?.mode === 'new' && (
              <EmployeeProfile
                row={null}
                scopeKey={scopeKey}
                canEdit={canEdit}
                onSaved={savedProfile}
              />
            )}
            {editing?.mode === 'edit' && (
              <>
                <header className="employee-workspace-heading">
                  <strong>{editing.row.name}</strong>
                  <Badge>{editing.row.active ? 'Работает' : 'В архиве'}</Badge>
                  <p>{locations.find((item) => item.id === scopeKey)?.name ?? 'Текущий филиал'}</p>
                </header>
                <Tabs
                  label="Разделы сотрудника"
                  panels={[
                    {
                      id: 'profile',
                      label: 'Профиль',
                      content: (
                        <EmployeeProfile
                          row={editing.row}
                          scopeKey={scopeKey}
                          canEdit={canEdit}
                          onSaved={savedProfile}
                        />
                      ),
                    },
                    {
                      id: 'services',
                      label: 'Услуги',
                      content: canEdit ? (
                        <MasterForm row={editing.row} services={services} scopeKey={scopeKey} />
                      ) : (
                        <p>
                          {editing.row.serviceIds.map((id) => names.get(id)).join(', ') ||
                            'Услуги не назначены'}
                        </p>
                      ),
                    },
                    {
                      id: 'locations',
                      label: 'Филиалы',
                      content: schedule ? (
                        canEdit ? (
                          <LocationsForm
                            employeeId={editing.row.id}
                            locations={schedule.locations}
                            onSaved={savedChild}
                          />
                        ) : (
                          <p>
                            {schedule.locations
                              .filter((item) => item.assigned)
                              .map((item) => item.name)
                              .join(', ') || 'Не назначены'}
                          </p>
                        )
                      ) : (
                        <p role="status">Загружаем филиалы…</p>
                      ),
                    },
                    {
                      id: 'schedule',
                      label: 'График',
                      content: schedule ? (
                        canEdit && schedule.employee?.worksHere ? (
                          <WeekForm
                            employeeId={editing.row.id}
                            week={schedule.week}
                            expectedRevision={schedule.weekRevision ?? undefined}
                            scopeKey={scopeKey}
                            onSaved={savedChild}
                          />
                        ) : (
                          <div>
                            {schedule.week.map((day) => (
                              <p key={day.weekday}>
                                {
                                  [
                                    'Воскресенье',
                                    'Понедельник',
                                    'Вторник',
                                    'Среда',
                                    'Четверг',
                                    'Пятница',
                                    'Суббота',
                                  ][day.weekday]
                                }
                                :{' '}
                                {day.intervals
                                  .map((interval) => `${interval.timeFrom}–${interval.timeTo}`)
                                  .join(', ') || 'Выходной'}
                              </p>
                            ))}
                          </div>
                        )
                      ) : (
                        <p role="status">Загружаем график…</p>
                      ),
                    },
                    {
                      id: 'absences',
                      label: 'Отсутствия',
                      content: schedule ? (
                        <>
                          <TimeOffTable
                            employeeId={editing.row.id}
                            rows={schedule.timeOffs}
                            canEdit={canEdit}
                            onSaved={savedChild}
                          />
                          {canEdit && (
                            <TimeOffForm employeeId={editing.row.id} onSaved={savedChild} />
                          )}
                        </>
                      ) : (
                        <p role="status">Загружаем отсутствия…</p>
                      ),
                    },
                  ]}
                />
              </>
            )}
            {loading && <p role="status">Загружаем данные мастера…</p>}
            {loadError && <Alert>{loadError}</Alert>}
          </div>
        </EmployeeTransitionGuard>
      </Overlay>
    </>
  );
}

function MasterForm({
  row,
  services,
  scopeKey,
}: {
  scopeKey: string;
  row: BeautyEmployeeRow;
  services: BeautyServiceRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof saveBeautyEmployee>> | null, form: FormData) => {
      const result = await saveBeautyEmployee(prev, form);
      formRef.current?.dispatchEvent(
        new CustomEvent('employee-save-result', { bubbles: true, detail: !result.error }),
      );
      return result;
    },
    null,
  );
  const [revision, setRevision] = useState(row.servicesRevision);
  const [selected, setSelected] = useState(row.serviceIds);
  const [comparison, setComparison] = useState<BeautyEmployeeRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, check] = useTransition();
  useEffect(() => {
    if (state?.message && state.revision) setRevision(state.revision);
  }, [state?.message, state?.revision]);
  const chosen = new Set(selected);
  return (
    <form ref={formRef} action={action} className="beauty-form">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="section" value="skills" />
      <input type="hidden" name="scopeKey" value={scopeKey} />
      {revision && <input type="hidden" name="expectedRevision" value={revision} />}
      <fieldset className="beauty-skills" disabled={pending}>
        <legend>Что умеет</legend>
        {services.length === 0 ? (
          <p className="beauty-note">
            <a href="/services">Добавить услуги в каталог салона</a>
          </p>
        ) : (
          services.map((service) => (
            <label key={service.id} className="beauty-check">
              <input
                type="checkbox"
                name="serviceIds"
                value={service.id}
                checked={chosen.has(service.id)}
                onChange={(event) =>
                  setSelected((prev) =>
                    event.target.checked
                      ? [...prev, service.id]
                      : prev.filter((id) => id !== service.id),
                  )
                }
              />
              {service.name}
            </label>
          ))
        )}
      </fieldset>
      {(error || state?.error) && <Alert>{error || state?.error}</Alert>}
      {!error && state?.message && <p role="status">{state.message}</p>}
      {state?.error && (
        <Button
          type="button"
          tone="secondary"
          disabled={checking || pending}
          onClick={() =>
            check(async () => {
              const result = await loadBeautyEmployee(row.id);
              if (result.locationId !== scopeKey || !formRef.current) return;
              if (result.employee) setComparison(result.employee);
              else setError(result.error);
            })
          }
        >
          Сравнить с актуальными услугами
        </Button>
      )}
      {comparison && (
        <section className="panel">
          <h3>Назначено сейчас</h3>
          <p>
            {comparison.serviceIds
              .map((id) => services.find((service) => service.id === id)?.name ?? 'Услуга')
              .join(', ') || 'Услуги не назначены'}
          </p>
          <p>Ваш выбор остаётся в форме. Данные другого окна не перезаписаны.</p>
          <Button
            type="button"
            tone="secondary"
            disabled={pending}
            onClick={() => {
              setSelected(comparison.serviceIds);
              setRevision(comparison.servicesRevision);
              setComparison(null);
              formRef.current?.dispatchEvent(
                new CustomEvent('employee-save-result', {
                  bubbles: true,
                  detail: { success: true, reset: true },
                }),
              );
            }}
          >
            Принять сохранённые назначения
          </Button>
        </section>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить услуги'}
      </Button>
    </form>
  );
}
