import { describe, expect, it } from 'vitest';
import { assertRegistrationVertical, registrationBusiness } from './registration-contract';

describe('server-only pilot release gate', () => {
  it.each(['BEAUTY', 'FOOD_SERVICE'] as const)('uses exact normalized email for %s', (vertical) => {
    const key = `REGISTRATION_${vertical}_PILOT_EMAILS`;
    expect(() =>
      assertRegistrationVertical(vertical, ' Pilot@example.invalid ', {
        [key]: ' OTHER@example.invalid, pilot@EXAMPLE.invalid ',
      }),
    ).not.toThrow();
    for (const list of ['', ' ', 'other@example.invalid', '@example.invalid', '*'])
      expect(() =>
        assertRegistrationVertical(vertical, 'pilot@example.invalid', { [key]: list }),
      ).toThrow('Направление пока доступно только участникам пилота');
    const other = vertical === 'BEAUTY' ? 'FOOD_SERVICE' : 'BEAUTY';
    expect(() =>
      assertRegistrationVertical(vertical, 'pilot@example.invalid', {
        [`REGISTRATION_${other}_PILOT_EMAILS`]: 'pilot@example.invalid',
      }),
    ).toThrow();
  });
  it('Hospitality does not require an allowlist', () => {
    expect(() =>
      assertRegistrationVertical('HOSPITALITY', 'test@example.invalid', {}),
    ).not.toThrow();
  });
  it('only hotelName-only legacy input can omit vertical', () => {
    expect(registrationBusiness({ hotelName: 'Отель' })).toMatchObject({ vertical: 'HOSPITALITY' });
    expect(() => registrationBusiness({ businessName: 'Бизнес' })).toThrow();
    expect(() => registrationBusiness({ hotelName: 'Отель', vertical: null })).toThrow();
    expect(() =>
      registrationBusiness({ businessName: 'Один', hotelName: 'Другой', vertical: 'BEAUTY' }),
    ).toThrow();
  });
});
