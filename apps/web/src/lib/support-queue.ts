import { msg, translator, type Translate } from '../i18n';

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
  { category: 'all', label: msg('Все') },
  { category: 'platform', label: msg('Вопрос по платформе') },
  { category: 'error', label: msg('Ошибка') },
  { category: 'payment', label: msg('Возврат и оплата') },
  { category: 'access', label: msg('Доступ и права') },
  { category: 'other', label: msg('Другое') },
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
    : msg('В этой категории обращений нет. Категорию помощник не спрашивает: её определяет первое сообщение.');

export interface SupportLastMessage {
  role: string;
  text: string;
  at: string | null;
}

export const QUEUE_CHIPS: ReadonlyArray<{ queue: SupportQueue; label: string }> = [
  { queue: 'open', label: msg('Все открытые') },
  { queue: 'new', label: msg('Новые') },
  { queue: 'waiting', label: msg('Ждут ответа') },
  { queue: 'needs_human', label: msg('Нужен человек') },
  { queue: 'owner_takeover', label: msg('Ведёт оператор') },
  { queue: 'bot_active', label: msg('Ведёт ИИ') },
  { queue: 'closed', label: msg('Закрытые') },
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
export function waitingFor(since: string | null, now = Date.now(), t: Translate = translator('ru')): string | null {
  if (!since) return null;
  const minutes = Math.floor((now - Date.parse(since)) / 60_000);
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 1) return t('ждёт меньше минуты');
  if (minutes < 60) return t('ждёт {n} мин', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return minutes % 60 ? t('ждёт {h} ч {m} мин', { h: hours, m: minutes % 60 }) : t('ждёт {h} ч', { h: hours });
  return t('ждёт {n} дн.', { n: Math.floor(hours / 24) });
}

/** Приоритет словом: «срочно» — нужен человек; «ждёт…» — последнее слово за пользователем; иначе метки нет */
export function priorityBadge(item: {
  priority: SupportPriority;
  mode: string;
  closed: boolean;
}): { label: string; tone: 'danger' | 'warn' } | null {
  if (item.closed) return null;
  if (item.priority === 'urgent') return { label: msg('срочно'), tone: 'danger' };
  if (item.priority === 'waiting')
    return {
      label: item.mode === 'owner_takeover' ? msg('ждёт оператора') : msg('ждёт ответа'),
      tone: 'warn',
    };
  return null;
}

const SPEAKER: Record<string, string> = {
  user: msg('Пользователь'),
  assistant: msg('ИИ'),
  operator: msg('Оператор'),
  system: msg('Система'),
};

export const speaker = (role: string) => SPEAKER[role] ?? role;

export function lastMessageLine(last: SupportLastMessage | null, t: Translate = translator('ru')): string {
  return last ? `${t(speaker(last.role))}: ${last.text}` : '—';
}

const EMPTY: Record<SupportQueue, { title: string; text: string }> = {
  open: {
    title: msg('Открытых обращений нет'),
    text: msg('Здесь появятся разговоры помощника с теми, кто пишет из стойки и с wetop.ai.'),
  },
  new: { title: msg('Новых обращений нет'), text: msg('За последние сутки никто не начинал разговор.') },
  waiting: {
    title: msg('Никто не ждёт ответа'),
    text: msg('Во всех открытых диалогах последнее слово за помощником или оператором.'),
  },
  needs_human: {
    title: msg('Человек никому не нужен'),
    text: msg('Помощник справляется сам. Диалог попадёт сюда, когда помощник позовёт человека.'),
  },
  owner_takeover: {
    title: msg('Оператор ничего не ведёт'),
    text: msg('Заберите диалог из очереди — он появится здесь.'),
  },
  bot_active: { title: msg('ИИ сейчас ничего не ведёт'), text: msg('Все открытые диалоги у операторов.') },
  closed: { title: msg('Закрытых обращений нет'), text: msg('Закрытый диалог остаётся здесь с перепиской.') },
};

export const emptyQueueText = (queue: SupportQueue) => EMPTY[queue];
