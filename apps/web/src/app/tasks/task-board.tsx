'use client';
import '../hotel-settings/settings.css';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { DeskTask, DeskTasksList } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, EmptyState, Field, Input, Select, Table, Textarea } from '../../components/ui';
import { createTaskAction, setTaskDoneAction, type TaskActionResult } from './actions';

const NONE: TaskActionResult = { error: null, ok: 0 };
const PRIORITY: Record<DeskTask['priority'], string> = { LOW: 'Низкий', NORMAL: 'Обычный', HIGH: 'Высокий' };
const SECTIONS: Array<{ bucket: DeskTask['bucket']; title: string; empty: string }> = [
  { bucket: 'overdue', title: 'Просроченные', empty: 'Просроченных нет.' },
  { bucket: 'today', title: 'Сегодня', empty: 'На сегодня задач нет.' },
  { bucket: 'upcoming', title: 'Предстоящие', empty: 'Предстоящих нет.' },
  { bucket: 'done', title: 'Сделанные', empty: 'Сделанных пока нет.' },
];

/**
 * «Задачи» стойки (DATA_MODEL §22, ADR-143): список по срокам, «Сделано» одним щелчком, создание панелью справа.
 * В «только чтении» кнопок нет. Повторов и уведомлений в v1 нет.
 */
export function TaskBoard({
  list,
  meId,
  canEdit,
  defaultReservation,
}: {
  list: DeskTasksList;
  meId: string | null;
  canEdit: boolean;
  defaultReservation?: string;
}) {
  const [open, setOpen] = useState(Boolean(defaultReservation) && canEdit);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const toggle = (t: DeskTask) =>
    start(async () => {
      const r = await setTaskDoneAction(t.id, t.doneAt === null);
      setError(r.error ?? '');
    });
  const total = list.tasks.length;
  return (
    <>
      {canEdit && (
        <p>
          <Button onClick={() => setOpen(true)} data-testid="task-new">
            <Icon name="plus" /> Новая задача
          </Button>
        </p>
      )}
      {error && <Alert boxed>{error}</Alert>}
      {total === 0 ? (
        <EmptyState title="Задач пока нет">Запишите, что нужно сделать смене: позвонить гостю, заказать воду.</EmptyState>
      ) : (
        SECTIONS.map(({ bucket, title, empty }) => {
          const rows = list.tasks.filter((t) => t.bucket === bucket);
          return (
            <section key={bucket} aria-label={title} data-testid={`tasks-${bucket}`}>
              <h2>
                {title} <span className="muted">{rows.length}</span>
              </h2>
              {rows.length === 0 ? (
                <p className="muted">{empty}</p>
              ) : (
                <Table className="settings-table" data-testid={`tasks-table-${bucket}`}>
                  <thead>
                    <tr>
                      <th aria-label="Сделано" />
                      <th>Задача</th>
                      <th>Срок</th>
                      <th className="settings-col-wide">Ответственный</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id} data-testid="task-row">
                        <td>
                          <input
                            type="checkbox"
                            checked={t.doneAt !== null}
                            disabled={!canEdit || pending}
                            onChange={() => toggle(t)}
                            aria-label={`Сделано: ${t.title}`}
                          />
                        </td>
                        <td>
                          <b>{t.title}</b>
                          {t.priority === 'HIGH' ? <Badge tone="warn">{PRIORITY.HIGH}</Badge> : null}
                          <span className="cell-sub">
                            {t.note ? <span>{t.note}</span> : null}
                            {t.reservationNumber ? (
                              <Link href={`/reservations/${encodeURIComponent(t.reservationNumber)}`}>
                                Бронь {t.reservationNumber}
                              </Link>
                            ) : null}
                          </span>
                        </td>
                        <td>
                          {displayDate(t.dueDate)}
                          <span className="cell-sub">{t.dueTime ?? 'весь день'}</span>
                        </td>
                        <td className="settings-col-wide">{t.assigneeName ?? 'не назначен'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          );
        })
      )}
      {open && (
        <Overlay open drawer className="settings-service-drawer" title="Новая задача" onClose={() => setOpen(false)}>
          <TaskForm
            today={list.today}
            meId={meId}
            reservationNumber={defaultReservation}
            onDone={() => setOpen(false)}
          />
        </Overlay>
      )}
    </>
  );
}

function TaskForm({
  today,
  meId,
  reservationNumber,
  onDone,
}: {
  today: string;
  meId: string | null;
  reservationNumber?: string | undefined;
  onDone: () => void;
}) {
  // не `action={…}`: React 19 очищает поля формы после действия, а при отказе введённое должно остаться
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="settings-service-form"
      data-testid="task-form"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        start(async () => {
          const r = await createTaskAction(NONE, fd);
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      {error && <Alert boxed>{error}</Alert>}
      <Field label="Что сделать">
        <Input name="title" required maxLength={200} autoFocus data-testid="task-title" />
      </Field>
      <Field label="Описание">
        <Textarea name="note" rows={3} maxLength={2000} />
      </Field>
      <Field label="Срок">
        <Input name="dueDate" type="date" defaultValue={today} required data-testid="task-date" />
      </Field>
      <Field label="Время (пусто — весь день)">
        <Input name="dueTime" inputMode="numeric" placeholder="14:00" data-testid="task-time" />
      </Field>
      <Field label="Приоритет">
        <Select name="priority" defaultValue="NORMAL" aria-label="Приоритет">
          {(Object.keys(PRIORITY) as Array<keyof typeof PRIORITY>).map((p) => (
            <option key={p} value={p}>
              {PRIORITY[p]}
            </option>
          ))}
        </Select>
      </Field>
      {reservationNumber && <input type="hidden" name="reservationNumber" value={reservationNumber} />}
      {meId && (
        <label>
          <input type="checkbox" name="assignMe" /> Назначить на меня
          <input type="hidden" name="meId" value={meId} />
        </label>
      )}
      <div className="settings-service-actions">
        <Button type="submit" disabled={pending} data-testid="task-save">
          {pending ? 'Сохраняю…' : 'Создать задачу'}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
