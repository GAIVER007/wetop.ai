import { describe, expect, it } from 'vitest';
import { extendLabel, extensionConflict, extensionNights } from './extend-plan';

describe('продление за правый край', () => {
  it('добавляет ночи до выбранной последней ночи, включая границу месяца', () => {
    expect(extensionNights('2026-09-29', '2026-10-02')).toBe(3);
  });
  it('не сокращает проживание и не принимает неверные даты или более 30 ночей', () => {
    expect(extensionNights('2026-09-29', '2026-09-29')).toBe(0);
    expect(extensionNights('2026-09-29', '2026-09-28')).toBe(0);
    expect(extensionNights('2026-09-29', '2026-11-01')).toBe(0);
    expect(extensionNights('2026-02-30', '2026-03-04')).toBe(0);
  });
});

/**
 * ТЗ «Шахматка v2» §29: визуально продлить поверх чужой брони нельзя, конфликт виден до того, как
 * администратор отпустил мышь. Смотрим клетки той же строки после последней ночи; то, что за краем
 * окна, проверяет сервер (предпросмотр продления и сама команда).
 */
describe('extensionConflict: новые ночи свободны?', () => {
  const cells = [
    { date: '2026-09-23', state: 'OCCUPIED', itemId: 'item-1' },
    { date: '2026-09-24', state: 'FREE' },
    { date: '2026-09-25', state: 'OCCUPIED', itemId: 'other' },
    { date: '2026-09-26', state: 'BLOCKED', blockType: 'MAINTENANCE' },
  ];
  it('свободная ночь — конфликта нет', () => {
    expect(extensionConflict(cells, '2026-09-23', 1, 'item-1')).toBeNull();
  });
  it('первая занятая ночь называется датой словами', () => {
    expect(extensionConflict(cells, '2026-09-23', 3, 'item-1')).toBe('Занято с 25 сент.');
  });
  it('блокировка — «недоступно» и тип', () => {
    expect(
      extensionConflict([cells[0]!, { ...cells[3]!, date: '2026-09-24' }], '2026-09-23', 1, 'item-1'),
    ).toMatch(/^Недоступно с 24 сент\.: /);
  });
  it('ночи за краем окна здесь не видны — решает сервер', () => {
    expect(extensionConflict(cells.slice(0, 2), '2026-09-23', 5, 'item-1')).toBeNull();
  });
});

describe('extendLabel: подпись во время продления', () => {
  it('до какой даты, сколько ночей и сколько денег (§29)', () => {
    expect(extendLabel('2026-09-23', 3, { addedMinor: '7500000', currency: 'KZT' })).toBe(
      'До 27 сент., +3 ночи, +75 000 ₸',
    );
  });
  it('пока сумма считается — без неё, сумму не выдумываем', () => {
    expect(extendLabel('2026-09-23', 1, undefined)).toBe('До 25 сент., +1 ночь');
  });
});
