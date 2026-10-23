import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    createElement('a', { href, ...rest }, children as never),
}));
import { DayLine } from './day-line';

const props = {
  today: '2026-10-22',
  counts: { arrivals: 2, departures: 1, inHouse: 3 },
  occupancy: 60,
  occupied: 3,
  units: 5,
  free: 2,
  attention: 4,
  availabilityHref: '/rooms/availability?arrival=2026-10-22',
};

const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('сводка дня шахматки одной строкой (аудит 22.10.2026 P1-2)', () => {
  it('без плиток: одна строка, слова через запятую, без «·» и скобок', () => {
    const html = renderToStaticMarkup(createElement(DayLine, props));
    expect(html).not.toContain('stat');
    expect(html).not.toContain('board-kpis');
    expect(html).toContain('aria-label="Сегодня на объекте"');
    expect(text(html)).toBe(
      'Занято 3 из 5, 60%, свободно 2, заезд 2, выезд 1, проживают 3, требует внимания 4',
    );
    expect(text(html)).not.toMatch(/[·()]/);
  });

  it('числа сохраняют testid прежних плиток и ведут к своим спискам', () => {
    const html = renderToStaticMarkup(createElement(DayLine, props));
    for (const id of [
      'day-occupied',
      'day-occupancy',
      'day-free',
      'day-arrivals',
      'day-departures',
      'day-in-house',
      'day-attention',
    ])
      expect(html).toContain(`data-testid="${id}"`);
    expect(html).toContain('href="/reservations?from=2026-10-22&amp;to=2026-10-22&amp;date=arrival"');
    expect(html).toContain('href="/chessboard?stays=debt"');
    expect(html).toContain('href="/rooms/availability?arrival=2026-10-22"');
  });

  it('нет данных о фонде: прочерк вместо чисел, без «из»', () => {
    const html = renderToStaticMarkup(
      createElement(DayLine, { ...props, occupancy: null, occupied: null, units: null, free: null }),
    );
    expect(text(html)).toMatch(/^Занято –, свободно –,/);
  });
});
