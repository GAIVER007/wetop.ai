import { describe, expect, it } from 'vitest';
import { convertMinor, parseNbkRates, rateOn, type DailyRates } from './exchange';

/**
 * Перевод денег в валюту компании по курсу Нацбанка РК на день операции (владелец 01.11.2026: «курс Нацбанка РК на
 * каждый день, сам подтягивается, каждая сумма по курсу своего дня»). Курс тенге за единицу валюты, 6 знаков;
 * деньги в минимальных единицах (AGENTS §12), без float.
 */
const XML = `<?xml version="1.0" encoding="utf-8"?>
<rates>
  <date>31.10.2026</date>
  <item><fullname>ДОЛЛАР США</fullname><title>USD</title><description>453.87</description><quant>1</quant></item>
  <item><fullname>ДИРХАМ ОАЭ</fullname><title>AED</title><description>123.59</description><quant>1</quant></item>
  <item><fullname>АРМЯНСКИЙ ДРАМ</fullname><title>AMD</title><description>12.17</description><quant>10</quant></item>
  <item><fullname>ЛОМАНЫЙ</fullname><title>XXX</title><description>abc</description><quant>1</quant></item>
</rates>`;

describe('курсы Нацбанка РК', () => {
  it('разбирает ответ: дата, тенге за 1 единицу с учётом quant, кривые строки пропускает', () => {
    const r = parseNbkRates(XML);
    expect(r.date).toBe('2026-10-31');
    expect(r.rates).toEqual([
      { currency: 'USD', kztPerUnitMicro: 453_870_000n },
      { currency: 'AED', kztPerUnitMicro: 123_590_000n },
      { currency: 'AMD', kztPerUnitMicro: 1_217_000n },
    ]);
  });
  it('пустой или чужой ответ не даёт курсов', () => {
    expect(parseNbkRates('<html>ошибка</html>')).toEqual({ date: null, rates: [] });
  });
});

describe('курс на день операции', () => {
  const rates: DailyRates = new Map([
    ['USD', [
      { date: '2026-10-01', micro: 480_000_000n },
      { date: '2026-10-15', micro: 470_000_000n },
      { date: '2026-10-31', micro: 453_870_000n },
    ]],
  ]);
  it('точный день, иначе последний известный до него; раньше первого курса нет', () => {
    expect(rateOn(rates, 'USD', '2026-10-15')).toEqual({ micro: 470_000_000n, date: '2026-10-15', exact: true });
    expect(rateOn(rates, 'USD', '2026-10-20')).toEqual({ micro: 470_000_000n, date: '2026-10-15', exact: false });
    expect(rateOn(rates, 'USD', '2026-09-30')).toBeNull();
    expect(rateOn(rates, 'KZT', '2026-09-30')).toEqual({ micro: 1_000_000n, date: '2026-09-30', exact: true });
  });
  it('перевод: каждая сумма по курсу своего дня, округление до тиына', () => {
    // $10,00 15 октября по 470 = 4 700,00 ₸; 31 октября по 453,87 = 4 538,70 ₸
    expect(convertMinor(1000n, 'USD', 'KZT', '2026-10-15', rates)).toBe(470_000n);
    expect(convertMinor(1000n, 'USD', 'KZT', '2026-10-31', rates)).toBe(453_870n);
    // 1 цент по 453,87 = 4,5387 ₸ → 4,54 ₸ (половина вверх)
    expect(convertMinor(1n, 'USD', 'KZT', '2026-10-31', rates)).toBe(454n);
    expect(convertMinor(500_000n, 'KZT', 'KZT', '2026-10-31', rates)).toBe(500_000n);
    // в доллары через тенге: 4 538,70 ₸ = $10,00
    expect(convertMinor(453_870n, 'KZT', 'USD', '2026-10-31', rates)).toBe(1000n);
    // курса нет: null, сумма не выдумывается
    expect(convertMinor(1000n, 'USD', 'KZT', '2026-09-01', rates)).toBeNull();
    expect(convertMinor(1000n, 'QAR', 'KZT', '2026-10-31', rates)).toBeNull();
  });
  it('отрицательные суммы (возвраты) переводятся симметрично', () => {
    expect(convertMinor(-1n, 'USD', 'KZT', '2026-10-31', rates)).toBe(-454n);
  });
});
