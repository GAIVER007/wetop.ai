import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DateInput, calendarButtonLabel } from './date-field';

/**
 * Две кнопки «Открыть календарь» подряд у полей «С» и «По» (аналитика ресторана и салона, аудит 22.10.2026,
 * P2-6): программа чтения не различала их. Имя кнопки теперь несёт имя своего поля.
 */
describe('кнопка календаря у поля даты', () => {
  it('имя кнопки называет поле', () => {
    expect(calendarButtonLabel('Период: с')).toBe('Открыть календарь (Период: с)');
    expect(calendarButtonLabel('')).toBe('Открыть календарь');
    expect(calendarButtonLabel(undefined)).toBe('Открыть календарь');
  });
  it('поля «с» и «по» дают кнопкам разные имена уже в разметке сервера', () => {
    const markup = renderToStaticMarkup(
      h('form', null, [
        h(DateInput, { key: 'f', name: 'from', defaultValue: '2026-10-01', 'aria-label': 'Период: с' }),
        h(DateInput, { key: 't', name: 'to', defaultValue: '2026-10-07', 'aria-label': 'Период: по' }),
      ]),
    );
    expect(markup).toContain('aria-label="Открыть календарь (Период: с)"');
    expect(markup).toContain('aria-label="Открыть календарь (Период: по)"');
  });
});
