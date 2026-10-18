import type { WebVertical } from './vertical-landing';

/**
 * «Что нового» (SUP1, plans/support-whatsnew-2026-10-18.md). Каждая выкладка дописывает запись сверху: только о
 * том, что уже доступно на стойке. Без `vertical` запись видят все направления.
 */
export interface WhatsNewEntry {
  /** YYYY-MM-DD, по нему же гаснет точка в меню */
  date: string;
  title: string;
  text: string;
  href?: string;
  vertical?: WebVertical;
}

// Черновые тексты первых записей: утверждает владелец до слияния (план SUP1, «Нужно от владельца» п. 3).
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: '2026-10-18',
    title: 'Связь с поддержкой и «Что нового»',
    text: 'В «Помощи» появились кнопки, чтобы написать нам. Здесь будем коротко рассказывать, что изменилось после обновлений.',
    href: '/help#support',
  },
  {
    date: '2026-10-17',
    title: 'Моя работа: свои записи, график и заработок',
    text: 'Сотрудник видит в меню профиля свои записи, рабочий график и начисления.',
    href: '/my-work',
    vertical: 'BEAUTY',
  },
  {
    date: '2026-10-17',
    title: 'Моя работа: свои смены и заработок',
    text: 'Сотрудник видит в меню профиля свой график и начисления.',
    href: '/my-work',
    vertical: 'FOOD_SERVICE',
  },
  {
    date: '2026-10-16',
    title: 'Склад списывается по техкартам',
    text: 'Когда кухня отмечает блюдо готовым, продукты по техкарте списываются со склада один раз.',
    href: '/stock',
    vertical: 'FOOD_SERVICE',
  },
  {
    date: '2026-10-09',
    title: 'Гости и бронирования на одном экране',
    text: 'Кто проживает, кто заезжает и выезжает сегодня, и карточка гостя справа.',
    href: '/guests',
    vertical: 'HOSPITALITY',
  },
];

export function whatsNewFor(vertical: WebVertical, entries: WhatsNewEntry[] = WHATS_NEW): WhatsNewEntry[] {
  return entries
    .filter((e) => !e.vertical || e.vertical === vertical)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function latestWhatsNew(vertical: WebVertical, entries: WhatsNewEntry[] = WHATS_NEW): string | null {
  return whatsNewFor(vertical, entries)[0]?.date ?? null;
}

/** Ключ браузера: дата последней прочитанной записи (удобство одного человека, не данные) */
export const WHATS_NEW_SEEN_KEY = 'wetop:whats-new-seen';
