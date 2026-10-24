import { describe, expect, it } from 'vitest';
import { MarketInputError } from './occupancy';
import {
  FEW_SLOTS_MAX,
  buildBusinessMarketBoard,
  businessPlatform,
  levelFromSlots,
  parseLocationCompetitorInput,
  parseSnapshotInput,
} from './business';

describe('конкуренты салона и ресторана (DATA_MODEL §60)', () => {
  it('уровень по свободным окнам: 0 — нет мест, до 3 — мало, больше — есть', () => {
    expect(levelFromSlots(0)).toBe('SOLD_OUT');
    expect(levelFromSlots(1)).toBe('FEW_LEFT');
    expect(levelFromSlots(FEW_SLOTS_MAX)).toBe('FEW_LEFT');
    expect(levelFromSlots(FEW_SLOTS_MAX + 1)).toBe('AVAILABLE');
  });

  it('площадка по ссылке соседа: Dikidi, YCLIENTS, Restoplace; подделка домена не проходит', () => {
    expect(businessPlatform('https://dikidi.net/ru/record/2105665')).toBe('Dikidi');
    expect(businessPlatform('https://n1.yclients.com/company/1/')).toBe('YCLIENTS');
    expect(businessPlatform('https://restoplace.cc/r/x')).toBe('Restoplace');
    expect(businessPlatform('https://dikidi.net.evil.io/x')).toBeNull();
    expect(businessPlatform('https://instagram.com/salon')).toBeNull();
    expect(businessPlatform('не ссылка')).toBeNull();
  });

  it('сосед: название обязательно, ссылка только http(s), расстояние от нуля', () => {
    expect(parseLocationCompetitorInput({ name: ' Салон рядом ', url: 'https://dikidi.net/ru/profile/x', distanceM: '150' }, 'create'))
      .toEqual({ name: 'Салон рядом', url: 'https://dikidi.net/ru/profile/x', distanceM: 150 });
    expect(() => parseLocationCompetitorInput({ name: '' }, 'create')).toThrow(MarketInputError);
    expect(() => parseLocationCompetitorInput({ name: 'x', url: 'javascript:alert(1)' }, 'create')).toThrow(/https/);
    expect(() => parseLocationCompetitorInput({ name: 'x', distanceM: -5 }, 'create')).toThrow(/от нуля/);
    expect(parseLocationCompetitorInput({ url: '', active: false }, 'update')).toEqual({ url: null, active: false });
  });

  it('снимок: день не раньше сегодня, число окон задаёт уровень, «нет мест» с окнами — отказ', () => {
    expect(parseSnapshotInput({ day: '2026-10-30', freeSlots: 2 }, '2026-10-23')).toEqual({ day: '2026-10-30', level: 'FEW_LEFT', freeSlots: 2 });
    expect(parseSnapshotInput({ day: '2026-10-23', level: 'SOLD_OUT' }, '2026-10-23')).toEqual({ day: '2026-10-23', level: 'SOLD_OUT', freeSlots: null });
    expect(() => parseSnapshotInput({ day: '2026-10-22', level: 'AVAILABLE' }, '2026-10-23')).toThrow(/не раньше/);
    expect(() => parseSnapshotInput({ day: '2026-10-30', level: 'SOLD_OUT', freeSlots: 4 }, '2026-10-23')).toThrow(/не бывают/);
    expect(() => parseSnapshotInput({ day: '2026-10-30' }, '2026-10-23')).toThrow(/уровень/);
    expect(() => parseSnapshotInput({ day: '30.10.2026', level: 'AVAILABLE' }, '2026-10-23')).toThrow(/ГГГГ/);
    expect(() => parseSnapshotInput({ day: '2026-10-30', level: 'FULL' }, '2026-10-23')).toThrow(/Уровень/);
  });

  it('доска: свежий снимок побеждает, в тот же день ручной сильнее сборщика, пустая клетка без выдумки', () => {
    const board = buildBusinessMarketBoard({
      from: '2026-10-30',
      days: 3,
      competitors: [
        { id: 'a', name: 'Салон А', url: 'https://dikidi.net/ru/record/1', distanceM: 100 },
        { id: 'b', name: 'Салон Б', url: null, distanceM: null },
      ],
      snapshots: [
        { competitorId: 'a', day: '2026-10-30', observedOn: '2026-10-22', level: 'AVAILABLE', freeSlots: 9, source: 'AI_AGENT' },
        { competitorId: 'a', day: '2026-10-30', observedOn: '2026-10-23', level: 'FEW_LEFT', freeSlots: 2, source: 'AI_AGENT' },
        { competitorId: 'a', day: '2026-10-31', observedOn: '2026-10-23', level: 'AVAILABLE', freeSlots: 8, source: 'AI_AGENT' },
        { competitorId: 'a', day: '2026-10-31', observedOn: '2026-10-23', level: 'SOLD_OUT', freeSlots: 0, source: 'MANUAL' },
        { competitorId: 'b', day: '2026-10-30', observedOn: '2026-10-23', level: 'SOLD_OUT', freeSlots: null, source: 'MANUAL' },
      ],
    });
    expect(board.days).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    const a = board.competitors[0]!;
    expect(a.platform).toBe('Dikidi');
    expect(a.cells.map((c) => c.level)).toEqual(['FEW_LEFT', 'SOLD_OUT', null]);
    expect(a.cells[1]!.source).toBe('MANUAL');
    expect(board.competitors[1]!.platform).toBeNull();
    // 30.10: оба «тесно» → почти полон; 31.10: один сосед с данными, «нет мест» → почти полон; 01.11 данных нет
    expect(board.market.map((m) => [m.withData, m.tight, m.full])).toEqual([[2, 2, true], [1, 1, true], [0, 0, false]]);
    expect(board.summary).toEqual({ competitors: 2, withData: 2, fullDays: 2, lastObservedOn: '2026-10-23' });
  });

  it('рынок почти полон с половины соседей: 1 из 2 — да, 1 из 3 — нет', () => {
    const c = (id: string) => ({ id, name: id, url: null, distanceM: null });
    const s = (id: string, level: 'SOLD_OUT' | 'AVAILABLE') => ({ competitorId: id, day: '2026-10-30', observedOn: '2026-10-23', level, freeSlots: null, source: 'MANUAL' as const });
    expect(buildBusinessMarketBoard({ from: '2026-10-30', days: 1, competitors: [c('a'), c('b')], snapshots: [s('a', 'SOLD_OUT'), s('b', 'AVAILABLE')] }).market[0]!.full).toBe(true);
    expect(buildBusinessMarketBoard({ from: '2026-10-30', days: 1, competitors: [c('a'), c('b'), c('d')], snapshots: [s('a', 'SOLD_OUT'), s('b', 'AVAILABLE'), s('d', 'AVAILABLE')] }).market[0]!.full).toBe(false);
  });
});
