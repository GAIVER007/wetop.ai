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
  paidVisits: 0,
  noShows: 0,
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
    row({ id: 'new', firstName: 'Алия', visits: 1, paidVisits: 1 }),
    row({ id: 'regular', firstName: 'Борис', visits: 2, paidVisits: 2 }),
    row({ id: 'vip', firstName: 'Вера', isVip: true, visits: 1, paidVisits: 1 }),
    row({ id: 'archived', firstName: 'Галина', status: 'ARCHIVED' }),
  ];

  it('применяет поиск по имени или телефону и выбранный сегмент', () => {
    expect(filterBeautyCustomers(items, { query: 'бор', segment: 'regular' }).map((item) => item.id)).toEqual(['regular']);
    expect(filterBeautyCustomers(items, { query: '0001', segment: 'vip' }).map((item) => item.id)).toEqual(['vip']);
    expect(filterBeautyCustomers(items, { query: '', segment: 'archived' }).map((item) => item.id)).toEqual(['archived']);
  });
});

/**
 * «Клиенты» салона (владелец 01.11.2026: «все клиенты это те, кто пришёл и оплатил»): в общем списке только люди с
 * оплаченным визитом; кто записался и не пришёл, отдельно «Не дошли»; кто ещё не был, отдельно «Пока без визита».
 */
describe('клиенты это пришли и оплатили', () => {
  const people = [
    row({ id: 'paid', firstName: 'Алия', visits: 1, paidVisits: 1 }),
    row({ id: 'paid-regular', firstName: 'Борис', visits: 3, paidVisits: 3 }),
    row({ id: 'unpaid', firstName: 'Вера', visits: 1, paidVisits: 0 }),
    row({ id: 'no-show', firstName: 'Галина', visits: 0, paidVisits: 0, noShows: 2 }),
    row({ id: 'new', firstName: 'Дина', visits: 0, paidVisits: 0, noShows: 0 }),
    row({ id: 'archived', firstName: 'Ерлан', status: 'ARCHIVED', visits: 2, paidVisits: 2 }),
  ];
  const ids = (segment: Parameters<typeof filterBeautyCustomers>[1]['segment']) =>
    filterBeautyCustomers(people, { query: '', segment }).map((item) => item.id);
  it('«Все клиенты» только с оплаченным визитом', () => {
    expect(ids('all')).toEqual(['paid', 'paid-regular']);
  });
  it('«Не дошли» отдельно: записывались, не пришли, оплаченного визита нет', () => {
    expect(ids('no-show')).toEqual(['no-show']);
  });
  it('«Пока без визита»: остальные активные без оплаченного визита', () => {
    expect(ids('pending')).toEqual(['unpaid', 'new']);
  });
  it('новые и постоянные считаются среди пришедших и оплативших', () => {
    expect(ids('new')).toEqual(['paid']);
    expect(ids('regular')).toEqual(['paid-regular']);
  });
});
