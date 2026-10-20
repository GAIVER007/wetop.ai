import { describe, expect, it } from 'vitest';
import { homeCurrency } from './home-currency';

/** Валюта Главной гостиницы: из долгов, иначе объекта, а не жёсткий KZT (аудит платформы 17.10.2026, Д11) */
describe('валюта Главной гостиницы', () => {
  it('долги не загрузились: валюта объекта', () => {
    expect(homeCurrency(null, 'USD')).toBe('USD');
  });
  it('долги загрузились: их валюта', () => {
    expect(homeCurrency({ currency: 'EUR' }, 'USD')).toBe('EUR');
  });
});
