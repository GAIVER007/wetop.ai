import { MARKETING_PLATFORM_LABELS } from '@pms/domain';
import { intlLocale, msg, type DeskLocale } from '../../../i18n';
import { dateFormat } from '../../../i18n/dates';
import type { MarketingBudgetView } from '../../../lib/api';

/** Подписи каналов (ТЗ §4): словами, как на макете; русские «Сайт», «Телефон», «Прочие» переводит `t(platformLabel(p))` при показе */
export const PLATFORM_LABELS: Record<string, string> = MARKETING_PLATFORM_LABELS;
export const platformLabel = (p: string): string => PLATFORM_LABELS[p] ?? p;

/** Статьи-подсказки формы: свободный текст, список не ограничивает (DATA_MODEL §41.1) */
export const CATEGORY_HINTS = ['Реклама', 'Креативы', 'Инфлюенсеры', 'Подписки и сервисы', 'Прочее']; // kk-allow: подсказка статьи это данные: значение уходит в базу как статья расхода

/** «Октябрь 2026» из «2026-10»; на языке человека, если передан */
export function monthTitle(month: string, locale: DeskLocale = 'ru'): string {
  const text = dateFormat(intlLocale(locale), { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(/\s*г\.$/, ''); // kk-allow: русский суффикс года «г.» из Intl ru-RU
}

export function monthShift(month: string, shift: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + shift;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Заголовок раздела на всех вкладках: один пункт меню «Бюджет и аналитика» (решение владельца 20.10.2026); показывать `t(BUDGET_TITLE)` */
export const BUDGET_TITLE = msg('Бюджет и аналитика');

export type BudgetTab = 'summary' | 'plan' | 'expenses' | 'analytics';

/* Переключатель месяца, вкладки, доли платформ и «Выберите филиал» рисуются на языке человека клиентским куском */
export { BudgetTabs, ChooseLocation, MonthNav, PlatformShares } from './parts-client';

export type { MarketingBudgetView };
