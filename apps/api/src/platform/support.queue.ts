import { BadRequestException } from '@nestjs/common';
import type { assistant } from '@pms/integrations';
import { CONVERSATION_MODES, list, num, obj, str } from '../bots/panel';

/**
 * Очередь «Платформа → Техподдержка» (план `plans/support-assistant-v2-2026-09-29.md`, S1). Отбор — у помощника
 * в SQL; здесь — слова стойки, приоритет и порядок строк, числа очереди по выборке открытых.
 */

export const SUPPORT_QUEUES = ['open', 'new', 'waiting', ...CONVERSATION_MODES, 'closed'] as const;
export type SupportQueue = (typeof SUPPORT_QUEUES)[number];

/** Сколько открытых берём для чисел очереди; больше — числа с пометкой «не меньше» (`capped`) */
export const OPEN_WINDOW = 200;
/** Строк в выбранной очереди, если это не «все открытые» */
export const QUEUE_PAGE = 100;
/** «Новые» — начатые за сутки: так же считает помощник (`queue=new`) и сводка «Диалогов за сутки» */
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function supportQueue(raw: unknown): SupportQueue {
  if (raw === undefined || raw === '') return 'open';
  const value = String(raw);
  if (!(SUPPORT_QUEUES as readonly string[]).includes(value))
    throw new BadRequestException(`Очередь: ${SUPPORT_QUEUES.join(', ')}`);
  return value as SupportQueue;
}

/** Что спросить у помощника для очереди; «все открытые» — та же выборка, что для чисел */
export function queueRequest(queue: SupportQueue): assistant.ConversationListQuery | null {
  if (queue === 'open') return null;
  if (queue === 'closed') return { nonempty: true, closed: true, limit: QUEUE_PAGE };
  const base = { nonempty: true, closed: false, limit: QUEUE_PAGE };
  if (queue === 'new' || queue === 'waiting') return { ...base, queue };
  return { ...base, mode: queue };
}

export const OPEN_REQUEST: assistant.ConversationListQuery = {
  nonempty: true,
  closed: false,
  limit: OPEN_WINDOW,
};

/**
 * Приоритет словом, без новых данных: нужен человек — «срочно»; последнее слово за пользователем — «ждёт»;
 * у закрытого — ничего.
 */
export type SupportPriority = 'urgent' | 'waiting' | 'normal';

export interface SupportQueueItem {
  id: string;
  channel: string;
  clientName: string | null;
  mode: string;
  stage: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  messages: number;
  lastMessage: { role: string; text: string; at: string | null } | null;
  waitingSince: string | null;
  closed: boolean;
  priority: SupportPriority;
}

export function queueItems(body: unknown): SupportQueueItem[] {
  return list(obj(body).items).map((item) => {
    const i = obj(item);
    const last = i.last_message ? obj(i.last_message) : null;
    const mode = str(i.mode) ?? '';
    const closed = i.closed === true;
    const waitingSince = str(i.waiting_since);
    return {
      id: str(i.id) ?? '',
      channel: str(i.channel) ?? '',
      clientName: str(i.client_name),
      mode,
      stage: str(i.stage) ?? '',
      startedAt: str(i.started_at),
      lastActivityAt: str(i.last_activity_at),
      messages: num(i.messages),
      lastMessage: last
        ? { role: str(last.role) ?? '', text: str(last.text) ?? '', at: str(last.at) }
        : null,
      waitingSince,
      closed,
      priority: closed
        ? 'normal'
        : mode === 'needs_human'
          ? 'urgent'
          : waitingSince
            ? 'waiting'
            : 'normal',
    };
  });
}

const RANK: Record<SupportPriority, number> = { urgent: 0, waiting: 1, normal: 2 };
const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

/** Срочные, потом дольше ждущие (раньше начали ждать — выше), потом по последней активности */
export function sortQueue(items: SupportQueueItem[]): SupportQueueItem[] {
  return [...items].sort((a, b) => {
    const rank = RANK[a.priority] - RANK[b.priority];
    if (rank !== 0) return rank;
    if (a.waitingSince && b.waitingSince) return time(a.waitingSince) - time(b.waitingSince);
    if (a.waitingSince !== b.waitingSince) return a.waitingSince ? -1 : 1;
    return time(b.lastActivityAt) - time(a.lastActivityAt);
  });
}

export interface SupportQueueCounts {
  open: number;
  new: number;
  waiting: number;
  needs_human: number;
  owner_takeover: number;
  bot_active: number;
  /** Открытых больше окна — числа «не меньше» */
  capped: boolean;
}

export function queueCounts(open: SupportQueueItem[], now = Date.now()): SupportQueueCounts {
  const count = (test: (i: SupportQueueItem) => boolean) => open.filter(test).length;
  return {
    open: open.length,
    new: count((i) => i.startedAt !== null && now - time(i.startedAt) <= NEW_WINDOW_MS),
    waiting: count((i) => i.waitingSince !== null),
    needs_human: count((i) => i.mode === 'needs_human'),
    owner_takeover: count((i) => i.mode === 'owner_takeover'),
    bot_active: count((i) => i.mode === 'bot_active'),
    capped: open.length >= OPEN_WINDOW,
  };
}
