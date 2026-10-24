import { describe, expect, it } from 'vitest';
import { foodReservationOrigin } from './food-reservation-origin';

describe('кто принял бронь стола', () => {
  it('без брони, голос, сотрудник, неизвестно кто', () => {
    expect(foodReservationOrigin({ source: 'WALK_IN' })).toBe('Без брони');
    expect(foodReservationOrigin({ source: 'VOICE', employee: null })).toBe('Голосовой агент');
    expect(foodReservationOrigin({ source: 'DESK', employee: { name: 'Алия' } })).toBe('Принял: Алия');
    expect(foodReservationOrigin({ source: 'DESK', employee: null })).toBe('Сотрудник');
  });
});
