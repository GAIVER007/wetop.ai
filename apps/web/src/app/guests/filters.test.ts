import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  activeSelects,
  directoryQuery,
  filtersOn,
  guestsHref,
  keptParams,
  needsCleanup,
  parseGuestFilters,
} from './filters';

const parse = (sp: Record<string, string>) => parseGuestFilters(sp);

describe('адрес «Гостей и бронирований» → отбор', () => {
  it('пустой адрес: всё по умолчанию, ошибки нет', () => {
    expect(parse({})).toEqual({ f: DEFAULT_FILTERS, error: null });
    expect(filtersOn(DEFAULT_FILTERS)).toBe(false);
  });

  it('читает вид, статус, источник, период, переключатели, размер, страницу и выбранного гостя', () => {
    const { f, error } = parse({
      view: 'attention',
      state: 'inhouse',
      q: '  Петров ',
      source: 'booking',
      period: '7d',
      debt: '1',
      fresh: '1',
      nocontact: '1',
      size: '25',
      page: '3',
      guest: 'g-1',
    });
    expect(error).toBeNull();
    expect(f).toMatchObject({
      view: 'attention',
      state: 'INHOUSE',
      q: 'Петров',
      source: 'booking',
      period: '7d',
      debt: true,
      fresh: true,
      nocontact: true,
      size: 25,
      page: '3',
      guest: 'g-1',
    });
    expect(activeSelects(f)).toBe(6);
  });

  it('свои даты нужны только периоду «Свои даты»: без него они в отбор не попадают', () => {
    expect(parse({ period: '30d', from: '2026-10-01', to: '2026-10-05' }).f).toMatchObject({
      from: '',
      to: '',
    });
    expect(parse({ period: 'range', from: '2026-10-01', to: '2026-10-05' })).toMatchObject({
      f: { period: 'range', from: '2026-10-01', to: '2026-10-05' },
      error: null,
    });
  });

  it('опечатка в адресе: слово для страницы и полный список, а не молча половина отбора', () => {
    for (const sp of [
      { view: 'debt' },
      { state: 'LEFT' },
      { page: '0' },
      { page: 'abc' },
      { page: '10001' },
      { size: '7' },
      { q: 'а'.repeat(121) },
      { source: 'а'.repeat(65) },
      { period: 'week' },
      { period: 'range' },
      { period: 'range', from: '2026-10-05', to: '2026-10-01' },
      { period: 'range', from: '2026-02-30', to: '2026-03-01' },
      { period: 'range', from: '2025-01-01', to: '2026-12-31' },
    ]) {
      const r = parse(sp);
      expect(r.error, JSON.stringify(sp)).toEqual(expect.any(String));
      expect(r.f).toEqual(DEFAULT_FILTERS);
    }
  });

  it('прежние параметры «Гостей v2» (last, visits, sort) страница не читает', () => {
    const r = parse({ last: '7d', visits: '2-5', sort: 'visits' });
    expect(r).toEqual({ f: DEFAULT_FILTERS, error: null });
  });
});

describe('ссылки и запрос к API', () => {
  const f = { ...DEFAULT_FILTERS };

  it('умолчания в адрес не пишутся: «Все» это /guests', () => {
    expect(guestsHref(f)).toBe('/guests');
    expect(guestsHref(f, { view: 'departures' })).toBe('/guests?view=departures');
    expect(guestsHref(f, { state: 'NONE' })).toBe('/guests?state=none');
    expect(guestsHref({ ...f, size: 25 }, { debt: true })).toBe('/guests?debt=1&size=25');
  });

  it('смена отбора возвращает на первую страницу и снимает выбранного гостя', () => {
    const at = { ...f, page: '4', guest: 'g-9', view: 'inhouse' as const };
    expect(guestsHref(at, { view: 'expected' })).toBe('/guests?view=expected');
    // а выбор гостя и страница сами по себе отбор не сбрасывают
    expect(guestsHref(at, { guest: 'g-2' })).toBe('/guests?view=inhouse&page=4&guest=g-2');
    expect(guestsHref(at, { page: '5' })).toBe('/guests?view=inhouse&page=5');
  });

  it('закрытая панель живёт в адресе как guest=none', () => {
    expect(guestsHref(f, { guest: 'none' })).toBe('/guests?guest=none');
  });

  it('скрытые поля формы: отбор без собственных полей формы, без страницы и выбранного гостя', () => {
    const at = { ...f, view: 'today' as const, source: 'WEBSITE', page: '2', guest: 'g-1', q: 'Анна' };
    expect(keptParams(at, ['q', 'source'])).toEqual({ view: 'today' });
  });

  it('запрос к API: параметры только заданные, период своими датами, размер и страница всегда', () => {
    expect(directoryQuery(f)).toEqual({ page: '1', pageSize: '10' });
    expect(
      directoryQuery({
        ...f,
        view: 'attention',
        state: 'EXPECTED',
        q: 'Анна',
        source: 'booking',
        debt: true,
        fresh: true,
        nocontact: true,
        period: 'range',
        from: '2026-10-01',
        to: '2026-10-31',
        size: 50,
        page: '2',
      }),
    ).toEqual({
      state: 'EXPECTED',
      view: 'attention',
      q: 'Анна',
      source: 'booking',
      debt: '1',
      fresh: '1',
      nocontact: '1',
      period: 'range',
      periodFrom: '2026-10-01',
      periodTo: '2026-10-31',
      page: '2',
      pageSize: '50',
    });
    // поиск из одного знака API не посылается: порог два символа
    expect(directoryQuery({ ...f, q: 'А' })).toEqual({ page: '1', pageSize: '10' });
  });
});

describe('чистка адреса от пустых полей и умолчаний', () => {
  it('пустое поле или умолчание: нужна чистка; заданный отбор и неизвестные параметры: нет', () => {
    for (const sp of [
      { q: '' },
      { view: 'all' },
      { state: 'ALL' },
      { state: 'all' },
      { source: '' },
      { period: '' },
      { debt: '0' },
      { fresh: '' },
      { size: '10' },
      { page: '1' },
      { guest: '' },
      { from: '2026-10-01' },
      { period: '7d', to: '2026-10-05' },
    ])
      expect(needsCleanup(sp), JSON.stringify(sp)).toBe(true);
    for (const sp of [
      {},
      { view: 'attention' },
      { state: 'inhouse' },
      { debt: '1' },
      { size: '25' },
      { page: '2' },
      { guest: 'g-1' },
      { period: 'range', from: '2026-10-01', to: '2026-10-05' },
      { utm_source: 'mail' },
      { q: 'А' },
    ])
      expect(needsCleanup(sp), JSON.stringify(sp)).toBe(false);
  });
});
