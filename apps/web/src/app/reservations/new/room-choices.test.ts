import { describe, expect, it } from 'vitest';
import { roomChoices } from './room-choices';

const categories = [
  { code: 'SGL', name: 'Одноместная', capacityAdults: 1, availableUnitCodes: ['41', '1', '45'] },
  { code: 'DBL', name: 'Двухместная', capacityAdults: 2, availableUnitCodes: ['12', '4'] },
  { code: 'LUX', name: 'Люкс', capacityAdults: 4, availableUnitCodes: [] },
];

describe('roomChoices: свободные номера справа в окне брони (решение 23.10.2026)', () => {
  it('номера по порядку чисел, свободно N, неубранный отмечен', () => {
    const out = roomChoices(categories, { guests: 1, housekeeping: { '12': 'DIRTY', '41': 'CLEAN' } });
    expect(out[0]).toMatchObject({ code: 'SGL', free: 3, fits: true });
    expect(out[0]!.units.map((u) => u.code)).toEqual(['1', '41', '45']);
    expect(out[1]!.units).toEqual([
      { code: '4', dirty: false },
      { code: '12', dirty: true },
    ]);
  });
  it('категория меньше числа гостей не подходит и говорит почему', () => {
    const out = roomChoices(categories, { guests: 2, housekeeping: {} });
    expect(out[0]).toMatchObject({ fits: false, why: 'до 1 гостя' });
    expect(out[1]).toMatchObject({ fits: true });
  });
  it('карта фонда: все номера категории по порядку, занятые отмечены', () => {
    const out = roomChoices(
      [{ code: 'SGL', name: 'Одноместная', capacityAdults: 1, availableUnitCodes: ['41', '1'], unitCodes: ['45', '41', '1', '85'] }],
      { guests: 1, housekeeping: { '41': 'DIRTY' } },
    );
    expect(out[0]!.cells).toEqual([
      { code: '1', free: true, dirty: false },
      { code: '41', free: true, dirty: true },
      { code: '45', free: false, dirty: false },
      { code: '85', free: false, dirty: false },
    ]);
  });
  it('без списка мест карта показывает свободные', () => {
    expect(roomChoices(categories, { guests: 1, housekeeping: {} })[1]!.cells.map((c) => c.code)).toEqual(['4', '12']);
  });
  it('категория без свободных номеров остаётся видна с нулём', () => {
    const out = roomChoices(categories, { guests: 1, housekeeping: {} });
    expect(out[2]).toMatchObject({ code: 'LUX', free: 0, fits: true, units: [] });
  });
});
