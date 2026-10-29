import { describe, expect, it } from 'vitest';
import {
  PHONE_COUNTRIES,
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_VERSION,
  defaultPhoneCountry,
  registrationLocale,
  registrationPhone,
} from './registration-contact';

describe('registrationPhone', () => {
  it('Катар: местный номер и международный код без удвоения', () => {
    expect(registrationPhone('QA', '5550 1234')).toBe('+97455501234');
    expect(registrationPhone('QA', '+974 5550 1234')).toBe('+97455501234');
    expect(defaultPhoneCountry([], 'Asia/Qatar')).toBe('QA');
  });
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
    // с 29.10.2026 в списке весь мир: регион языка «fr-FR» это Франция (раньше её не было, и выходил Казахстан)
    expect(defaultPhoneCountry(['fr-FR'], 'Europe/Paris')).toBe('FR');
    expect(defaultPhoneCountry(['fr'], 'Europe/Paris')).toBe('KZ');
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

describe('registrationLocale (Q-REG-1)', () => {
  it('известный язык интерфейса принимается, пропуск означает русский', () => {
    expect(registrationLocale('kk')).toBe('kk');
    expect(registrationLocale(undefined)).toBe('ru');
    expect(registrationLocale('')).toBe('ru');
  });
  it('чужой код и не строка: null, сервис отказывает словами', () => {
    expect(registrationLocale('xx')).toBeNull();
    expect(registrationLocale('RU')).toBeNull();
    expect(registrationLocale(7)).toBeNull();
  });
});
