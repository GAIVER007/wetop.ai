import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS } from '../../lib/navigation';
import { searchMatches } from './search';
import { translator } from '../../i18n';

const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const hrefs = (vertical: Parameters<typeof searchMatches>[1], q: string) =>
  searchMatches(owner, vertical, q).map((i) => i.href);

/** Д3 аудита платформы (17.10.2026): быстрый переход строится по меню своего направления */
describe('быстрый переход поиска', () => {
  // верхнее меню 17.10.2026: календарь записей салона называется «Журнал», шахматка гостиницы «Шахматка»
  it('салон: «Журнал» это календарь записей, шахматки нет', () => {
    expect(hrefs('BEAUTY', 'жур')).toEqual(['/calendar']);
    expect(hrefs('BEAUTY', 'шах')).toEqual([]);
  });
  it('ресторан: свои разделы, гостиничных нет', () => {
    // журнал ресторана это живой план зала (одно меню у всех направлений, 17.10.2026)
    expect(hrefs('FOOD_SERVICE', 'жур')).toEqual(['/floor-plan']);
    expect(hrefs('FOOD_SERVICE', 'кал')).toEqual([]);
  });
  it('гостиница: журнал это шахматка', () => {
    expect(hrefs('HOSPITALITY', 'жур')).toEqual(['/chessboard']);
  });
  it('KK1: по-казахски раздел находится и казахским, и русским словом, подпись казахская', () => {
    const t = translator('kk');
    expect(searchMatches(owner, 'BEAUTY', 'жазыл', t).map((i) => [i.href, i.label])).toEqual([['/appointments', 'Жазылулар']]);
    expect(searchMatches(owner, 'BEAUTY', 'запис', t).map((i) => i.label)).toEqual(['Жазылулар']);
  });
});
