import { describe, expect, it } from 'vitest';
import { freeMenuModel, selectRange } from './range-plan';

/**
 * Создание брони выделением (ТЗ «Шахматка v2» §31–32): администратор прижимает мышь на свободной
 * клетке и тянет по датам. Выделение идёт только по свободным ночам подряд — на занятую или закрытую
 * ночь оно не заходит; бронь поверх чужой сетка не предлагает.
 */
const cells = [
  { date: '2026-09-27', state: 'FREE' }, // 0
  { date: '2026-09-28', state: 'FREE' }, // 1
  { date: '2026-09-29', state: 'FREE' }, // 2
  { date: '2026-09-30', state: 'OCCUPIED', itemId: 'x' }, // 3
  { date: '2026-10-01', state: 'FREE' }, // 4
  { date: '2026-10-02', state: 'BLOCKED' }, // 5
];

describe('selectRange: какие ночи выделены', () => {
  it('вправо по свободным ночам', () => {
    expect(selectRange(cells, 0, 2)).toEqual({ from: 0, to: 2 });
  });
  it('останавливается перед занятой ночью, даже если мышь ушла дальше', () => {
    expect(selectRange(cells, 1, 5)).toEqual({ from: 1, to: 2 });
  });
  it('влево — тоже, начало и конец упорядочены', () => {
    expect(selectRange(cells, 2, 0)).toEqual({ from: 0, to: 2 });
    expect(selectRange(cells, 4, 0)).toEqual({ from: 4, to: 4 });
  });
  it('одна клетка — одна ночь; мышь за краем окна не ломает выделение', () => {
    expect(selectRange(cells, 1, 1)).toEqual({ from: 1, to: 1 });
    expect(selectRange(cells, 1, 99)).toEqual({ from: 1, to: 2 });
    expect(selectRange(cells, 1, -5)).toEqual({ from: 0, to: 1 });
  });
  it('с занятой или закрытой клетки выделение не начинается', () => {
    expect(selectRange(cells, 3, 4)).toBeNull();
    expect(selectRange(cells, 5, 4)).toBeNull();
  });
});

/**
 * Окошко после выделения (§31) и после щелчка по одной клетке (§32): что за место, какие ночи, и два
 * действия. Форма брони открывается уже заполненной (ячейка, заезд, выезд; категорию форма берёт по
 * ячейке), блокировка — карточкой ячейки с тем же периодом (дата «по» не включается, как у API).
 */
describe('freeMenuModel: окошко свободного периода', () => {
  const room = { code: 'R07', kind: 'ROOM' as const, categoryName: 'Двухместный номер' };
  it('период: номер, даты отрезком и ночи, «Создать бронь» и «Заблокировать»', () => {
    expect(freeMenuModel(room, '2026-09-27', '2026-09-29')).toEqual({
      single: false,
      title: 'Номер R07',
      category: 'Двухместный номер',
      dates: '27 сент. → 30 сент., 3 ночи',
      state: null,
      createLabel: 'Создать бронь',
      blockLabel: 'Заблокировать',
      newHref: '/reservations/new?arrival=2026-09-27&departure=2026-09-30&unit=R07',
      blockHref: '/units/R07?blockFrom=2026-09-27&blockTo=2026-09-30#block-form',
    });
  });
  it('одна клетка: дата, «Свободен», «Новая бронь» и «Блокировка» (§32)', () => {
    const m = freeMenuModel(room, '2026-09-28', '2026-09-28');
    expect(m).toMatchObject({
      single: true,
      dates: '28 сент.',
      state: 'Свободен',
      createLabel: 'Новая бронь',
      blockLabel: 'Блокировка',
      newHref: '/reservations/new?arrival=2026-09-28&departure=2026-09-29&unit=R07',
    });
  });
  it('койка — «Койка M03», «Свободна»; код ячейки в адресе экранируется', () => {
    const m = freeMenuModel(
      { code: 'M 03', kind: 'BED', categoryName: 'Общий номер' },
      '2026-09-28',
      '2026-09-28',
    );
    expect(m.title).toBe('Койка M 03');
    expect(m.state).toBe('Свободна');
    expect(m.newHref).toContain('unit=M%2003');
    expect(m.blockHref.startsWith('/units/M%2003?')).toBe(true);
  });
});
