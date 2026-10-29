import { describe, expect, it } from 'vitest';
import * as domain from '../../../../packages/domain/src/accounts/registration-contact';
import * as domainPhone from '../../../../packages/domain/src/accounts/phone-country';
import { PHONE_COUNTRIES, countryFromPhone, defaultPhoneCountry, suggestedLocale } from './phone-countries';

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
      [[], 'Asia/Qatar'],
    ];
    for (const [langs, tz] of cases) {
      expect(defaultPhoneCountry(langs, tz), `${langs.join(',')} ${tz}`).toBe(domain.defaultPhoneCountry(langs, tz));
    }
  });
});

describe('страна по номеру и язык на главной = домена', () => {
  it('те же ответы на номера разных стран и местную запись', () => {
    for (const n of ['+7', '+7 7', '+7 747 1', '+7 916', '8 701 555 44 33', '8 916 555 44 33', '701', '+971 50', '+974', '+1 212', '+1876 1', '+91 98', '+33 6', '+0', '', '+998 90'])
      expect(countryFromPhone(n), n).toEqual(domainPhone.countryFromPhone(n));
  });
  it('тот же язык по стране', () => {
    for (const c of ['KZ', 'RU', 'UZ', 'QA', 'AE', 'US', 'FR'])
      expect([suggestedLocale(c), suggestedLocale(c, 'choices')], c).toEqual([domainPhone.suggestedLocale(c), domainPhone.suggestedLocale(c, 'choices')]);
  });
});
