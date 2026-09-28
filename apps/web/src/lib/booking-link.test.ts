import { describe, expect, it } from 'vitest';
import { AUTO_UNIT, bookingHref, bookingPrefill } from './booking-link';

// ТЗ «Свободные места» AV3 (ADR-110): форма брони открывается с тем, что уже выбрано на экране поиска
const unitCategory = (code: string) => (code.startsWith('R') ? 'ROOM' : 'MALE');

describe('ссылка в форму брони', () => {
  it('номер автоматически: все гости в одном месте, ячейку назначит система', () => {
    const href = bookingHref({
      arrival: '2026-10-01',
      departure: '2026-10-04',
      category: 'ROOM',
      rate: 'BASE',
      adults: 2,
      auto: 1,
    });
    expect(href).toBe(
      '/reservations/new?arrival=2026-10-01&departure=2026-10-04&category=ROOM&rate=BASE&adults=2&auto=1',
    );
    const q = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(bookingPrefill(q, unitCategory)).toEqual([
      { category: 'ROOM', rate: 'BASE', adults: 2, quantity: 1, unit: AUTO_UNIT },
    ]);
  });

  it('койки: выбранные места по одной на гостя, остальные — групповой бронью', () => {
    const href = bookingHref({
      arrival: '2026-10-01',
      departure: '2026-10-04',
      category: 'MALE',
      rate: 'BASE',
      adults: 1,
      units: ['M05'],
      auto: 2,
    });
    expect(href).toContain('unit=M05');
    const params = new URL(href, 'http://x').searchParams;
    const q = { ...Object.fromEntries(params), unit: params.getAll('unit') };
    expect(bookingPrefill(q, unitCategory)).toEqual([
      { category: 'MALE', rate: 'BASE', adults: 1, quantity: 1, unit: 'M05' },
      { category: 'MALE', rate: 'BASE', adults: 1, quantity: 2, unit: '' },
    ]);
  });

  it('несколько выбранных коек — по размещению на каждую, без повторов', () => {
    expect(
      bookingPrefill({ category: 'MALE', adults: '1', unit: ['M05', 'M06', 'M05'] }, unitCategory),
    ).toEqual([
      { category: 'MALE', rate: '', adults: 1, quantity: 1, unit: 'M05' },
      { category: 'MALE', rate: '', adults: 1, quantity: 1, unit: 'M06' },
    ]);
  });

  it('старая ссылка шахматки ?unit= — категория по ячейке, один гость', () => {
    expect(bookingPrefill({ unit: 'R03' }, unitCategory)).toEqual([
      { category: 'ROOM', rate: '', adults: 1, quantity: 1, unit: 'R03' },
    ]);
  });

  it('без параметров — пустая форма; мусор в числах не проходит', () => {
    expect(bookingPrefill({}, unitCategory)).toEqual([]);
    expect(bookingPrefill({ category: 'ROOM', adults: '-3', auto: '1e9' }, unitCategory)).toEqual([
      { category: 'ROOM', rate: '', adults: 1, quantity: 1, unit: '' },
    ]);
    // «auto» без категории ничего не значит
    expect(bookingPrefill({ auto: '2' }, unitCategory)).toEqual([]);
  });
});
