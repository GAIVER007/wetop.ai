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
  if (queue === 'closed')
    return { nonempty: true, closed: true, limit: QUEUE_PAGE, excludeSandbox: true };
  const base = { nonempty: true, closed: false, limit: QUEUE_PAGE, excludeSandbox: true };
  if (queue === 'new' || queue === 'waiting') return { ...base, queue };
  return { ...base, mode: queue };
}

export const OPEN_REQUEST: assistant.ConversationListQuery = {
  nonempty: true,
  closed: false,
  limit: OPEN_WINDOW,
  // Вкладка «Проверка» заводит диалог канала `sandbox`: без этого очередь показывает
  // проверки агента как обращения партнёров (02.10.2026: все четыре строки были ими).
  excludeSandbox: true,
};

/**
 * Приоритет словом, без новых данных: нужен человек — «срочно»; последнее слово за пользователем — «ждёт»;
 * у закрытого — ничего.
 */
export type SupportPriority = 'urgent' | 'waiting' | 'normal';

/**
 * Категория обращения (план `plans/support-queue-hygiene-2026-10-02.md` §3). Порядок задан для показа;
 * правила разбираются в своём порядке, см. `RULES`.
 */
export const SUPPORT_CATEGORIES = ['platform', 'error', 'payment', 'access', 'other'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export const SUPPORT_CATEGORY_FILTERS = ['all', ...SUPPORT_CATEGORIES] as const;
export type SupportCategoryFilter = (typeof SUPPORT_CATEGORY_FILTERS)[number];

export function supportCategoryFilter(raw: unknown): SupportCategoryFilter {
  if (raw === undefined || raw === '') return 'all';
  const value = String(raw);
  if (!(SUPPORT_CATEGORY_FILTERS as readonly string[]).includes(value))
    throw new BadRequestException(`Категория: ${SUPPORT_CATEGORY_FILTERS.join(', ')}`);
  return value as SupportCategoryFilter;
}

/**
 * Признаки категории. Слово с пробелом ищется в тексте целиком, остальное по НАЧАЛУ слова:
 * «оплат» ловит «оплате» и «оплатить», но «роль» не ловит «контроль», а «права» не ловит «правки».
 * Поиском подстроки это не сделать, а `\b` в JS знает только латиницу.
 */
const RULES: ReadonlyArray<readonly [Exclude<SupportCategory, 'other'>, readonly string[]]> = [
  // Поломка сильнее денег и доступа: «ошибка при оплате» и «500 на странице тарифов» значат, что сломалось
  [
    'error',
    [
      'ошибк',
      'баг',
      'зависа',
      'падает',
      'вылета',
      'сломал',
      '500',
      '502',
      'не работает',
      'не сохраняется',
      'не открывается',
      'не загружается',
    ],
  ],
  ['payment', ['возврат', 'вернут', 'оплат', 'платеж', 'списал', 'тариф', 'подписк', 'деньг', 'чек']],
  [
    'access',
    [
      'доступ',
      'права',
      'право',
      'роль',
      'роли',
      'сотрудник',
      'приглашен',
      'пароль',
      'войти',
      'вход',
      'заблокирован',
    ],
  ],
  ['platform', ['как', 'где', 'можно', 'подскажит', 'не могу найти', '?']],
];

const normalize = (text: string) => text.toLowerCase().replace(/ё/g, 'е');

export function supportCategory(text: string): SupportCategory {
  const flat = normalize(text);
  const words = flat.split(/[^0-9a-zа-я]+/).filter(Boolean);
  const hit = (sign: string) =>
    sign.includes(' ') || sign === '?'
      ? flat.includes(sign)
      : words.some((word) => word.startsWith(sign));
  return RULES.find(([, signs]) => signs.some(hit))?.[0] ?? 'other';
}

/** Категория по первому сообщению диалога: не пользователь или сообщения нет, ставим «другое», а не догадку */
export const supportCategoryOf = (
  first: { role: string; text: string; at?: string | null } | null,
): SupportCategory => (first && first.role === 'user' ? supportCategory(first.text) : 'other');

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
  /** Первое сообщение пользователя: в нём стоит сам вопрос, по нему и считается категория */
  firstMessage: { role: string; text: string; at: string | null } | null;
  category: SupportCategory;
  waitingSince: string | null;
  closed: boolean;
  priority: SupportPriority;
}

export function queueItems(body: unknown): SupportQueueItem[] {
  return list(obj(body).items).map((item) => {
    const i = obj(item);
    const last = i.last_message ? obj(i.last_message) : null;
    const firstRaw = i.first_message ? obj(i.first_message) : null;
    const firstMessage = firstRaw
      ? { role: str(firstRaw.role) ?? '', text: str(firstRaw.text) ?? '', at: str(firstRaw.at) }
      : null;
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
      firstMessage,
      category: supportCategoryOf(firstMessage),
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

export interface SupportCategoryCounts extends Record<SupportCategory, number> {
  all: number;
}

/**
 * Числа по категориям считаются по строкам ВЫБРАННОГО статуса: сколько в чипе, столько и покажет отбор.
 * ponytail: внутри окна `OPEN_WINDOW`; категория производная, в SQL её считать нечем. При нынешних
 * объёмах это не ограничение: упрётся, когда открытых станет больше двухсот.
 */
export function categoryCounts(items: ReadonlyArray<{ category: SupportCategory }>): SupportCategoryCounts {
  const counts = Object.fromEntries(SUPPORT_CATEGORIES.map((c) => [c, 0])) as Record<
    SupportCategory,
    number
  >;
  for (const item of items) counts[item.category] += 1;
  return { ...counts, all: items.length };
}

export function filterByCategory<T extends { category: SupportCategory }>(
  items: readonly T[],
  category: SupportCategoryFilter,
): T[] {
  return category === 'all' ? [...items] : items.filter((item) => item.category === category);
}
