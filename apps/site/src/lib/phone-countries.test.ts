import { describe, expect, it } from 'vitest';
import * as domain from '../../../../packages/domain/src/accounts/registration-contact';
import { PHONE_COUNTRIES, defaultPhoneCountry } from './phone-countries';

describe('страны телефона главной = домена', () => {
  it('тот же список, в том же порядке', () => {
    expect(PHONE_COUNTRIES).toEqual(domain.PHONE_COUNTRIES);
  });
  it('та же страна по браузеру', () => {
    const cases: Array<[string[], string | undefined]> = [
      [['en-US'], 'Asia/Almaty'],
      [['uz-UZ'], 'UTC'],
      [['ru-RU'], undefined],
      [['ru'], 'UTC'],
      [['fr-FR'], 'Europe/Paris'],
      [[], 'Asia/Dubai'],
    ];
    for (const [langs, tz] of cases) {
      expect(defaultPhoneCountry(langs, tz), `${langs.join(',')} ${tz}`).toBe(domain.defaultPhoneCountry(langs, tz));
    }
  });
});
