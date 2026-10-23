import { describe, expect, it } from 'vitest';
import { reservationProblem, WALK_IN_GUEST, walkInFirstName } from './food-reservation-check';

/** «Посадить без брони» (аудит ресторана 22.10.2026): без английского «Please select an item in the list.» */
describe('проверка формы брони по-русски', () => {
  const ok = { walkIn: false, mode: 'new' as const, customerId: '', firstName: 'Анна', tableId: '', period: 'p' };
  it('гость без брони: имя необязательно, по умолчанию «Гость»', () => {
    expect(WALK_IN_GUEST).toBe('Гость');
    expect(walkInFirstName('  ')).toBe('Гость');
    expect(walkInFirstName(' Анна ')).toBe('Анна');
    expect(reservationProblem({ ...ok, walkIn: true, firstName: '', tableId: 't' })).toBeNull();
  });
  it('гость без брони без стола: «Выберите стол»', () => {
    expect(reservationProblem({ ...ok, walkIn: true, tableId: '' })).toBe('Выберите стол');
  });
  it('существующий клиент не выбран: «Выберите клиента»', () => {
    expect(reservationProblem({ ...ok, mode: 'existing', customerId: '' })).toBe('Выберите клиента');
    expect(reservationProblem({ ...ok, mode: 'existing', customerId: 'c' })).toBeNull();
  });
  it('обычная бронь нового гостя без имени: «Укажите имя гостя»', () => {
    expect(reservationProblem({ ...ok, firstName: ' ' })).toBe('Укажите имя гостя');
  });
  it('без периода: «Выберите период обслуживания»', () => {
    expect(reservationProblem({ ...ok, period: '' })).toBe('Выберите период обслуживания');
  });
});
