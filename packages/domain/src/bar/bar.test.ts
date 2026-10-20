import { describe, expect, it } from 'vitest';
import { BarRuleError, allocateFifo, salePriceFromMarkup, unitsFromPackages } from './bar';

describe('бар: цена по наценке (DATA_MODEL § 27, Q-BAR-2...Q-BAR-3)', () => {
  it('считает без float и округляет вверх до 10 тенге', () => {
    expect(salePriceFromMarkup(12_345n, 3_500n)).toBe(17_000n);
    expect(salePriceFromMarkup(10_000n, 0n)).toBe(10_000n);
    expect(salePriceFromMarkup(10_001n, 0n)).toBe(11_000n);
  });

  it('отклоняет неположительную себестоимость и отрицательную наценку', () => {
    expect(() => salePriceFromMarkup(0n, 3_500n)).toThrow(BarRuleError);
    expect(() => salePriceFromMarkup(10_000n, -1n)).toThrow(/\u043d\u0430\u0446\u0435\u043d\u043a/i);
  });
});

describe('бар: FIFO и остаток (Q-BAR-1, Q-BAR-8)', () => {
  it('списывает сначала самую старую партию и фиксирует себестоимость', () => {
    expect(
      allocateFifo(
        [
          { lotId: 'new', receivedAt: '2026-10-02T10:00:00Z', availableUnits: 5n, unitCostMinor: 150n },
          { lotId: 'old', receivedAt: '2026-10-01T10:00:00Z', availableUnits: 3n, unitCostMinor: 100n },
        ],
        4n,
      ),
    ).toEqual({
      allocations: [
        { lotId: 'old', units: 3n, unitCostMinor: 100n, costMinor: 300n },
        { lotId: 'new', units: 1n, unitCostMinor: 150n, costMinor: 150n },
      ],
      totalCostMinor: 450n,
    });
  });

  it('не разрешает уйти в минус', () => {
    expect(() =>
      allocateFifo(
        [{ lotId: 'one', receivedAt: '2026-10-01T10:00:00Z', availableUnits: 2n, unitCostMinor: 100n }],
        3n,
      ),
    ).toThrow(/\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d/i);
  });
});

describe('бар: упаковки (Q-BAR-7)', () => {
  it('переводит целые упаковки в штуки', () => {
    expect(unitsFromPackages(3n, 12n)).toBe(36n);
  });

  it('не принимает ноль', () => {
    expect(() => unitsFromPackages(0n, 12n)).toThrow();
    expect(() => unitsFromPackages(2n, 0n)).toThrow();
  });
});

describe('цена по наценке в валюте филиала (ADR-187)', () => {
  it('тенге: вверх до 10 ₸, как раньше (Q-BAR-2)', () => {
    expect(salePriceFromMarkup(55_000n, 8_800n, 'KZT')).toBe(104_000n); // 550 ₸ + 88 % = 1034 ₸ → 1040 ₸
    expect(salePriceFromMarkup(55_000n, 8_800n)).toBe(104_000n);
  });
  it('доллар, дирхам, риал: вверх до целой единицы', () => {
    expect(salePriceFromMarkup(300n, 4_000n, 'USD')).toBe(500n); // 3,00 + 40 % = 4,20 → 5,00
    expect(salePriceFromMarkup(250n, 10_000n, 'AED')).toBe(500n); // 2,50 + 100 % = 5,00 ровно
    expect(salePriceFromMarkup(301n, 0n, 'QAR')).toBe(400n); // 3,01 → 4,00
  });
});
