import type { BeautyCustomerRow } from '../../lib/api';
import { msg } from '../../i18n';

/**
 * Отборы списка (владелец 01.11.2026: «все клиенты это те, кто пришёл и оплатил»): «Все клиенты», «Новые», «Постоянные»
 * и VIP только среди людей с оплаченным визитом; «Не дошли» записывались и не пришли; «Пока без визита» остальные.
 */
export type BeautyCustomerSegmentFilter = 'all' | 'new' | 'regular' | 'vip' | 'no-show' | 'pending' | 'archived';
export const BEAUTY_CUSTOMER_SEGMENTS: readonly BeautyCustomerSegmentFilter[] = ['all', 'new', 'regular', 'vip', 'no-show', 'pending', 'archived'];

export interface BeautyCustomerFilter {
  query: string;
  segment: BeautyCustomerSegmentFilter;
}

export const BEAUTY_REGULAR_CUSTOMER_VISITS = 2;

/**
 * Сегмент клиента одним правилом для списка и карточки (аудит 21.10.2026 п.11: в карточке «Активен», в списке «Новый»).
 * `visits` это завершённые визиты, как считает API списка.
 */
export function customerSegment(row: { status: string; visits: number; paidVisits?: number; noShows?: number }): {
  label: string;
  tone: 'info' | 'ok' | 'neutral' | 'warn';
} {
  if (row.status !== 'ACTIVE') return { label: msg('В архиве'), tone: 'neutral' };
  // список знает оплаченные визиты и неявки; карточка клиента их не получает и считает по завершённым визитам
  const paid = row.paidVisits ?? row.visits;
  if (row.paidVisits !== undefined && paid === 0)
    return (row.noShows ?? 0) > 0 ? { label: msg('Не дошёл'), tone: 'warn' } : { label: msg('Пока без визита'), tone: 'neutral' };
  return paid >= BEAUTY_REGULAR_CUSTOMER_VISITS
    ? { label: msg('Постоянный'), tone: 'ok' }
    : { label: msg('Новый'), tone: 'info' };
}

export function filterBeautyCustomers(
  items: BeautyCustomerRow[],
  filter: BeautyCustomerFilter,
): BeautyCustomerRow[] {
  const needle = filter.query.trim().toLocaleLowerCase('ru');
  return items.filter((row) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ');
    if (needle && !`${name} ${row.phone ?? ''}`.toLocaleLowerCase('ru').includes(needle)) return false;
    if (filter.segment === 'archived') return row.status !== 'ACTIVE';
    if (row.status !== 'ACTIVE') return false;
    const paid = row.paidVisits > 0;
    if (filter.segment === 'no-show') return !paid && row.noShows > 0;
    if (filter.segment === 'pending') return !paid && row.noShows === 0;
    if (!paid) return false;
    if (filter.segment === 'new') return row.paidVisits < BEAUTY_REGULAR_CUSTOMER_VISITS;
    if (filter.segment === 'regular') return row.paidVisits >= BEAUTY_REGULAR_CUSTOMER_VISITS;
    if (filter.segment === 'vip') return row.isVip;
    return true;
  });
}
