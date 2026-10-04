import { describe, expect, it } from 'vitest';
import {
  activeSelects,
  describeFilters,
  directoryQuery,
  guestsHref,
  keptParams,
  parseGuestFilters,
} from './filters';

const period = (from: string, to: string) => `${from} → ${to}`;

describe('отбор гостей в адресе (G7, ТЗ §31)', () => {
  it('читает раздел, поиск, визит, визиты, порядок и страницу; ссылка даёт тот же адрес', () => {
    const { f, error } = parseGuestFilters({
      state: 'none',
      q: ' Петров ',
      last: '7d',
      visits: '2-5',
      sort: 'next',
      page: '2',
    });
    expect(error).toBeNull();
    expect(f).toMatchObject({
      state: 'NONE',
      q: 'Петров',
      last: '7d',
      visits: '2-5',
      sort: 'next',
    });
    expect(guestsHref(f, { page: '2' })).toBe(
      '/guests?state=none&q=%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2&last=7d&visits=2-5&sort=next&page=2',
    );
    // смена отбора возвращает на первую страницу
    expect(guestsHref(f, { visits: '1' })).not.toContain('page=');
    expect(directoryQuery(f, 100)).toEqual({
      state: 'NONE',
      q: 'Петров',
      last: '7d',
      visits: '2-5',
      sort: 'next',
      page: '2',
      pageSize: '100',
    });
    expect(activeSelects(f)).toBe(3);
  });

  it('по умолчанию — короткий адрес /guests; старый ?status= читается разделом', () => {
    const { f } = parseGuestFilters({});
    expect(guestsHref(f)).toBe('/guests');
    expect(activeSelects(f)).toBe(0);
    expect(parseGuestFilters({ status: 'CHECKED_IN' }).f.state).toBe('INHOUSE');
  });

  it('период: даты нужны обе и по порядку; без периода даты из адреса не едут', () => {
    const ok = parseGuestFilters({ last: 'period', from: '2026-09-01', to: '2026-09-10' });
    expect(ok.error).toBeNull();
    expect(guestsHref(ok.f)).toBe('/guests?last=period&from=2026-09-01&to=2026-09-10');
    expect(describeFilters(ok.f, period)).toEqual(['последний визит 2026-09-01 → 2026-09-10']);
    for (const bad of [
      { last: 'period' },
      { last: 'period', from: '2026-09-10', to: '2026-09-01' },
      { last: 'period', from: '2026-02-30', to: '2026-03-01' },
      { last: 'period', from: '2026-13-01', to: '2026-13-05' },
    ])
      expect(parseGuestFilters(bad).error).toMatch(/Период последнего визита/);
    expect(parseGuestFilters({ last: '7d', from: '2026-09-01', to: '2026-09-10' }).f.from).toBe('');
  });

  it('неизвестное значение — слово об ошибке и полный список, а не молча другой отбор', () => {
    for (const [sp, word] of [
      [{ state: 'lost' }, /раздел/],
      [{ last: 'week' }, /последнему визиту/],
      [{ visits: '5+' }, /числу визитов/],
      [{ sort: 'debt' }, /порядок/],
      [{ page: '0' }, /страницы/],
    ] as const) {
      const r = parseGuestFilters(sp);
      expect(r.error).toMatch(word);
      expect(guestsHref(r.f)).toBe('/guests');
    }
  });

  it('поиск и «Показать» уносят отбор, который сами не задают; отбор словами', () => {
    const { f } = parseGuestFilters({ state: 'recent', q: 'ив', last: '30d', visits: '1' });
    expect(keptParams(f, ['q'])).toEqual({ state: 'recent', last: '30d', visits: '1' });
    expect(keptParams(f, ['last', 'from', 'to', 'visits', 'sort'])).toEqual({
      state: 'recent',
      q: 'ив',
    });
    expect(describeFilters(f, period)).toEqual(['последний визит за 30 дней', '1 визит']);
  });
});
