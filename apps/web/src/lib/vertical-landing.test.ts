import { describe, expect, it } from 'vitest';
import { landingForVertical, startScreen } from './vertical-landing';

/**
 * Владелец 27.10.2026: «всегда при открытии сайта, программы, приложения открывалась шахматка, журнал, календарь.
 * У владельца главная». Стартовый экран: владелец видит Главную, остальные сразу рабочее поле своего направления.
 */
describe('стартовый экран по роли', () => {
  it('владелец всегда на Главной', () => {
    for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
      expect(startScreen(v, 'OWNER')).toBe('/today');
  });
  it('администратор и управляющий сразу в рабочем поле: шахматка, журнал салона, брони столов', () => {
    for (const role of ['MANAGER', 'STAFF'] as const) {
      expect(startScreen('HOSPITALITY', role)).toBe('/chessboard');
      expect(startScreen('BEAUTY', role)).toBe('/calendar');
      expect(startScreen('FOOD_SERVICE', role)).toBe('/table-reservations');
    }
  });
  it('личный кабинет сотрудника остаётся «Моя работа»', () => {
    expect(startScreen('BEAUTY', 'EMPLOYEE')).toBe('/my-work');
  });
  it('роль неизвестна (открытый стенд): прежняя стартовая страница', () => {
    expect(startScreen('BEAUTY', null)).toBe(landingForVertical('BEAUTY'));
  });
});
