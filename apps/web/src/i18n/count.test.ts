import { describe, expect, it } from 'vitest';
import { countLabel, translator } from './index';

/**
 * Число со словом на языке человека (EN1). Код KK2 ветвился `locale === 'kk'`, и английский уходил в русское
 * склонение: «5 товаров» на английском экране. Один помощник на все языки.
 */
describe('countLabel', () => {
  const forms: [string, string, string] = ['день', 'дня', 'дней'];
  it('русский: прежнее склонение', () => {
    expect(countLabel('ru', translator('ru'), 1, forms)).toBe('1 день');
    expect(countLabel('ru', translator('ru'), 3, forms)).toBe('3 дня');
    expect(countLabel('ru', translator('ru'), 21, forms)).toBe('21 день');
  });
  it('казахский: одна форма при любом числе', () => {
    expect(countLabel('kk', translator('kk'), 5, forms)).toBe('5 күн');
  });
  it('английский: единственное только для 1, иначе множественное (и для 21)', () => {
    expect(countLabel('en', translator('en'), 1, forms)).toBe('1 day');
    expect(countLabel('en', translator('en'), 21, forms)).toBe('21 days');
    expect(countLabel('en', translator('en'), 0, forms)).toBe('0 days');
  });
});
