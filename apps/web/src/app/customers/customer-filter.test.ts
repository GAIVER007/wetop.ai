import { describe, expect, it } from 'vitest';
import type { BeautyCustomerRow } from '../../lib/api';
import { filterBeautyCustomers } from './customer-filter';

const row = (overrides: Partial<BeautyCustomerRow>): BeautyCustomerRow => ({
  id: 'customer-test',
  firstName: 'Алия',
  lastName: 'Ким',
  phone: '+77000000001',
  status: 'ACTIVE',
  visits: 0,
  lastVisitAt: null,
  avgCheckMinor: null,
  avgCheckCurrency: null,
  isVip: false,
  birthDate: null,
  birthdayInDays: null,
  ...overrides,
});

describe('D2: единый отбор клиентов для таблицы и XLSX', () => {
  const items = [
    row({ id: 'new', firstName: 'Алия', visits: 1 }),
    row({ id: 'regular', firstName: 'Борис', visits: 2 }),
    row({ id: 'vip', firstName: 'Вера', isVip: true }),
    row({ id: 'archived', firstName: 'Галина', status: 'ARCHIVED' }),
  ];

  it('применяет поиск по имени или телефону и выбранный сегмент', () => {
    expect(filterBeautyCustomers(items, { query: 'бор', segment: 'regular' }).map((item) => item.id)).toEqual(['regular']);
    expect(filterBeautyCustomers(items, { query: '0001', segment: 'vip' }).map((item) => item.id)).toEqual(['vip']);
    expect(filterBeautyCustomers(items, { query: '', segment: 'archived' }).map((item) => item.id)).toEqual(['archived']);
  });
});
