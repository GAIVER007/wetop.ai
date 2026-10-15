import { normalizeClockTime } from '../property/settings';

/** Задачи стойки (DATA_MODEL §22): разбор ввода формы и раскладка списка по срокам. */
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';
export const TASK_PRIORITIES: readonly TaskPriority[] = ['LOW', 'NORMAL', 'HIGH'];

export interface TaskInput {
  title?: string;
  note?: string | null;
  dueDate?: string;
  /** «HH:MM» по часам объекта; null — «весь день» */
  dueTime?: string | null;
  priority?: TaskPriority;
  assigneeUserId?: string | null;
  /** номер брони (confirmationNumber): так связь ставится из карточки брони */
  reservationNumber?: string | null;
  guestId?: string | null;
  done?: boolean;
}

type Parsed = { ok: true; value: TaskInput } | { ok: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINKS = ['assigneeUserId', 'guestId'] as const;
const KNOWN = new Set(['title', 'note', 'dueDate', 'dueTime', 'priority', 'done', 'reservationNumber', ...LINKS]);

const isDate = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : null);

/**
 * `create` требует название и срок; `update` берёт только присланные поля
 * (пустое описание и пустое время снимаются, `done` закрывает или открывает задачу).
 */
export function parseTaskInput(body: unknown, mode: 'create' | 'update'): Parsed {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'Нужен объект с полями задачи' };
  const b = body as Record<string, unknown>;
  const unknown = Object.keys(b).find((k) => !KNOWN.has(k));
  if (unknown) return { ok: false, reason: `Неизвестное поле: ${unknown}` };
  if (mode === 'create' && 'done' in b) return { ok: false, reason: 'Новая задача не бывает сделанной' };
  const v: TaskInput = {};
  if ('title' in b || mode === 'create') {
    const t = clean(b['title']);
    if (!t) return { ok: false, reason: 'Напишите, что сделать' };
    if (t.length > 200) return { ok: false, reason: 'Название — не длиннее 200 знаков' };
    v.title = t;
  }
  if ('note' in b) {
    const n = b['note'] === null ? null : typeof b['note'] === 'string' ? b['note'].trim() : undefined;
    if (n === undefined) return { ok: false, reason: 'Описание — текст' };
    if (n !== null && n.length > 2000) return { ok: false, reason: 'Описание — не длиннее 2000 знаков' };
    v.note = n || null;
  }
  if ('dueDate' in b || mode === 'create') {
    if (!isDate(b['dueDate'])) return { ok: false, reason: 'Срок — дата в виде ГГГГ-ММ-ДД' };
    v.dueDate = b['dueDate'];
  }
  if ('dueTime' in b) {
    if (b['dueTime'] === null || b['dueTime'] === '') v.dueTime = null;
    else {
      const t = normalizeClockTime(b['dueTime']);
      if (!t) return { ok: false, reason: 'Время — в виде 14:00 или пусто («весь день»)' };
      v.dueTime = t;
    }
  }
  if ('priority' in b || mode === 'create') {
    const p = b['priority'] ?? 'NORMAL';
    if (!TASK_PRIORITIES.includes(p as TaskPriority))
      return { ok: false, reason: 'Приоритет — низкий, обычный или высокий' };
    v.priority = p as TaskPriority;
  }
  for (const k of LINKS)
    if (k in b) {
      const id = b[k];
      if (id !== null && !(typeof id === 'string' && UUID.test(id)))
        return { ok: false, reason: `${k} — идентификатор или null` };
      v[k] = id as string | null;
    }
  if ('reservationNumber' in b) {
    const n = b['reservationNumber'];
    if (n !== null && !(typeof n === 'string' && n.trim() !== '' && n.length <= 60))
      return { ok: false, reason: 'Номер брони — текст или null' };
    v.reservationNumber = n === null ? null : (n as string).trim();
  }
  if ('done' in b) {
    if (typeof b['done'] !== 'boolean') return { ok: false, reason: 'done — да или нет' };
    v.done = b['done'];
  }
  return { ok: true, value: v };
}

export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'done';

/** Куда задача попадает в списке: сделанные отдельно, открытые — по сроку относительно «сегодня» объекта */
export function taskBucket(t: { dueDate: string; done: boolean }, today: string): TaskBucket {
  if (t.done) return 'done';
  return t.dueDate < today ? 'overdue' : t.dueDate === today ? 'today' : 'upcoming';
}
