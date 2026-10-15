import { describe, expect, it } from 'vitest';
import { buildDashboard, type DashboardInput, type DashboardStay } from './metrics';

/** Выручка за ночи для ADR и RevPAR (ADR-155, Q-290, `docs/metrics.md` §2): цена места поровну по ночам, остаток на последнюю ночь */
const stay = (over: Partial<DashboardStay>): DashboardStay => ({
  arrivalDate: '2026-10-05',
  departureDate: '2026-10-08',
  status: 'CONFIRMED',
  reservationId: 'R-1',
  reservationStatus: 'CONFIRMED',
  adults: 1,
  children: 0,
  priceMinor: 3_000_001n,
  source: 'WALK_IN',
  channel: null,
  categoryCode: 'ROOM',
  ...over,
});

const input = (stays: DashboardStay[], from = '2026-10-05', to = '2026-10-10'): DashboardInput => {
  const dates: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000)
    dates.push(new Date(t).toISOString().slice(0, 10));
  return {
    from,
    to,
    categories: [{ code: 'ROOM', name: 'Номер', units: 2, kind: 'ROOM' }],
    days: dates.map((date) => ({
      date,
      occupied: 1,
      free: 1,
      blocked: 0,
      byCategory: { ROOM: { units: 2, occupied: 1, free: 1, blocked: 0 } },
    })),
    unassignedByCategory: {},
    stays,
    charges: [
      { kind: 'ACCOMMODATION', amountMinor: 999n, categoryCode: 'ROOM', serviceDate: from },
    ],
    payments: [],
    refundsMinor: 0n,
  };
};

describe('выручка за ночи (ADR-155, Q-290)', () => {
  it('цена делится по ночам, копейки остатка на последнюю ночь, сумма сходится до тиына', () => {
    const d = buildDashboard(input([stay({})]));
    expect(d.daily.map((p) => p.nightRevenueMinor)).toEqual([
      '1000000',
      '1000000',
      '1000001',
      '0',
      '0',
      '0',
    ]);
    expect(d.revenue.nightsMinor).toBe('3000001');
  });

  it('в отчёт входят только ночи внутри периода; проживание на границе делится между периодами без потерь', () => {
    const left = buildDashboard(input([stay({})], '2026-10-01', '2026-10-06'));
    const right = buildDashboard(input([stay({})], '2026-10-07', '2026-10-12'));
    expect(left.revenue.nightsMinor).toBe('2000000'); // ночи 5 и 6
    expect(right.revenue.nightsMinor).toBe('1000001'); // ночь 7 с остатком
    expect(BigInt(left.revenue.nightsMinor) + BigInt(right.revenue.nightsMinor)).toBe(3_000_001n);
  });

  it('проживание, накрывающее весь период, даёт выручку каждому дню', () => {
    const d = buildDashboard(
      input([
        stay({ arrivalDate: '2026-10-01', departureDate: '2026-10-21', priceMinor: 20_000_000n }),
      ]),
    );
    expect(d.daily.every((p) => p.nightRevenueMinor === '1000000')).toBe(true);
    expect(d.revenue.nightsMinor).toBe('6000000');
  });

  it('отмены и незаезды выручки за ночи не дают', () => {
    const d = buildDashboard(
      input([
        stay({ status: 'CANCELLED', reservationStatus: 'CANCELLED' }),
        stay({ reservationId: 'R-2', reservationStatus: 'NO_SHOW', status: 'NO_SHOW' }),
      ]),
    );
    expect(d.revenue.nightsMinor).toBe('0');
  });

  it('ADR = выручка за ночи / занятые ночи, RevPAR = / доступные ночи; начисление на заезде их не определяет', () => {
    const d = buildDashboard(
      input([
        stay({ priceMinor: 6_000_000n, arrivalDate: '2026-10-05', departureDate: '2026-10-11' }),
      ]),
    );
    expect(d.revenue.nightsMinor).toBe('6000000');
    // занято 6 ночей, доступно 12 (2 места × 6 дней)
    expect(d.adrMinor).toBe('1000000');
    expect(d.revparMinor).toBe('500000');
    expect(d.revenue.accommodationMinor).toBe('999');
  });

  it('категория: свой ADR от своих ночей', () => {
    const d = buildDashboard(input([stay({ priceMinor: 3_000_000n })]));
    expect(d.categories[0]?.adrMinor).toBe('500000'); // 3 000 000 за 3 ночи, но занято 6 ночей клеток
  });

  it('фильтр категории оставляет выручку только её проживаний', () => {
    const i = input([
      stay({}),
      stay({ reservationId: 'R-9', categoryCode: 'LUX', priceMinor: 9_000_000n }),
    ]);
    i.categories.push({ code: 'LUX', name: 'Люкс', units: 1, kind: 'ROOM' });
    i.days = i.days.map((d) => ({
      ...d,
      byCategory: { ...d.byCategory, LUX: { units: 1, occupied: 0, free: 1, blocked: 0 } },
    }));
    expect(buildDashboard(i, 'all', { category: 'ROOM' }).revenue.nightsMinor).toBe('3000001');
    expect(buildDashboard(i).revenue.nightsMinor).toBe('12000001');
  });
});
