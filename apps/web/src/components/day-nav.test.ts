import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DayNav } from './day-nav';

const labels = (markup: string) =>
  [...markup.matchAll(/class="date-range__preset"[^>]*>([^<]+)</g)].map((m) => m[1]);

describe('DayNav: быстрые дни журнала во всех направлениях (владелец 25.10.2026)', () => {
  it('по умолчанию «Сегодня» и «Вчера», без «Завтра»', () => {
    const markup = renderToStaticMarkup(createElement(DayNav, { date: '2026-10-24', today: '2026-10-25', onGo() {} }));
    expect(labels(markup)).toEqual(['Сегодня', 'Вчера']);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Вчера</);
  });
  it('экран с неделей и месяцем добавляет «Эта неделя» и «Этот месяц» в этом порядке', () => {
    const markup = renderToStaticMarkup(
      createElement(DayNav, { date: '2026-10-25', today: '2026-10-25', onGo() {}, onWeek() {}, onMonth() {} }),
    );
    expect(labels(markup)).toEqual(['Сегодня', 'Вчера', 'Эта неделя', 'Этот месяц']);
  });
});
