import { describe, expect, it } from 'vitest';
import { placementNote } from './placement-note';

const row = (over: Partial<Parameters<typeof placementNote>[0]>) => ({
  status: 'CONFIRMED',
  arrivalDate: '2026-10-25',
  unitCodes: [] as string[],
  itemsCount: 1,
  ...over,
});

describe('колонка «Размещение» списка броней (аудит 22.10.2026 P1-13)', () => {
  const today = '2026-10-22';
  it('будущая бронь без номера: «Номер назначим позже», без тревоги', () => {
    expect(placementNote(row({}), today)).toEqual({ text: 'Номер назначим позже', warn: false });
  });
  it('заезд сегодня или раньше без номера: тревога словом «номер», не «ячейка»', () => {
    expect(placementNote(row({ arrivalDate: today }), today)).toEqual({ text: '⚠ без номера', warn: true });
  });
  it('выехавшая, отменённая и незаезд без номера: тревоги нет, номер уже не нужен', () => {
    for (const status of ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'])
      expect(placementNote(row({ status, arrivalDate: '2026-10-20' }), today)).toBeNull();
  });
  it('групповая бронь: число мест без размещения, как раньше', () => {
    expect(placementNote(row({ itemsCount: 3, unitCodes: ['R01', 'R02'] }), today)).toEqual({
      text: '⚠ 1 без размещения',
      warn: true,
    });
  });
  it('номер назначен: пометки нет', () => {
    expect(placementNote(row({ unitCodes: ['103'] }), today)).toBeNull();
  });
});
