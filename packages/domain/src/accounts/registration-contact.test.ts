import { describe, expect, it } from 'vitest';
import {
  PHONE_COUNTRIES,
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_VERSION,
  defaultPhoneCountry,
  registrationPhone,
} from './registration-contact';

describe('registrationPhone', () => {
  it('Казахстан: код +7 и десять цифр номера', () => {
    expect(registrationPhone('KZ', '701 555 44 33')).toBe('+77015554433');
  });
  it('лишняя 8 или 7 в начале казахстанского номера снимается', () => {
    expect(registrationPhone('KZ', '8 701 555 44 33')).toBe('+77015554433');
    expect(registrationPhone('KZ', '+7 (701) 555-44-33')).toBe('+77015554433');
  });
  it('номер, уже начатый кодом выбранной страны, код не удваивает', () => {
    expect(registrationPhone('UZ', '+998 90 123 45 67')).toBe('+998901234567');
    expect(registrationPhone('UZ', '90 123 45 67')).toBe('+998901234567');
  });
  it('короткий, длинный и пустой номер не принимаются', () => {
    expect(registrationPhone('KZ', '701 55')).toBeNull();
    expect(registrationPhone('KZ', '')).toBeNull();
    expect(registrationPhone('AE', '5'.repeat(16))).toBeNull();
  });
  it('незнакомая страна — отказ, а не угаданный код', () => {
    expect(registrationPhone('XX', '7015554433')).toBeNull();
  });
});

describe('defaultPhoneCountry', () => {
  it('пояс Казахстана — Казахстан, даже при английском языке браузера', () => {
    expect(defaultPhoneCountry(['en-US'], 'Asia/Almaty')).toBe('KZ');
    expect(defaultPhoneCountry(['ru'], 'Asia/Aqtobe')).toBe('KZ');
  });
  it('незнакомый пояс — страна из языка браузера, если она в списке', () => {
    expect(defaultPhoneCountry(['uz-UZ', 'ru'], 'UTC')).toBe('UZ');
    expect(defaultPhoneCountry(['ru-RU'], undefined)).toBe('RU');
  });
  it('ни пояс, ни язык не подсказали — Казахстан', () => {
    expect(defaultPhoneCountry(['ru'], 'UTC')).toBe('KZ');
    expect(defaultPhoneCountry([], undefined)).toBe('KZ');
    expect(defaultPhoneCountry(['fr-FR'], 'Europe/Paris')).toBe('KZ');
  });
});

describe('PHONE_COUNTRIES', () => {
  it('Казахстан первым, коды уникальны по стране', () => {
    expect(PHONE_COUNTRIES[0]?.code).toBe('KZ');
    const codes = PHONE_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of PHONE_COUNTRIES) expect(c.dial).toMatch(/^\+\d{1,4}$/);
  });
});

describe('политика конфиденциальности', () => {
  it('адрес на главной и версия-дата', () => {
    expect(PRIVACY_POLICY_URL).toBe('https://wetop.ai/privacy/');
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
