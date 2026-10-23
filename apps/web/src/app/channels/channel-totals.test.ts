import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChannelTotals } from './channel-totals';

describe('«Брони по источникам»: итоги строкой вместо четырёх плиток (аудит 22.10.2026)', () => {
  it('одна строка, testid прежние, суммы по валютам', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelTotals, {
        count: 48,
        cancelled: 3,
        noShow: 1,
        money: new Map([['KZT', 5_000_000n]]),
      }),
    );
    expect(html).not.toContain('stat');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Бронирований 48, отмен 3, незаездов 1, стоимость броней 50 000 ₸');
    expect(html).toContain('data-testid="channel-bookings"');
    expect(html).toContain('data-testid="channel-amount"');
  });
  it('без сумм прочерк', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelTotals, { count: 0, cancelled: 0, noShow: 0, money: new Map() }),
    );
    expect(html.replace(/<[^>]+>/g, '')).toBe('Бронирований 0, отмен 0, незаездов 0, стоимость броней —');
  });
});
