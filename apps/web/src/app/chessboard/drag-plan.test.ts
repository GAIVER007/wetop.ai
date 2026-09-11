import { describe, expect, it } from 'vitest';
import { DRAG_MIME, decodeDrag, encodeDrag, planMove } from './drag-plan';

/** Переселение перетаскиванием по шахматке: что уезжает в dataTransfer и что спрашиваем у стойки. */
const payload = {
  number: '20260911-ABC123',
  itemId: 'item-1',
  date: '2026-09-15',
  unitCode: 'B-07',
};

describe('drag-plan: перетаскивание брони по шахматке', () => {
  it('тип данных свой — чужой drop (файл, текст, ссылка) не читается как бронь', () => {
    expect(DRAG_MIME).toBe('application/x-pms-stay');
  });
  it('payload проходит через dataTransfer без потерь', () => {
    expect(decodeDrag(encodeDrag(payload))).toEqual(payload);
  });
  it('битый или чужой payload не превращается в переселение', () => {
    expect(decodeDrag('')).toBeNull();
    expect(decodeDrag('not json')).toBeNull();
    expect(decodeDrag(JSON.stringify({ number: 'x' }))).toBeNull();
    expect(decodeDrag(JSON.stringify({ ...payload, date: '15.09.2026' }))).toBeNull();
  });
  it('бросок на ту же ячейку — ничего не делать: ни вопроса, ни вызова API', () => {
    expect(planMove(payload, { unitCode: 'B-07' })).toEqual({ kind: 'noop' });
  });
  it('бросок на другую ячейку — переселение с даты взятой клетки и вопрос администратору', () => {
    expect(planMove(payload, { unitCode: 'B-12' })).toEqual({
      kind: 'move',
      unitCode: 'B-12',
      fromDate: '2026-09-15',
      confirmText: 'Переселить бронь 20260911-ABC123 в ячейку B-12 с даты 2026-09-15?',
    });
  });
});
