import { describe, expect, it } from 'vitest';
import { compareRates, renderRatesReport, type RateRow } from './rates-compare';

const row = (date: string, plan: string, type: string, occ: number, price: bigint): RateRow => ({
  date,
  ratePlanExelyId: plan,
  accommodationTypeExelyId: type,
  occupancy: occ,
  priceMinor: price,
});

describe('compareRates', () => {
  it('is OK only when every (date, tariff, category, occupancy) matches on both sides', () => {
    const exely = [
      row('2026-09-09', '1', 'A', 1, 100n),
      row('2026-09-10', '1', 'A', 1, 100n),
      row('2026-09-09', '1', 'B', 2, 200n),
    ];
    const ok = compareRates({ exely, pms: [...exely] });
    expect(ok.ok).toBe(true);
    expect(ok.totals).toEqual({
      exely: 3,
      pms: 3,
      matched: 3,
      priceDiff: 0,
      missingInPms: 0,
      extraInPms: 0,
    });

    const bad = compareRates({
      exely,
      pms: [
        row('2026-09-09', '1', 'A', 1, 100n),
        row('2026-09-10', '1', 'A', 1, 999n),
        row('2026-09-11', '1', 'A', 1, 100n),
      ],
    });
    expect(bad.ok).toBe(false);
    expect(bad.totals).toEqual({
      exely: 3,
      pms: 3,
      matched: 1,
      priceDiff: 1,
      missingInPms: 1,
      extraInPms: 1,
    });
    expect(
      bad.byTariff.map((t) => [
        t.ratePlanExelyId,
        t.accommodationTypeExelyId,
        t.occupancy,
        t.matched,
        t.priceDiff,
        t.missingInPms,
        t.extraInPms,
      ]),
    ).toEqual([
      ['1', 'A', 1, 1, 1, 0, 1],
      ['1', 'B', 2, 0, 0, 1, 0],
    ]);
    expect(bad.samples.slice(0, 1)).toEqual([
      {
        kind: 'priceDiff',
        date: '2026-09-10',
        ratePlanExelyId: '1',
        accommodationTypeExelyId: 'A',
        occupancy: 1,
        exely: 100n,
        pms: 999n,
      },
    ]);
  });

  it('renders a markdown report with RESULT line', () => {
    const cmp = compareRates({
      exely: [row('2026-09-09', '1', 'A', 1, 100n)],
      pms: [row('2026-09-09', '1', 'A', 1, 100n)],
    });
    const md = renderRatesReport(cmp, {
      controlDate: '2026-09-09',
      period: { from: '2026-09-09', to: '2027-09-09' },
      names: { ratePlans: { '1': 'Базовый' }, accommodationTypes: { A: 'Одноместная' } },
    });
    expect(md).toContain('RESULT: OK');
    expect(md).toContain('| Базовый | Одноместная | 1 | 1 | 1 | 1 | 0 | 0 | 0 |');
  });
});
