/**
 * Очередь «Платформа → Техподдержка» словами стойки (план `plans/support-assistant-v2-2026-09-29.md`, S1). Отбор,
 * приоритет и порядок строк считает API (`apps/api/src/platform/support.queue.ts`); здесь — только подписи.
 */

export const SUPPORT_QUEUES = [
  'open',
  'new',
  'waiting',
  'needs_human',
  'owner_takeover',
  'bot_active',
  'closed',
] as const;
export type SupportQueue = (typeof SUPPORT_QUEUES)[number];

export interface SupportQueueCounts {
  open: number;
  new: number;
  waiting: number;
  needs_human: number;
  owner_takeover: number;
  bot_active: number;
  capped: boolean;
}

export type SupportPriority = 'urgent' | 'waiting' | 'normal';

/**
 * Категория обращения (план `plans/support-queue-hygiene-2026-10-02.md` §3). Считает API по первому
 * сообщению пользователя; здесь только подписи и разбор адреса.
 */
export const SUPPORT_CATEGORIES = ['platform', 'error', 'payment', 'access', 'other'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export const SUPPORT_CATEGORY_FILTERS = ['all', ...SUPPORT_CATEGORIES] as const;
export type SupportCategoryFilter = (typeof SUPPORT_CATEGORY_FILTERS)[number];

export interface SupportCategoryCounts extends Record<SupportCategory, number> {
  all: number;
}

export const CATEGORY_CHIPS: ReadonlyArray<{
  category: SupportCategoryFilter;
  label: string;
}> = [
  { category: 'all', label: 'Все' },
  { category: 'platform', label: 'Вопрос по платформе' },
  { category: 'error', label: 'Ошибка' },
  { category: 'payment', label: 'Возврат и оплата' },
  { category: 'access', label: 'Доступ и права' },
  { category: 'other', label: 'Другое' },
];

export const categoryOf = (raw: string | undefined): SupportCategoryFilter =>
  (SUPPORT_CATEGORY_FILTERS as readonly string[]).includes(raw ?? '')
    ? (raw as SupportCategoryFilter)
    : 'all';

/** Число в чипе категории: ноль показываем, иначе непонятно, куда делись обращения */
export const categoryChipCount = (
  category: SupportCategoryFilter,
  counts: SupportCategoryCounts,
): string => String(counts[category] ?? 0);

/** Чем пуста выбранная категория: статус уже отобрал строки, значит дело в категории */
export const emptyCategoryText = (category: SupportCategoryFilter): string | null =>
  category === 'all'
    ? null
    : `В этой категории обращений нет. Категорию помощник не спрашивает: её определяет первое сообщение.`;

export interface SupportLastMessage {
  role: string;
  text: string;
  at: string | null;
}

export const QUEUE_CHIPS: ReadonlyArray<{ queue: SupportQueue; label: string }> = [
  { queue: 'open', label: 'Все открытые' },
  { queue: 'new', label: 'Новые' },
  { queue: 'waiting', label: 'Ждут ответа' },
  { queue: 'needs_human', label: 'Нужен человек' },
  { queue: 'owner_takeover', label: 'Ведёт оператор' },
  { queue: 'bot_active', label: 'Ведёт ИИ' },
  { queue: 'closed', label: 'Закрытые' },
];

export const queueOf = (raw: string | undefined): SupportQueue =>
  (SUPPORT_QUEUES as readonly string[]).includes(raw ?? '') ? (raw as SupportQueue) : 'open';

/** Число в чипе; закрытых API не считает — у чипа числа нет. Выборка открытых упёрлась в предел — «200+» */
export function chipCount(queue: SupportQueue, counts: SupportQueueCounts): string | null {
  if (queue === 'closed') return null;
  const n = counts[queue === 'open' ? 'open' : queue];
  return counts.capped ? `${n}+` : String(n);
}

/** Сколько человек ждёт ответа: «ждёт 12 мин», «ждёт 2 ч 5 мин», «ждёт 3 дн.»; не ждёт — `null` */
export function waitingFor(since: string | null, now = Date.now()): string | null {
  if (!since) return null;
  const minutes = Math.floor((now - Date.parse(since)) / 60_000);
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 1) return 'ждёт меньше минуты';
  if (minutes < 60) return `ждёт ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `ждёт ${hours} ч ${minutes % 60} мин` : `ждёт ${hours} ч`;
  return `ждёт ${Math.floor(hours / 24)} дн.`;
}

/** Приоритет словом: «срочно» — нужен человек; «ждёт…» — последнее слово за пользователем; иначе метки нет */
export function priorityBadge(item: {
  priority: SupportPriority;
  mode: string;
  closed: boolean;
}): { label: string; tone: 'danger' | 'warn' } | null {
  if (item.closed) return null;
  if (item.priority === 'urgent') return { label: 'срочно', tone: 'danger' };
  if (item.priority === 'waiting')
    return {
      label: item.mode === 'owner_takeover' ? 'ждёт оператора' : 'ждёт ответа',
      tone: 'warn',
    };
  return null;
}

const SPEAKER: Record<string, string> = {
  user: 'Пользователь',
  assistant: 'ИИ',
  operator: 'Оператор',
  system: 'Система',
};

export const speaker = (role: string) => SPEAKER[role] ?? role;

export function lastMessageLine(last: SupportLastMessage | null): string {
  return last ? `${speaker(last.role)}: ${last.text}` : '—';
}

const EMPTY: Record<SupportQueue, { title: string; text: string }> = {
  open: {
    title: 'Открытых обращений нет',
    text: 'Здесь появятся разговоры помощника с теми, кто пишет из стойки и с wetop.ai.',
  },
  new: { title: 'Новых обращений нет', text: 'За последние сутки никто не начинал разговор.' },
  waiting: {
    title: 'Никто не ждёт ответа',
    text: 'Во всех открытых диалогах последнее слово за помощником или оператором.',
  },
  needs_human: {
    title: 'Человек никому не нужен',
    text: 'Помощник справляется сам. Диалог попадёт сюда, когда помощник позовёт человека.',
  },
  owner_takeover: {
    title: 'Оператор ничего не ведёт',
    text: 'Заберите диалог из очереди — он появится здесь.',
  },
  bot_active: { title: 'ИИ сейчас ничего не ведёт', text: 'Все открытые диалоги у операторов.' },
  closed: { title: 'Закрытых обращений нет', text: 'Закрытый диалог остаётся здесь с перепиской.' },
};

export const emptyQueueText = (queue: SupportQueue) => EMPTY[queue];
