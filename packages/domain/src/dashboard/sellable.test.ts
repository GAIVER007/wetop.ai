import { describe, expect, it } from 'vitest';
import { buildDashboard, type DashboardInput } from './metrics';
import { buildUnitStats } from './units';
import { groupDaily } from './granularity';

/** Закрытые для продажи ночи вычитаются из знаменателя загрузки (ADR-155, Q-286, `docs/metrics.md` §1) */
const input = (): DashboardInput => ({
  from: '2026-10-05',
  to: '2026-10-06',
  categories: [{ code: 'ROOM', name: 'Двухместная', units: 4, kind: 'ROOM' }],
  days: [
    {
      date: '2026-10-05',
      occupied: 2,
      free: 2,
      blocked: 0,
      byCategory: { ROOM: { units: 4, occupied: 2, free: 2, blocked: 0 } },
    },
    {
      date: '2026-10-06',
      occupied: 2,
      free: 0,
      blocked: 2,
      byCategory: { ROOM: { units: 4, occupied: 2, free: 0, blocked: 2 } },
    },
  ],
  unassignedByCategory: {},
  stays: [],
  charges: [
    {
      kind: 'ACCOMMODATION',
      amountMinor: 600_000n,
      categoryCode: 'ROOM',
      serviceDate: '2026-10-05',
    },
  ],
  payments: [],
  refundsMinor: 0n,
});

describe('загрузка по доступным к продаже ночам (ADR-155)', () => {
  it('знаменатель: фонд минус блокировки; закрытые ночи показаны отдельно', () => {
    const d = buildDashboard(input());
    expect(d.occupancy).toMatchObject({
      unitNights: 8,
      blockedNights: 2,
      sellableNights: 6,
      occupiedNights: 4,
      percent: 66.7,
    });
  });

  it('категория и день считаются так же', () => {
    const d = buildDashboard(input());
    expect(d.categories[0]).toMatchObject({ blockedNights: 2, percent: 66.7 });
    expect(d.daily.map((p) => p.percent)).toEqual([50, 100]);
  });

  it('RevPAR делится на доступные ночи, а не на весь фонд; ADR прежний', () => {
    const d = buildDashboard(input());
    expect(d.revparMinor).toBe('100000'); // 600000 / 6
    expect(d.adrMinor).toBe('150000'); // 600000 / 4
  });

  it('всё закрыто: нечего продавать, процент 0, RevPAR пусто', () => {
    const i = input();
    i.days = i.days.map((d) => ({
      ...d,
      occupied: 0,
      free: 0,
      blocked: 4,
      byCategory: { ROOM: { units: 4, occupied: 0, free: 0, blocked: 4 } },
    }));
    i.charges = [];
    const d = buildDashboard(i);
    expect(d.occupancy).toMatchObject({ sellableNights: 0, percent: 0 });
    expect(d.revparMinor).toBeNull();
  });

  it('«По номерам»: ночи закрытого места вычитаются из его процента', () => {
    const s = buildUnitStats(
      {
        from: '2026-10-05',
        to: '2026-10-08',
        nights: 4,
        unassignedStays: 0,
        units: [
          {
            id: 'u1',
            code: '101',
            kind: 'ROOM',
            categoryName: 'A',
            occupiedNights: 3,
            blockedNights: 1,
            arrivals: 1,
          },
          {
            id: 'u2',
            code: '102',
            kind: 'ROOM',
            categoryName: 'A',
            occupiedNights: 1,
            blockedNights: 0,
            arrivals: 1,
          },
        ] as never,
      },
      'all',
    );
    expect(s.rows[0]).toMatchObject({ code: '101', percent: 100 });
    expect(s.rows[1]).toMatchObject({ code: '102', percent: 25 });
    expect(s.totals).toMatchObject({ unitNights: 8, blockedNights: 1, percent: 57.1 });
  });

  it('корзины недель и месяцев: закрытое не в знаменателе', () => {
    const g = groupDaily(
      [
        {
          date: '2026-10-05',
          occupied: 2,
          free: 0,
          blocked: 2,
          percent: 0,
          arrivals: 0,
          departures: 0,
          revenueMinor: '0',
        },
        {
          date: '2026-10-06',
          occupied: 1,
          free: 3,
          blocked: 0,
          percent: 0,
          arrivals: 0,
          departures: 0,
          revenueMinor: '0',
        },
      ],
      'week',
    );
    expect(g[0]?.percent).toBe(50);
  });
});
