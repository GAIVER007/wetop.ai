import { describe, expect, it } from 'vitest';
import type { BeautyDay } from '../../../../lib/api';
import type { FoodPeriodReport } from '../../../../lib/food-types';
import { beautyInsights, beautyPult, foodInsights, hotelInsights, previousRange } from './pult';

/** Пульт владельца (вариант A, решение владельца 25.10.2026): цифры из уже отдаваемых API данных, синтетика. */
const col = (id: string, name: string, from = '10:00', to = '18:00', timeOff = false) => ({
  id,
  name,
  intervals: [{ timeFrom: from, timeTo: to }],
  timeOff,
  timeOffReason: null,
  serviceIds: [],
});
const appt = (
  over: Partial<BeautyDay['appointments'][number]> & { id: string; employeeId: string },
): BeautyDay['appointments'][number] => ({
  serviceId: 's-cut',
  serviceName: 'Стрижка',
  customer: { id: `c-${over.id}`, name: 'Клиент Тестовый', phone: null },
  startsAt: '2026-10-20T05:00:00Z',
  endsAt: '2026-10-20T06:00:00Z',
  startMinutes: 600,
  endMinutes: 660,
  status: 'DONE',
  next: [],
  priceMinor: '1000000',
  paidMinor: '1000000',
  refundedMinor: '0',
  currency: 'KZT',
  notes: null,
  source: 'DESK',
  payments: [
    {
      id: `p-${over.id}`,
      kind: 'INCOME',
      method: 'KASPI',
      amountMinor: '1000000',
      at: '2026-10-20T06:00:00Z',
    },
  ],
  ...over,
});
const day = (
  date: string,
  appointments: BeautyDay['appointments'],
  columns = [col('m1', 'Айгерим'), col('m2', 'Динара')],
): BeautyDay => ({
  location: { id: 'l', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
  date,
  columns,
  appointments,
  services: [],
  bounds: { fromMinutes: 600, toMinutes: 1080 },
});

describe('пульт салона', () => {
  const days = [
    day('2026-10-20', [
      appt({ id: 'a1', employeeId: 'm1' }),
      appt({
        id: 'a2',
        employeeId: 'm1',
        serviceId: 's-color',
        serviceName: 'Окрашивание',
        priceMinor: '3000000',
        paidMinor: '0',
        payments: [],
        startMinutes: 660,
        endMinutes: 840,
      }),
      appt({
        id: 'a3',
        employeeId: 'm2',
        status: 'NO_SHOW',
        priceMinor: '800000',
        paidMinor: '0',
        payments: [],
        source: 'WEBSITE',
      }),
      appt({ id: 'a4', employeeId: 'm2', status: 'CANCELLED', paidMinor: '0', payments: [] }),
    ]),
    day(
      '2026-10-21',
      [
        appt({
          id: 'a5',
          employeeId: 'm1',
          customer: { id: 'c-a1', name: 'Клиент Тестовый', phone: null },
        }),
      ],
      [col('m1', 'Айгерим'), col('m2', 'Динара', '10:00', '18:00', true)],
    ),
  ];
  const p = beautyPult(days, 'KZT');

  it('выручка и средний чек только по завершённым записям, в минорных единицах строкой', () => {
    expect(p.revenueMinor).toBe('5000000');
    expect(p.visits).toBe(3);
    expect(p.averageMinor).toBe('1666666');
  });
  it('неявки с суммой, отмены и статусы', () => {
    expect(p.noShow).toEqual({ count: 1, minor: '800000' });
    expect(p.counts).toMatchObject({ DONE: 3, NO_SHOW: 1, CANCELLED: 1 });
  });
  it('неоплаченные завершённые визиты', () => {
    expect(p.unpaid).toEqual({ count: 1, minor: '3000000' });
  });
  it('загрузка мастера: занятые минуты к рабочим по графику, выходной не считается', () => {
    // м1: 20.10 60+180 мин, 21.10 60 мин из 480+480; м2: 20.10 60 мин (неявка тоже занимала окно) из 480, 21.10 выходной
    const m1 = p.masters.find((m) => m.id === 'm1')!;
    const m2 = p.masters.find((m) => m.id === 'm2')!;
    expect(m1).toMatchObject({
      name: 'Айгерим',
      visits: 3,
      revenueMinor: '5000000',
      loadPercent: 31,
    });
    expect(m2).toMatchObject({ loadPercent: 13, visits: 0, revenueMinor: '0' });
    // всего занято 300 + 60 из 960 + 480 минут
    expect(p.loadPercent).toBe(25);
  });
  it('клиенты: уникальные с завершённым визитом и повторные, онлайн-доля от записей без отмен', () => {
    // c-a1 дважды (a1, a5), c-a2 один раз; неявка и отмена в клиентов периода не входят
    expect(p.clients).toEqual({ total: 2, repeat: 1 });
    // без отмен 4 записи, онлайн одна (a3)
    expect(p.onlineShare).toBe(25);
  });
  it('услуги по выручке и оплаты по способам', () => {
    expect(p.services[0]).toEqual({ name: 'Окрашивание', count: 1, revenueMinor: '3000000' });
    expect(p.payments).toEqual([{ method: 'KASPI', count: 2, amountMinor: '2000000' }]);
  });
  it('выручка по дням на каждый день периода', () => {
    expect(p.byDay).toEqual([
      { date: '2026-10-20', revenueMinor: '4000000', visits: 2 },
      { date: '2026-10-21', revenueMinor: '1000000', visits: 1 },
    ]);
  });
  it('чужая валюта в итоги не смешивается', () => {
    const mixed = beautyPult(
      [day('2026-10-20', [appt({ id: 'x', employeeId: 'm1', currency: 'AED' })])],
      'KZT',
    );
    expect(mixed.revenueMinor).toBe('0');
    expect(mixed.otherCurrencies).toEqual(['AED']);
  });
  it('подсказки: неявки и неоплата первыми, у каждой ссылка на раздел', () => {
    const tips = beautyInsights(p);
    expect(tips.map((x) => x.id).slice(0, 2)).toEqual(['no-show', 'unpaid']);
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(tips.every((x) => x.href.startsWith('/'))).toBe(true);
  });
  it('пустой период: одна спокойная подсказка без выдуманных проблем', () => {
    expect(beautyInsights(beautyPult([day('2026-10-20', [])], 'KZT')).map((x) => x.id)).toEqual([
      'calm',
    ]);
  });
});

describe('пустые окна и «давно не были»', () => {
  // 20.10.2026 вторник: мастер с 10 до 18, записи только днём 13:00-15:00
  const tuesday = day(
    '2026-10-20',
    [appt({ id: 'w', employeeId: 'm1', startMinutes: 780, endMinutes: 900 })],
    [col('m1', 'Айгерим')],
  );
  const p = beautyPult([tuesday], 'KZT');
  it('окно с наименьшей загрузкой: день вторника, 5 ч по графику, занято 2', () => {
    expect(p.idleSlots[0]).toEqual({ weekday: 2, part: 'day', freeHours: 3, loadPercent: 40 });
  });
  it('окна меньше трёх свободных часов не считаются: утро 10-12 и вечер 17-18 мимо', () => {
    expect(p.idleSlots).toHaveLength(1);
  });
  it('подсказка «давно не были» приходит из сводки API и ведёт к клиентам', () => {
    const tips = beautyInsights(beautyPult([day('2026-10-20', [])], 'KZT'), { lapsed: 4 });
    expect(tips[0]).toMatchObject({ id: 'lapsed', vars: { n: 4 }, href: '/customers' });
  });
});

describe('прошлый период той же длины вплотную', () => {
  it('7 дней', () =>
    expect(previousRange('2026-10-19', '2026-10-25')).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
    }));
  it('один день', () =>
    expect(previousRange('2026-10-25', '2026-10-25')).toEqual({
      from: '2026-10-24',
      to: '2026-10-24',
    }));
});

describe('подсказки ресторана и гостиницы', () => {
  const food: FoodPeriodReport = {
    from: '2026-10-01',
    to: '2026-10-07',
    currency: 'KZT',
    ordersCount: 10,
    revenueMinor: '1000000',
    averageCheckMinor: '100000',
    payments: [],
    topDishes: [],
    waiters: [],
    costMinor: '420000',
    grossProfitMinor: '580000',
    foodCostPct: 42,
    shortages: [{ name: 'Сыр', unit: 'кг', qty: '0.5' }],
  };
  it('ресторан: недостачи, фудкост выше 35%, неявки броней', () => {
    expect(foodInsights(food, { NO_SHOW: 2 }).map((x) => x.id)).toEqual([
      'shortages',
      'food-cost',
      'no-show',
    ]);
  });
  it('ресторан без проблем: спокойная подсказка', () => {
    expect(
      foodInsights({ ...food, foodCostPct: 30, shortages: [] }, { NO_SHOW: 0 }).map((x) => x.id),
    ).toEqual(['calm']);
  });
  it('гостиница: отмены, незаезды, низкая загрузка, один канал', () => {
    const ids = hotelInsights({
      nights: 7,
      occupancy: { percent: 40 },
      bookings: { total: 20, cancelledPercent: 20, noShow: 1 },
      sources: [{ share: 75 }],
      unassigned: 0,
    }).map((x) => x.id);
    expect(ids).toEqual(['no-show', 'cancelled', 'low-occupancy']);
  });
});
