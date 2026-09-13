import { describe, expect, it } from 'vitest';
import type { ChessboardCell } from '../../lib/api';
import { stayLabels } from './stay-labels';

const occupied = (date: string, itemId: string, isArrival = false): ChessboardCell => ({
  date,
  itemId,
  isArrival,
  state: 'OCCUPIED',
  itemStatus: 'CONFIRMED',
});
describe('подпись непрерывного проживания в видимом окне', () => {
  it('показывает имя даже если заезд остался за левой границей', () => {
    expect(stayLabels([occupied('2026-09-13', 'A'), occupied('2026-09-14', 'A')])).toEqual([
      { index: 0, span: 2, continues: true },
    ]);
  });
  it('не объединяет соседние проживания и не протягивает текст через свободную ночь', () => {
    expect(
      stayLabels([
        occupied('2026-09-13', 'A', true),
        occupied('2026-09-14', 'B', true),
        { date: '2026-09-15', state: 'FREE' },
        occupied('2026-09-16', 'B'),
      ]),
    ).toEqual([
      { index: 0, span: 1, continues: false },
      { index: 1, span: 1, continues: false },
      { index: 3, span: 1, continues: true },
    ]);
  });
  it('не рисует полосу бронирования на блокировке', () => {
    expect(stayLabels([{ date: '2026-09-13', state: 'BLOCKED' }])).toEqual([]);
  });
});
