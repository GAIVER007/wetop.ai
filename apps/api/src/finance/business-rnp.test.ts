import { describe, expect, it } from 'vitest';
import { buildBusinessRnp, withLoneRevenue, type BusinessRnpSource } from './business-rnp';

/**
 * РНП бизнеса клиента (владелец 30.10.2026: «рнп должна быть у клиентов тоже и заполняться туда каждый день все
 * данные»): каждый день месяца строкой и итоги. Посетители и заявки с сайта филиала, новые брони, пришли, не пришли,
 * выручка, поступления, расходы, прибыль, средний чек целыми. Деньги минорными bigint строкой.
 */
const src = (): BusinessRnpSource => ({
  month: '2026-10',
  today: '2026-10-03',
  visitors: [
    { day: '2026-10-01', key: 'v1' },
    { day: '2026-10-01', key: 'v1' },
    { day: '2026-10-01', key: 'v2' },
    { day: '2026-10-02', key: 'v1' },
    { day: '2026-09-30', key: 'v9' },
  ],
  leads: ['2026-10-01', '2026-10-02', '2026-10-02'],
  bookings: ['2026-10-01', '2026-10-01', '2026-10-03'],
  visits: [
    { day: '2026-10-01', amountMinor: 10000n },
    { day: '2026-10-01', amountMinor: 5050n },
    { day: '2026-10-02', amountMinor: 7000n },
  ],
  noShows: ['2026-10-02'],
  receipts: [
    { day: '2026-10-01', amountMinor: 15050n },
    { day: '2026-10-03', amountMinor: 7000n },
  ],
  expenses: [{ day: '2026-10-02', amountMinor: 2000n }],
});

describe('РНП бизнеса', () => {
  it('каждый день месяца до сегодня строкой', () => {
    const v = buildBusinessRnp(src());
    expect(v.days.map((d) => d.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(v.days[0]).toEqual({
      day: '2026-10-01',
      visitors: 2,
      leads: 1,
      bookings: 2,
      visits: 2,
      noShows: 0,
      cancelled: 0,
      pending: 0,
      revenueMinor: '15050',
      receiptsMinor: '15050',
      expensesMinor: '0',
      profitMinor: '15050',
      // 15050 / 2 = 75,25: 75
      averageMinor: '7500',
    });
    expect(v.days[1]).toMatchObject({ visitors: 1, leads: 2, bookings: 0, visits: 1, noShows: 1, expensesMinor: '2000', profitMinor: '5000', averageMinor: '7000' });
    expect(v.days[2]).toMatchObject({ visits: 0, revenueMinor: '0', receiptsMinor: '7000', averageMinor: null });
  });

  it('итоги периода: посетители без повторов за месяц, конверсии целыми процентами', () => {
    const v = buildBusinessRnp(src());
    expect(v.total).toEqual({
      visitors: 2,
      leads: 3,
      bookings: 3,
      visits: 3,
      noShows: 1,
      revenueMinor: '22050',
      receiptsMinor: '22050',
      expensesMinor: '2000',
      profitMinor: '20050',
      // 22050 / 3 = 73,5: 74
      averageMinor: '7400',
      // заявки / посетители 3 / 2 = 150%; пришли / (пришли + не пришли) 3 / 4 = 75%
      visitorToLead: 150,
      cameRate: 75,
      cancelled: 0,
      pending: 0,
    });
  });

  it('прошлый месяц целиком, пустой месяц без деления на ноль', () => {
    const v = buildBusinessRnp({ ...src(), month: '2026-09', today: '2026-10-03' });
    expect(v.days).toHaveLength(30);
    expect(v.days[29]).toMatchObject({ day: '2026-09-30', visitors: 1 });
    const empty = buildBusinessRnp({ month: '2026-02', today: '2026-10-03', visitors: [], leads: [], bookings: [], visits: [], noShows: [], receipts: [], expenses: [] });
    expect(empty.days).toHaveLength(28);
    expect(empty.total).toMatchObject({ averageMinor: null, visitorToLead: null, cameRate: null });
  });

  it('записи сходятся (владелец 02.11.2026: «записей 14, пришли 10, не пришли 0, а где 4?»): записи дня = пришли + не пришли + отменены + не отмечены', () => {
    const v = buildBusinessRnp({
      ...src(),
      // 14 записей на 01.10: 10 пришли, 2 отменены, 2 ещё не отмечены (пришёл / не пришёл не нажали)
      bookings: Array.from({ length: 14 }, () => '2026-10-01'),
      visits: Array.from({ length: 10 }, () => ({ day: '2026-10-01', amountMinor: 46800n })),
      noShows: [],
      cancelled: ['2026-10-01', '2026-10-01'],
      pending: ['2026-10-01', '2026-10-01'],
    });
    const d = v.days[0]!;
    expect(d).toMatchObject({ bookings: 14, visits: 10, noShows: 0, cancelled: 2, pending: 2 });
    expect(d.visits + d.noShows + d.cancelled + d.pending).toBe(d.bookings);
    // пришли из записей без отменённых: 10 из 12, а не «100%»
    expect(v.total).toMatchObject({ bookings: 14, cancelled: 2, pending: 2, cameRate: 83 });
  });

  it('гостиница: выручка дня без заезда (проживание) в выручке и прибыли дня и итога, средний чек по заездам', () => {
    const v = withLoneRevenue(buildBusinessRnp(src()), [{ day: '2026-10-03', amountMinor: 9000n }, { day: '2026-11-01', amountMinor: 1n }]);
    expect(v.days[2]).toMatchObject({ revenueMinor: '9000', profitMinor: '9000', visits: 0 });
    expect(v.total).toMatchObject({ revenueMinor: '31050', profitMinor: '29050', averageMinor: '7400' });
  });
});
