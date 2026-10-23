import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    createElement('a', { href, ...rest }, children as never),
}));
import { GuestsSummary } from './guests-summary';

const kpi = {
  all: 9,
  inhouse: 4,
  arrivalsToday: 3,
  departuresToday: 2,
  expected: 4,
  attention: 3,
  none: 0,
  arrivalsYesterday: 1,
  departuresYesterday: 2,
};
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('«Гости»: итоги одной строкой вместо шести плиток (аудит 22.10.2026 P1-16)', () => {
  it('целые подписи без обрезки и без «к вчерашнему дню», testid прежние', () => {
    const html = renderToStaticMarkup(createElement(GuestsSummary, { kpi, href: (v: string) => `/guests?view=${v}` }));
    expect(html).not.toContain('stat');
    expect(text(html)).toBe(
      'Проживают 4, заезды сегодня 3, выезды сегодня 2, ожидают заезд 4, требуют внимания 3, без активного проживания 0 из 9',
    );
    for (const id of ['kpi-inhouse', 'kpi-arrivals', 'kpi-departures', 'kpi-expected', 'kpi-attention', 'kpi-none'])
      expect(html).toContain(`data-testid="${id}"`);
    expect(html).toContain('data-testid="guests-kpis"');
    expect(html).toContain('href="/guests?view=inhouse"');
  });
});
