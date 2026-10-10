import { describe, expect, it } from 'vitest';
import { markupPercent, recommendedPriceMinor, sharePercent, stockStatusOf } from './stock-status';

/** Числа доски «Товары и остатки» (макет владельца 09.10.2026): только BigInt, без float */
describe('бар: статус, наценка и цена', () => {
  it('статус остатка: ноль даёт «нет в наличии», минимум даёт «заканчивается»', () => {
    expect(stockStatusOf({ availableUnits: '0', minimumStockUnits: '10' })).toBe('out');
    expect(stockStatusOf({ availableUnits: '5', minimumStockUnits: '10' })).toBe('low');
    expect(stockStatusOf({ availableUnits: '10', minimumStockUnits: '10' })).toBe('low');
    expect(stockStatusOf({ availableUnits: '24', minimumStockUnits: '10' })).toBe('ok');
  });

  it('фактическая наценка как на макете: 600 к 320 даёт 88 %, 400 к 180 даёт 122 %', () => {
    expect(markupPercent('60000', '32000')).toBe(88);
    expect(markupPercent('40000', '18000')).toBe(122);
    expect(markupPercent('100000', '50000')).toBe(100);
    expect(markupPercent('100000', null)).toBeNull();
    expect(markupPercent('100000', '0')).toBeNull();
  });

  it('рекомендованная цена по наценке вверх до 10 тенге', () => {
    // 320 ₸ + 88 % = 601,60 ₸, вверх до 10 тенге: 610 ₸
    expect(recommendedPriceMinor('32000', 8800n)).toBe('61000');
    expect(recommendedPriceMinor('78000', 3500n)).toBe('106000');
    expect(recommendedPriceMinor('10000', 0n)).toBe('10000');
  });

  it('маржинальность: прибыль к выручке, без выручки её нет', () => {
    expect(sharePercent(623_400_00n, 1_245_600_00n)).toBe(50);
    expect(sharePercent(1n, 0n)).toBeNull();
  });
});
