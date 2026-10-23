import { describe, expect, it } from 'vitest';
import { formatPhoneInput, phoneFieldValue } from './phone';

describe('phoneFieldValue: начальное значение поля телефона', () => {
  it('казахстанский номер сразу в формате «+7 701 555 44 33»', () => {
    expect(phoneFieldValue('+77015554433')).toBe('+7 701 555 44 33');
    expect(phoneFieldValue('87015554433')).toBe('+7 701 555 44 33');
  });

  it('пусто остаётся пустым', () => {
    expect(phoneFieldValue(null)).toBe('');
    expect(phoneFieldValue(undefined)).toBe('');
    expect(phoneFieldValue('')).toBe('');
  });

  it('совпадает с тем, что поле покажет после ввода: сохранённый номер не выглядит изменённым', () => {
    // CI beauty-ui 22.10.2026: «+0000000008» показывался как «+000 000 000 8», поле при вводе возвращало «+0000000008»,
    // форма считала профиль изменённым и спрашивала «Несохранённые изменения» при переходе на вкладку
    for (const raw of ['+0000000008', '+77015554433', '+44 20 7946 0958', '8 (700) 000-50-01', '+770****4433'])
      expect(formatPhoneInput(phoneFieldValue(raw))).toBe(phoneFieldValue(raw));
  });
});
