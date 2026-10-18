import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
import type { BeautyDay } from '../../lib/api';
import type { FoodPeriodReport, RestaurantReservation } from '../../lib/food-types';
import { beautySales, foodSales, salesPeriodFor } from './business-sales';
import { buildBeautyFinance, buildBeautyFinanceGroups } from '../finance/beauty-finance';

const appt = (id: string, status: string, priceMinor: string, employeeId = 'e1', serviceName = 'Стрижка') =>
  ({
    id,
    employeeId,
    serviceId: 's',
    serviceName,
    customer: { id: 'c', name: 'Анна', phone: null },
    startsAt: '2026-10-14T05:00:00.000Z',
    endsAt: '2026-10-14T06:00:00.000Z',
    startMinutes: 600,
    endMinutes: 660,
    status,
    next: [],
    priceMinor,
    paidMinor: '0',
    refundedMinor: '0',
    currency: 'KZT',
    notes: null,
  }) as BeautyDay['appointments'][number];

const day = (date: string, appointments: BeautyDay['appointments']): BeautyDay =>
  ({
    location: { id: 'l', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
    date,
    columns: [
      { id: 'e1', name: 'Мария', intervals: [], timeOff: false, timeOffReason: null, serviceIds: [] },
      { id: 'e2', name: 'Дина', intervals: [], timeOff: false, timeOffReason: null, serviceIds: [] },
    ],
    appointments,
    services: [],
  }) as unknown as BeautyDay;

describe('период продаж', () => {
  it('7 дней по умолчанию и 30 по выбору, считая сегодня', () => {
    expect(salesPeriodFor({}, '2026-10-14')).toEqual({ from: '2026-10-08', to: '2026-10-14', preset: '7' });
    expect(salesPeriodFor({ days: '30' }, '2026-10-14')).toEqual({ from: '2026-09-15', to: '2026-10-14', preset: '30' });
  });
  it('свой период до 31 дня; будущее и слишком длинный период откатываются к 7 дням', () => {
    expect(salesPeriodFor({ from: '2026-10-01', to: '2026-10-10' }, '2026-10-14').preset).toBe('custom');
    expect(salesPeriodFor({ from: '2026-10-01', to: '2026-10-20' }, '2026-10-14').preset).toBe('7');
    expect(salesPeriodFor({ from: '2026-08-01', to: '2026-10-10' }, '2026-10-14').preset).toBe('7');
  });
});

describe('продажи салона', () => {
  it('выручка только по выполненным записям, потери это неявки и отмены', () => {
    const r = beautySales([
      day('2026-10-13', [appt('a', 'DONE', '500000'), appt('b', 'NO_SHOW', '300000')]),
      day('2026-10-14', [
        appt('c', 'DONE', '700000', 'e2', 'Окрашивание'),
        appt('d', 'BOOKED', '200000'),
        appt('e', 'CANCELLED', '100000'),
      ]),
    ]);
    expect(r.revenueMinor).toBe('1200000');
    expect(r.sold).toBe(2);
    expect(r.bookings).toBe(5);
    expect(r.lost).toBe(2);
    expect(r.averageCheckMinor).toBe('600000');
    expect(r.top[0]).toEqual({ name: 'Окрашивание', count: 1, revenueMinor: '700000' });
    expect(r.team.map((t) => t.name)).toEqual(['Дина', 'Мария']);
  });
  it('без выполненных записей средний чек не выдумывается', () => {
    expect(beautySales([day('2026-10-14', [appt('a', 'BOOKED', '1')])]).averageCheckMinor).toBeNull();
  });
});

describe('продажи ресторана', () => {
  it('берёт выручку, заказы, блюда и официантов из отчёта периода, брони считает по статусам', () => {
    const report = {
      currency: 'KZT',
      revenueMinor: '900000',
      averageCheckMinor: '300000',
      ordersCount: 3,
      guestsCount: 7,
      topDishes: [{ name: 'Плов', qty: 5, revenueMinor: '500000' }],
      waiters: [{ name: 'Айгерим', orders: 3, revenueMinor: '900000' }],
    } as unknown as FoodPeriodReport;
    const res = [{ status: 'COMPLETED' }, { status: 'NO_SHOW' }, { status: 'CANCELLED' }] as RestaurantReservation[];
    const r = foodSales(report, res);
    expect(r.revenueMinor).toBe('900000');
    expect(r.sold).toBe(3);
    expect(r.guests).toBe(7);
    expect(r.bookings).toBe(3);
    expect(r.lost).toBe(2);
    expect(r.top[0]).toEqual({ name: 'Плов', count: 5, revenueMinor: '500000' });
    expect(r.team[0]).toEqual({ name: 'Айгерим', count: 3, revenueMinor: '900000' });
  });
  it('нет отчёта: числа пустые, а не нули', () => {
    const r = foodSales(null, null);
    expect(r.revenueMinor).toBeNull();
    expect(r.bookings).toBeNull();
  });
});

describe('финансы салона', () => {
  it('выручка, ожидаемое и потери по неделе; мастера по выручке', () => {
    const v = buildBeautyFinance([
      day('2026-10-14', [appt('c', 'DONE', '700000', 'e2'), appt('d', 'CONFIRMED', '200000')]),
      day('2026-10-13', [appt('a', 'DONE', '500000'), appt('b', 'NO_SHOW', '300000')]),
    ]);
    expect(v.from).toBe('2026-10-13');
    expect(v.today).toBe('2026-10-14');
    expect(v.revenue).toBe(1200000n);
    expect(v.expected).toBe(200000n);
    expect(v.lost).toBe(300000n);
    expect(v.masters.map((m) => m.name)).toEqual(['Дина', 'Мария']);
    expect(v.days.map((d) => d.revenue)).toEqual([500000n, 700000n]);
  });
});

describe('финансы салона: возвраты отдельно от выручки (§54, как ADR-176)', () => {
  it('выручка по выполненным записям не уменьшается, возвраты считаются отдельно', () => {
    const refunded = { ...appt('r1', 'DONE', '800000'), refundedMinor: '300000' };
    const v = buildBeautyFinance([day('2026-10-14', [refunded, appt('r2', 'DONE', '200000'), appt('r3', 'BOOKED', '500000')])]);
    expect([v.revenue, v.refunded]).toEqual([1000000n, 300000n]);
  });
});

it('attributes service revenue to every master without counting the visit twice', () => {
  const row = appt('multi', 'DONE', '10000');
  row.items = [
    { id: 'line1', position: 0, employeeId: 'e1', employeeName: 'Мария', serviceId: 'cut', serviceName: 'Стрижка', startsAt: row.startsAt, endsAt: row.endsAt, startMinutes: 600, endMinutes: 630, durationMinutes: 30, basePriceMinor: '4000', discountMinor: '0', surchargeMinor: '0', priceMinor: '4000', currency: 'KZT', discountPercent: null },
    { id: 'line2', position: 1, employeeId: 'e2', employeeName: 'Дина', serviceId: 'colour', serviceName: 'Окрашивание', startsAt: row.startsAt, endsAt: row.endsAt, startMinutes: 630, endMinutes: 660, durationMinutes: 30, basePriceMinor: '6000', discountMinor: '0', surchargeMinor: '0', priceMinor: '6000', currency: 'KZT', discountPercent: null },
  ];
  const input = [day('2026-10-14', [row])];
  const finance = buildBeautyFinance(input);
  expect(finance.revenue).toBe(10000n);
  expect(finance.done).toHaveLength(1);
  expect(finance.masters).toEqual([{ name: 'Дина', count: 1, revenue: 6000n }, { name: 'Мария', count: 1, revenue: 4000n }]);
  const sales = beautySales(input);
  expect(sales.bookings).toBe(1);
  expect(sales.top).toEqual([{ name: 'Окрашивание', count: 1, revenueMinor: '6000' }, { name: 'Стрижка', count: 1, revenueMinor: '4000' }]);
});


it('does not sum historical appointment currencies into the current branch currency', () => {
  const usd = { ...appt('usd-visit', 'DONE', '1200'), currency: 'USD' };
  const kzt = appt('kzt-visit', 'DONE', '500000');
  expect(() => buildBeautyFinance([day('2026-10-14', [usd, kzt])])).toThrow(/currenc|валют/i);
});


it('keeps USD and KZT totals, refunds and masters in separate report groups', () => {
  const usd = { ...appt('usd-visit', 'DONE', '1200'), currency: 'USD', refundedMinor: '100' };
  const kzt = appt('kzt-visit', 'DONE', '500000');
  const groups = buildBeautyFinanceGroups([day('2026-10-14', [usd, kzt])]);
  expect(groups.map((group) => [group.currency, group.revenue, group.refunded])).toEqual([
    ['KZT', 500000n, 0n], ['USD', 1200n, 100n],
  ]);
  expect(groups.find((group) => group.currency === 'USD')?.masters[0]?.revenue).toBe(1200n);
  expect(groups.flatMap((group) => group.done)).toHaveLength(2);
});
