import { describe, expect, it } from 'vitest';
import { categoryInput, categoryPrice, categoryRemoval, roomInput } from './inventory-input';
describe('цена и удаление категории (план categories-price-2026-10-06)', () => {
  it('цена — целые тенге или с копейками; пусто — не менять; ноль и мусор — отказ', () => {
    expect(categoryPrice({ price: ' 7000 ' })).toBe('7000');
    expect(categoryPrice({ price: '7 000' })).toBe('7000');
    expect(categoryPrice({ price: '456,5' })).toBe('456.5');
    expect(categoryPrice({ price: 7000 })).toBe('7000');
    expect(categoryPrice({})).toBeUndefined();
    expect(categoryPrice({ price: '' })).toBeUndefined();
    for (const bad of ['0', '-100', 'abc', '1.234', '100000000'])
      expect(() => categoryPrice({ price: bad })).toThrow();
  });
  it('пустая — удаляется, с историей — в архив, с бронями впереди — нельзя', () => {
    const empty = { units: 0, reservations: 0, upcomingReservations: 0, channexMapped: false };
    expect(categoryRemoval(empty)).toBe('delete');
    expect(categoryRemoval({ ...empty, units: 4 })).toBe('archive');
    expect(categoryRemoval({ ...empty, reservations: 3 })).toBe('archive');
    expect(categoryRemoval({ ...empty, channexMapped: true })).toBe('archive');
    expect(categoryRemoval({ ...empty, reservations: 3, upcomingReservations: 1 })).toBe('blocked');
  });
});
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
