import { describe, expect, it } from 'vitest';
import {
  deltaPercent,
  deltaPoints,
  formatPercent,
  sourceLabel,
  wholeTenge,
} from './dashboard-format';

describe('dashboard-format', () => {
  it('целые тенге: тиыны округляются, отрицательное со знаком минус', () => {
    expect(wholeTenge('1568801850')).toBe('15 688 019 ₸');
    expect(wholeTenge('1568801849')).toBe('15 688 018 ₸');
    expect(wholeTenge('0')).toBe('0 ₸');
    expect(wholeTenge('-500050')).toBe('−5 001 ₸');
  });
  it('проценты с одним знаком, без хвоста у целых', () => {
    expect(formatPercent(70)).toBe('70 %');
    expect(formatPercent(66.7)).toBe('66,7 %');
  });
  it('п.п. для загрузки, % для денег и счётчиков, нет базы при нуле', () => {
    expect(deltaPoints(70, 66.8)).toEqual({ direction: 'up', text: '+3,2 п.п.' });
    expect(deltaPoints(50, 50)).toEqual({ direction: 'flat', text: '0 п.п.' });
    expect(deltaPercent(1200n, 1000n)).toEqual({ direction: 'up', text: '+20 %' });
    expect(deltaPercent(900n, 1000n)).toEqual({ direction: 'down', text: '−10 %' });
    expect(deltaPercent(7, 0)).toEqual({ direction: null, text: 'нет базы для сравнения' });
  });
  it('подпись источника: канал важнее источника', () => {
    expect(sourceLabel('OTA', 'Booking.com')).toBe('Booking.com');
    expect(sourceLabel('WALK_IN', null)).toBe('Без предварительной брони');
  });
});
