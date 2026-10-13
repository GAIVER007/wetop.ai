import { describe, expect, it } from 'vitest';
import { registrationBusiness } from './registration-contract';

describe('registration contract', () => {
  it('only hotelName-only legacy input can omit vertical', () => {
    expect(registrationBusiness({ hotelName: 'Отель' })).toMatchObject({ vertical: 'HOSPITALITY' });
    expect(() => registrationBusiness({ businessName: 'Бизнес' })).toThrow();
    expect(() => registrationBusiness({ hotelName: 'Отель', vertical: null })).toThrow();
    expect(() =>
      registrationBusiness({ businessName: 'Один', hotelName: 'Другой', vertical: 'BEAUTY' }),
    ).toThrow();
  });
});
