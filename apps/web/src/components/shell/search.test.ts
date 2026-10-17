import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS } from '../../lib/navigation';
import { searchMatches } from './search';

const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const hrefs = (vertical: Parameters<typeof searchMatches>[1], q: string) =>
  searchMatches(owner, vertical, q).map((i) => i.href);

/** Д3 аудита платформы (17.10.2026): быстрый переход строится по меню своего направления */
describe('быстрый переход поиска', () => {
  it('салон: «Календарь» это календарь записей, шахматки нет', () => {
    expect(hrefs('BEAUTY', 'кал')).toEqual(['/calendar']);
  });
  it('ресторан: свои разделы, гостиничных нет', () => {
    expect(hrefs('FOOD_SERVICE', 'план')).toEqual(['/floor-plan']);
    expect(hrefs('FOOD_SERVICE', 'кал')).toEqual([]);
  });
  it('гостиница: как прежде', () => {
    expect(hrefs('HOSPITALITY', 'кал')).toEqual(['/chessboard']);
  });
});
