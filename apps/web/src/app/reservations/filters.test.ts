import { describe, expect, it } from 'vitest';
import {
  apiQuery,
  cleanHref,
  filtersHref,
  needsCleanup,
  readFilters,
  sourceLabel,
} from './filters';

const TODAY = '2026-09-27';

/**
 * «Брони v2», срез R2 (ADR-106): отбор целиком живёт в адресе. Ссылки Главной короткие и относительные —
 * `?arrival=today` в закладке значит «сегодня» и завтра, а не дату, когда закладку сделали.
 */
describe('отбор броней в адресе', () => {
  it('без параметров — прежний день объекта, вид «Все»', () => {
    expect(readFilters({}, TODAY)).toMatchObject({
      from: TODAY,
      to: TODAY,
      status: 'ALL',
      q: '',
      view: 'all',
      date: 'stay',
      source: '',
      payment: '',
      allocation: '',
      category: '',
      sort: '',
    });
  });

  it('сахар Главной: arrival=today и departure=YYYY-MM-DD превращаются в период по заезду или выезду', () => {
    expect(readFilters({ arrival: 'today' }, TODAY)).toMatchObject({
      date: 'arrival',
      from: TODAY,
      to: TODAY,
    });
    expect(readFilters({ departure: '2026-09-30' }, TODAY)).toMatchObject({
      date: 'departure',
      from: '2026-09-30',
      to: '2026-09-30',
    });
    // явный период важнее сахара
    expect(
      readFilters({ arrival: 'today', from: '2026-10-01', to: '2026-10-02' }, TODAY),
    ).toMatchObject({ from: '2026-10-01', to: '2026-10-02', date: 'stay' });
  });

  it('прежняя ссылка Главной «Все брони дня» ?date=YYYY-MM-DD — это день, а не «к чему относится дата»', () => {
    expect(readFilters({ date: '2026-09-30' }, TODAY)).toMatchObject({
      from: '2026-09-30',
      to: '2026-09-30',
      date: 'stay',
    });
    expect(needsCleanup({ date: '2026-09-30' })).toBe(false);
  });

  it('view=today держит период на дне объекта, что бы ни пришло в from/to', () => {
    expect(
      readFilters({ view: 'today', from: '2026-01-01', to: '2026-01-31' }, TODAY),
    ).toMatchObject({
      view: 'today',
      from: TODAY,
      to: TODAY,
    });
  });

  it('в API уходят только заданные условия', () => {
    const f = readFilters(
      { view: 'attention', payment: 'due', source: 'booking', sort: 'debt' },
      TODAY,
    );
    expect(apiQuery(f)).toEqual({
      from: TODAY,
      to: TODAY,
      status: 'ALL',
      q: '',
      page: '1',
      view: 'attention',
      payment: 'due',
      source: 'booking',
      sort: 'debt',
    });
  });

  it('ссылка сохраняет отбор, пустое и умолчания не пишет, страницу сбрасывает по требованию', () => {
    const f = readFilters(
      { view: 'today', payment: 'due', source: 'booking', sort: 'arrival', page: '3' },
      TODAY,
    );
    expect(filtersHref(f, { page: '1' })).toBe(
      `/reservations?from=${TODAY}&to=${TODAY}&view=today&source=booking&payment=due&sort=arrival&page=1`,
    );
    expect(filtersHref(f, { view: 'all', page: '1' })).not.toContain('view=');
  });

  it('пустые поля формы и умолчания — повод вычистить адрес', () => {
    expect(needsCleanup({ from: TODAY, to: TODAY, status: 'CONFIRMED', q: 'Иванов' })).toBe(false);
    expect(needsCleanup({ from: TODAY, to: TODAY, status: 'ALL', q: '' })).toBe(true);
    expect(needsCleanup({ arrival: 'today' })).toBe(false);
    expect(needsCleanup({ payment: '', view: 'today' })).toBe(true);
    expect(needsCleanup({ view: 'all' })).toBe(true);
    expect(needsCleanup({ date: 'stay' })).toBe(true);
    expect(
      cleanHref({
        from: TODAY,
        to: TODAY,
        status: 'ALL',
        q: '',
        view: 'today',
        payment: '',
        date: 'stay',
      }),
    ).toBe(`/reservations?from=${TODAY}&to=${TODAY}&view=today`);
  });

  it('источник называется словами: канал — как в списке каналов, прямой — как на стойке', () => {
    expect(sourceLabel('booking')).toBe('Booking.com');
    expect(sourceLabel('WEBSITE')).toBe('Сайт');
    expect(sourceLabel('ota')).toBe('Канал продаж');
    expect(sourceLabel('Неизвестный')).toBe('Неизвестный');
  });
});
