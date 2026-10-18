import type { BeautyCustomerRow } from '../../lib/api';

export type BeautyCustomerSegmentFilter = 'all' | 'new' | 'regular' | 'vip' | 'archived';

export interface BeautyCustomerFilter {
  query: string;
  segment: BeautyCustomerSegmentFilter;
}

export const BEAUTY_REGULAR_CUSTOMER_VISITS = 2;

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
