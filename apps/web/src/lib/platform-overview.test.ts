import { describe, expect, it } from 'vitest';
import { EMPTY_METRICS, type OverviewBranch, type OverviewOrganization } from '@pms/domain';
import {
  branchFigure,
  distribution,
  organizationFigures,
  overviewTotals,
  relativeAgo,
  revenueLine,
  selectOrganizations,
  verticalCounts,
} from './platform-overview';

const branch = (over: Partial<OverviewBranch> & Pick<OverviewBranch, 'id' | 'vertical'>): OverviewBranch => ({
  name: over.id,
  address: null,
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  businessId: 'b',
  metrics: EMPTY_METRICS,
  previous: EMPTY_METRICS,
  ...over,
});
const org = (id: string, createdAt: string, vertical: OverviewBranch['vertical'], branches: OverviewBranch[]): OverviewOrganization => ({
  id,
  name: id,
  status: 'ACTIVE',
  createdAt,
  owners: [],
  businesses: [{ id: `b-${id}`, name: id, vertical }],
  branches,
});

const hotel = org('Отель', '2026-08-01T00:00:00Z', 'HOSPITALITY', [
  branch({ id: 'h1', vertical: 'HOSPITALITY', metrics: { ...EMPTY_METRICS, revenueMinor: 900, occupiedNights: 10, unitNights: 10 } }),
  branch({ id: 'h2', vertical: 'HOSPITALITY', metrics: { ...EMPTY_METRICS, revenueMinor: 100, occupiedNights: 0, unitNights: 90 } }),
]);
const salon = org('Салон', '2026-09-01T00:00:00Z', 'BEAUTY', [
  branch({ id: 's1', vertical: 'BEAUTY', metrics: { ...EMPTY_METRICS, revenueMinor: 500, guests: 1240 } }),
]);
const cafe = org('Кафе', '2026-10-01T00:00:00Z', 'FOOD_SERVICE', [
  branch({ id: 'r1', vertical: 'FOOD_SERVICE', currency: 'USD', metrics: { ...EMPTY_METRICS, guests: 64, bookings: 20 } }),
]);
const all = [hotel, salon, cafe];

describe('сводки страницы «Организации»', () => {
  it('загрузка организации общим числителем и знаменателем, а не средним: 10 из 100, а не 50', () => {
    expect(organizationFigures(hotel).occupancy).toBe(10);
  });

  it('вкладки считают организации с направлением', () => {
    expect(verticalCounts(all)).toEqual({ all: 3, HOSPITALITY: 1, BEAUTY: 1, FOOD_SERVICE: 1 });
  });

  it('итоги: деньги раздельно по валютам, ресторан без дохода отмечен, а не нулём', () => {
    const t = overviewTotals({ organizations: all, newOrganizations: 1 });
    expect(t).toMatchObject({ organizations: 3, branches: 4, businesses: 3, working: 3, newOrganizations: 1 });
    expect(t.revenue).toEqual({ KZT: 1500 });
    expect(t.withoutRevenue).toBe(true);
    expect(t.byVertical).toEqual({ HOSPITALITY: 1, BEAUTY: 1, FOOD_SERVICE: 1 });
  });

  it('отбор по направлению, поиск по названию филиала и порядок', () => {
    expect(selectOrganizations(all, 'BEAUTY', 'date').map((o) => o.id)).toEqual(['Салон']);
    expect(selectOrganizations(all, 'all', 'date').map((o) => o.id)).toEqual(['Кафе', 'Салон', 'Отель']);
    expect(selectOrganizations(all, 'all', 'name').map((o) => o.id)).toEqual(['Кафе', 'Отель', 'Салон']);
    // по доходу: у кафе дохода нет, оно последнее
    expect(selectOrganizations(all, 'all', 'revenue').map((o) => o.id)).toEqual(['Отель', 'Салон', 'Кафе']);
    expect(selectOrganizations(all, 'all', 'date', 's1').map((o) => o.id)).toEqual(['Салон']);
    expect(selectOrganizations(all, 'all', 'date', 'нет такого')).toHaveLength(0);
    expect(selectOrganizations(all, 'all', 'date', 'h2').map((o) => o.id)).toEqual(['Отель']);
  });

  it('распределение: по доходу в основной валюте, без дохода по числу филиалов', () => {
    const d = distribution(all);
    expect(d.basis).toBe('по доходу, KZT');
    expect(d.rows).toEqual([
      { vertical: 'HOSPITALITY', value: 1000, percent: 67 },
      { vertical: 'BEAUTY', value: 500, percent: 33 },
    ]);
    expect(distribution([cafe])).toMatchObject({ basis: 'по числу филиалов', rows: [{ vertical: 'FOOD_SERVICE', percent: 100 }] });
  });

  it('значение филиала: загрузка, клиенты, гости; нет данных не ноль', () => {
    expect(branchFigure(hotel.branches[0]!)).toEqual({ text: '100%', percent: 100 });
    expect(branchFigure(salon.branches[0]!).text).toBe('1240 клиентов');
    expect(branchFigure(cafe.branches[0]!).text).toBe('64 гостя');
    expect(branchFigure(branch({ id: 'x', vertical: 'HOSPITALITY' })).text).toBe('нет данных');
  });

  it('доход строкой по валютам, пусто если дохода нет', () => {
    expect(revenueLine({})).toBeNull();
    expect(revenueLine({ KZT: 432_000_000, USD: 120_000 })).toBe('4 320 000 ₸, 1 200 USD');
  });

  it('«назад» словами', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect(relativeAgo('2026-10-09T09:59:00Z', now)).toBe('2 часа назад');
    expect(relativeAgo('2026-10-08T11:00:00Z', now)).toBe('вчера');
    expect(relativeAgo('2026-10-04T12:00:00Z', now)).toBe('5 дней назад');
    expect(relativeAgo('2026-10-09T11:59:30Z', now)).toBe('только что');
  });
});
