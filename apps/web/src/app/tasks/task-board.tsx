'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { DeskTask, DeskTasksList } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, EmptyState, Field, Input, Select, Table, Textarea } from '../../components/ui';
import { intlLocale, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { createTaskAction, setTaskDoneAction, type TaskActionResult } from './actions';

const NONE: TaskActionResult = { error: null, ok: 0 };
const PRIORITY: Record<DeskTask['priority'], string> = { LOW: msg('Низкий'), NORMAL: msg('Обычный'), HIGH: msg('Высокий') };
const SECTIONS: Array<{ bucket: DeskTask['bucket']; title: string; empty: string }> = [
  { bucket: 'overdue', title: msg('Просроченные'), empty: msg('Просроченных нет.') },
  { bucket: 'today', title: msg('Сегодня'), empty: msg('На сегодня задач нет.') },
  { bucket: 'upcoming', title: msg('Предстоящие'), empty: msg('Предстоящих нет.') },
  { bucket: 'done', title: msg('Сделанные'), empty: msg('Сделанных пока нет.') },
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
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(Boolean(defaultReservation) && canEdit);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const toggle = (task: DeskTask) =>
    start(async () => {
      const r = await setTaskDoneAction(task.id, task.doneAt === null);
      setError(r.error ?? '');
    });
  const total = list.tasks.length;
  return (
    <>
      {canEdit && (
        <p>
          <Button onClick={() => setOpen(true)} data-testid="task-new">
            <Icon name="plus" /> {t('Новая задача')}
          </Button>
        </p>
      )}
      {error && <Alert boxed>{error}</Alert>}
      {total === 0 ? (
        <EmptyState title={t('Задач пока нет')}>{t('Запишите, что нужно сделать смене: позвонить гостю, заказать воду.')}</EmptyState>
      ) : (
        SECTIONS.map(({ bucket, title, empty }) => {
          const rows = list.tasks.filter((task) => task.bucket === bucket);
          return (
            <section key={bucket} aria-label={t(title)} data-testid={`tasks-${bucket}`}>
              <h2>
                {t(title)} <span className="muted">{rows.length}</span>
              </h2>
              {rows.length === 0 ? (
                <p className="muted">{t(empty)}</p>
              ) : (
                <Table className="settings-table" stack data-testid={`tasks-table-${bucket}`}>
                  <thead>
                    <tr>
                      <th aria-label={t('Сделано')} />
                      <th>{t('Задача')}</th>
                      <th>{t('Срок')}</th>
                      <th className="settings-col-wide">{t('Ответственный')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((task) => (
                      <tr key={task.id} data-testid="task-row">
                        <td>
                          <input
                            type="checkbox"
                            checked={task.doneAt !== null}
                            disabled={!canEdit || pending}
                            onChange={() => toggle(task)}
                            aria-label={t('Сделано: {title}', { title: task.title })}
                          />
                        </td>
                        <td data-label={t('Задача')}>
                          <b>{task.title}</b>
                          {task.priority === 'HIGH' ? <Badge tone="warn">{t(PRIORITY.HIGH)}</Badge> : null}
                          <span className="cell-sub">
                            {task.note ? <span>{task.note}</span> : null}
                            {task.reservationNumber ? (
                              <Link href={`/reservations/${encodeURIComponent(task.reservationNumber)}`}>
                                {t('Бронь {n}', { n: task.reservationNumber })}
                              </Link>
                            ) : null}
                          </span>
                        </td>
                        <td data-label={t('Срок')}>
                          {displayDate(task.dueDate, 'short', intlLocale(locale))}
                          <span className="cell-sub">{task.dueTime ?? t('весь день')}</span>
                        </td>
                        <td className="settings-col-wide" data-label={t('Ответственный')}>
                          {task.assigneeName ?? '—'}
                        </td>
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
        <Overlay open drawer size="sm" title={t('Новая задача')} onClose={() => setOpen(false)}>
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
  const t = useT();
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
      <Field label={t('Что сделать')}>
        <Input name="title" required maxLength={200} autoFocus data-testid="task-title" />
      </Field>
      <Field label={t('Описание')}>
        <Textarea name="note" rows={3} maxLength={2000} />
      </Field>
      <Field label={t('Срок')}>
        <Input name="dueDate" type="date" defaultValue={today} required data-testid="task-date" />
      </Field>
      <Field label={t('Время (пусто — весь день)')}>
        <Input name="dueTime" inputMode="numeric" placeholder="14:00" data-testid="task-time" />
      </Field>
      <Field label={t('Приоритет')}>
        <Select name="priority" defaultValue="NORMAL" aria-label={t('Приоритет')}>
          {(Object.keys(PRIORITY) as Array<keyof typeof PRIORITY>).map((p) => (
            <option key={p} value={p}>
              {t(PRIORITY[p])}
            </option>
          ))}
        </Select>
      </Field>
      {reservationNumber && <input type="hidden" name="reservationNumber" value={reservationNumber} />}
      {meId && (
        <label>
          <input type="checkbox" name="assignMe" /> {t('Назначить на меня')}
          <input type="hidden" name="meId" value={meId} />
        </label>
      )}
      <div className="settings-service-actions">
        <Button type="submit" disabled={pending} data-testid="task-save">
          {pending ? t('Сохраняю…') : t('Создать задачу')}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          {t('Отмена')}
        </Button>
      </div>
    </form>
  );
}
