import { describe, expect, it } from 'vitest';
import { buildMarketingFunnel, type ChannelResult } from './funnel';

const ch = (channel: ChannelResult['channel'], leads: number, bookings: number, revenue: bigint): ChannelResult => ({
  channel,
  leads,
  bookings,
  revenueMinor: revenue,
});

describe('воронка маркетинга: расходы → обращения → брони → выручка (МКТ-В5a, Q-MKT-ATTR)', () => {
  it('канал со своим расходом и результатом: CPL, стоимость брони и ROMI по выручке', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: { WHATSAPP: 100000n },
      channels: [ch('WHATSAPP', 8, 2, 500000n)],
      reportingCurrency: 'KZT',
      revenueCurrency: 'KZT',
    });
    const wa = f.rows.find((r) => r.platform === 'WHATSAPP')!;
    expect(wa.spendMinor).toBe(100000n);
    expect(wa.leads).toBe(8);
    expect(wa.bookings).toBe(2);
    expect(wa.revenueMinor).toBe(500000n);
    // 100 000 / 8 = 12 500; 100 000 / 2 = 50 000; (500 000 − 100 000) / 100 000 = 400 %
    expect(wa.cplMinor).toBe(12500n);
    expect(wa.costPerBookingMinor).toBe(50000n);
    expect(wa.romiPct).toBe(400);
  });

  it('реклама без кабинетов показывает только расход: результаты не выдумываются', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: { META: 300000n, GOOGLE: 50000n },
      channels: [],
      reportingCurrency: 'KZT',
      revenueCurrency: 'KZT',
    });
    for (const p of ['META', 'GOOGLE']) {
      const row = f.rows.find((r) => r.platform === p)!;
      expect(row.hasResults).toBe(false);
      expect(row.leads).toBeNull();
      expect(row.bookings).toBeNull();
      expect(row.revenueMinor).toBeNull();
      expect(row.cplMinor).toBeNull();
      expect(row.romiPct).toBeNull();
    }
  });

  it('органический канал без расхода показывает результат, но CPL и ROMI не считаются', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: {},
      channels: [ch('PHONE', 3, 1, 120000n)],
      reportingCurrency: 'KZT',
      revenueCurrency: 'KZT',
    });
    const phone = f.rows.find((r) => r.platform === 'PHONE')!;
    expect(phone.spendMinor).toBe(0n);
    expect(phone.bookings).toBe(1);
    expect(phone.cplMinor).toBeNull();
    expect(phone.costPerBookingMinor).toBeNull();
    expect(phone.romiPct).toBeNull();
  });

  it('итог: все расходы против всех результатов каналов; деление на ноль не случается', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: { META: 300000n, SITE: 100000n, WHATSAPP: 100000n },
      channels: [ch('SITE', 10, 3, 900000n), ch('WHATSAPP', 6, 1, 300000n)],
      reportingCurrency: 'KZT',
      revenueCurrency: 'KZT',
    });
    expect(f.total.spendMinor).toBe(500000n);
    expect(f.total.leads).toBe(16);
    expect(f.total.bookings).toBe(4);
    expect(f.total.revenueMinor).toBe(1200000n);
    // 500 000 / 16 = 31 250; 500 000 / 4 = 125 000; (1 200 000 − 500 000) / 500 000 = 140 %
    expect(f.total.cplMinor).toBe(31250n);
    expect(f.total.costPerBookingMinor).toBe(125000n);
    expect(f.total.romiPct).toBe(140);

    const empty = buildMarketingFunnel({ spendByPlatform: {}, channels: [], reportingCurrency: 'KZT', revenueCurrency: null });
    expect(empty.rows).toEqual([]);
    expect(empty.total.cplMinor).toBeNull();
    expect(empty.total.romiPct).toBeNull();
  });

  it('разные валюты выручки и отчётности: ROMI не считается, выручка не смешивается с расходом', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: { SITE: 100000n },
      channels: [ch('SITE', 4, 2, 500000n)],
      reportingCurrency: 'USD',
      revenueCurrency: 'KZT',
    });
    expect(f.romiAvailable).toBe(false);
    expect(f.rows.find((r) => r.platform === 'SITE')!.romiPct).toBeNull();
    expect(f.total.romiPct).toBeNull();
    // CPL от количества, валюта расхода одна: считается
    expect(f.total.cplMinor).toBe(25000n);
  });

  it('округление к ближайшему, отрицательный ROMI честный', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: { INSTAGRAM: 100000n },
      channels: [ch('INSTAGRAM', 3, 3, 40000n)],
      reportingCurrency: 'KZT',
      revenueCurrency: 'KZT',
    });
    const ig = f.rows.find((r) => r.platform === 'INSTAGRAM')!;
    // 100 000 / 3 = 33 333,33 → 33 333; (40 000 − 100 000) / 100 000 = −60 %
    expect(ig.cplMinor).toBe(33333n);
    expect(ig.romiPct).toBe(-60);
  });

  it('порядок строк: сначала каналы с результатом, затем реклама; по расходу внутри', () => {
    const f = buildMarketingFunnel({
      spendByPlatform: { META: 300000n, SITE: 50000n, TIKTOK: 400000n, WHATSAPP: 90000n },
      channels: [ch('SITE', 1, 1, 1n), ch('WHATSAPP', 1, 0, 0n)],
      reportingCurrency: 'KZT',
      revenueCurrency: 'KZT',
    });
    expect(f.rows.map((r) => r.platform)).toEqual(['WHATSAPP', 'SITE', 'TIKTOK', 'META']);
  });
});
