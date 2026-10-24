import { describe, expect, it } from 'vitest';
import { formatPhone, formatPhoneInput } from './phone-format';

/** Телефон для глаз (владелец 22.10.2026): «+7 777 777 77 77», а не «77777777777» */
describe('формат телефона', () => {
  it('казахстанский и российский номер группами 3 3 2 2', () => {
    expect(formatPhone('+77777777777')).toBe('+7 777 777 77 77');
    expect(formatPhone('77011234567')).toBe('+7 701 123 45 67');
    expect(formatPhone('87011234567')).toBe('+7 701 123 45 67');
    expect(formatPhone('7011234567')).toBe('+7 701 123 45 67');
    expect(formatPhone('+7 (701) 123-45-67')).toBe('+7 701 123 45 67');
  });
  it('другая страна: плюс и цифры группами по три, без потери цифр', () => {
    expect(formatPhone('+998901234567')).toBe('+998 901 234 567');
    expect(formatPhone('+44 20 7946 0958')).toBe('+442 079 460 958');
  });
  it('пустое и не номер не трогаются', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
    expect(formatPhone('звонить администратору')).toBe('звонить администратору');
    // маска скрытого номера остаётся как есть
    expect(formatPhone('+770****0001')).toBe('+770****0001');
  });
  it('ввод: формат по мере набора, лишние цифры отрезаются', () => {
    expect(formatPhoneInput('7')).toBe('+7');
    expect(formatPhoneInput('8701')).toBe('+7 701');
    expect(formatPhoneInput('+7701123')).toBe('+7 701 123');
    expect(formatPhoneInput('77011234')).toBe('+7 701 123 4');
    expect(formatPhoneInput('770112345678999')).toBe('+7 701 123 45 67');
    expect(formatPhoneInput('')).toBe('');
    expect(formatPhoneInput('+')).toBe('+');
    // чужой код страны и буквы остаются как введены: проверку делает сервер
    expect(formatPhoneInput('+998901')).toBe('+998901');
    expect(formatPhoneInput('+0000000002')).toBe('+0000000002');
    expect(formatPhoneInput('invalid')).toBe('invalid');
  });
});
