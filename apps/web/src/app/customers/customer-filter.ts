import type { BeautyCustomerRow } from '../../lib/api';

export type BeautyCustomerSegmentFilter = 'all' | 'new' | 'regular' | 'vip' | 'archived';

export interface BeautyCustomerFilter {
  query: string;
  segment: BeautyCustomerSegmentFilter;
}

export const BEAUTY_REGULAR_CUSTOMER_VISITS = 2;

/**
 * Сегмент клиента одним правилом для списка и карточки (аудит 21.10.2026 п.11: в карточке «Активен», в списке «Новый»).
 * `visits` это завершённые визиты, как считает API списка.
 */
export function customerSegment(row: { status: string; visits: number }): {
  label: string;
  tone: 'info' | 'ok' | 'neutral';
} {
  if (row.status !== 'ACTIVE') return { label: 'В архиве', tone: 'neutral' };
  return row.visits >= BEAUTY_REGULAR_CUSTOMER_VISITS
    ? { label: 'Постоянный', tone: 'ok' }
    : { label: 'Новый', tone: 'info' };
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
    if (filter.segment === 'new') return row.visits < BEAUTY_REGULAR_CUSTOMER_VISITS;
    if (filter.segment === 'regular') return row.visits >= BEAUTY_REGULAR_CUSTOMER_VISITS;
    if (filter.segment === 'vip') return row.isVip;
    return true;
  });
}
