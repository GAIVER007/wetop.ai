import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
import type { BeautyDay } from '../../lib/api';
import type { FoodPeriodReport, RestaurantReservation } from '../../lib/food-types';
import { beautySales, foodSales, salesPeriodFor } from './business-sales';
import { buildBeautyFinance } from '../finance/beauty-finance';

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
