import { describe, expect, it } from 'vitest';
import { categoryInput, roomInput } from './inventory-input';
describe('inventory input', () => {
  it('validates room categories and bed capacity', () => {
    expect(categoryInput({ name: '  Комфорт ', kind: 'PRIVATE_ROOM', capacityAdults: 2 })).toEqual({
      name: 'Комфорт',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 2,
    });
    expect(() => categoryInput({ name: 'Койка', kind: 'DORM_BED', capacityAdults: 2 })).toThrow();
    for (const n of [0, -1, 1.5, '2', Infinity])
      expect(() =>
        categoryInput({ name: 'Номер', kind: 'PRIVATE_ROOM', capacityAdults: n }),
      ).toThrow();
  });
  it('requires explicit unique bed labels and location', () => {
    const value = {
      categoryCode: 'dorm',
      building: 'Основной',
      floor: '2',
      roomNumber: '201',
      codes: ['201-A', '201-B'],
    };
    expect(roomInput(value).codes).toEqual(['201-A', '201-B']);
    expect(() => roomInput({ ...value, codes: ['A', ' A '] })).toThrow();
    expect(() => roomInput({ ...value, codes: [] })).toThrow();
    expect(() => roomInput({ ...value, roomNumber: '' })).toThrow();
  });
});
