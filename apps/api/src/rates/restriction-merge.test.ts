import { describe, expect, it } from 'vitest';
import { isEmptyRestriction, mergeRestrictions } from './restriction-merge';

/**
 * Снятие ограничения не должно оставлять пустую строку. 13.09.2026: цена 250 и мин. срок 3 для показа
 * сертификации Channex, затем возврат `minStay: null` — в базе осталась строка со всеми пустыми полями,
 * и сверка с Exely упала «ограничений Exely 0 / PMS 1». Раньше так же вручную снимали 324 пустые строки
 * после прогона сертификации 10.09.
 */
const EMPTY = {
  minStay: null,
  maxStay: null,
  stopSell: false,
  closedToArrival: false,
  closedToDeparture: false,
};

describe('mergeRestrictions', () => {
  it('снятие единственного ограничения не оставляет строку', () => {
    const rows = mergeRestrictions(
      ['2026-11-22'],
      new Map([['2026-11-22', { ...EMPTY, minStay: 3 }]]),
      { minStay: null },
    );
    expect(rows).toEqual([]);
  });

  it('новое ограничение на дату без строки создаёт строку', () => {
    const rows = mergeRestrictions(['2026-11-22'], new Map(), { minStay: 3 });
    expect(rows).toEqual([{ date: '2026-11-22', ...EMPTY, minStay: 3 }]);
  });

  it('снятие одного ограничения сохраняет остальные на той же дате', () => {
    const rows = mergeRestrictions(
      ['2026-11-22'],
      new Map([['2026-11-22', { ...EMPTY, minStay: 3, stopSell: true }]]),
      { minStay: null },
    );
    expect(rows).toEqual([{ date: '2026-11-22', ...EMPTY, stopSell: true }]);
  });

  it('на диапазоне строки остаются только у дат, где что-то закрыто', () => {
    const rows = mergeRestrictions(
      ['2026-11-21', '2026-11-22', '2026-11-23'],
      new Map([['2026-11-22', { ...EMPTY, closedToArrival: true }]]),
      { stopSell: false },
    );
    expect(rows.map((r) => r.date)).toEqual(['2026-11-22']);
  });

  it('пустое ограничение распознаётся по всем пяти полям', () => {
    expect(isEmptyRestriction(EMPTY)).toBe(true);
    expect(isEmptyRestriction({ ...EMPTY, maxStay: 4 })).toBe(false);
    expect(isEmptyRestriction({ ...EMPTY, closedToDeparture: true })).toBe(false);
  });
});
