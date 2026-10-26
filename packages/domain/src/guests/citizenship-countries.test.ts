import { describe, expect, it } from 'vitest';
import { CITIZENSHIP_COUNTRIES, citizenshipLabel, citizenshipRequiredForCheckIn } from './citizenship-countries';

describe('гражданство: правило заселения по стране гостиницы (решение 24.10.2026)', () => {
  it('Казахстан и страна не указана: гражданство обязательно (eQonaq)', () => {
    expect(citizenshipRequiredForCheckIn('KZ')).toBe(true);
    expect(citizenshipRequiredForCheckIn('kz')).toBe(true);
    // старые объекты без страны: правило остаётся, ничего не ослабляем молча
    expect(citizenshipRequiredForCheckIn(null)).toBe(true);
    expect(citizenshipRequiredForCheckIn('')).toBe(true);
  });
  it('другая страна (Катар, ОАЭ): eQonaq нет, заселение без гражданства разрешено', () => {
    expect(citizenshipRequiredForCheckIn('QA')).toBe(false);
    expect(citizenshipRequiredForCheckIn('AE')).toBe(false);
  });
});

describe('список стран для выбора гражданства', () => {
  it('все страны ISO 3166-1, коды alpha-3 без повторов, названия по-русски', () => {
    expect(CITIZENSHIP_COUNTRIES.length).toBeGreaterThanOrEqual(249);
    const codes = CITIZENSHIP_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{3}$/.test(c))).toBe(true);
  });
  it('частые для стойки страны первыми, дальше по алфавиту', () => {
    expect(CITIZENSHIP_COUNTRIES.slice(0, 4).map((c) => c.code)).toEqual(['KAZ', 'RUS', 'UZB', 'KGZ']);
    expect(citizenshipLabel('KAZ')).toBe('Казахстан');
    expect(citizenshipLabel('QAT')).toBe('Катар');
    expect(citizenshipLabel('qat')).toBe('Катар');
    // неизвестный код из старых данных не теряется: показывается как есть
    expect(citizenshipLabel('XXZ')).toBe('XXZ');
    expect(citizenshipLabel(null)).toBeNull();
  });
});
