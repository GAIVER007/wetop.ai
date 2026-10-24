import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DateInput, calendarButtonLabel } from './date-field';

/**
 * Две кнопки «Открыть календарь» подряд у полей «С» и «По» (аналитика ресторана и салона, аудит 22.10.2026,
 * P2-6): программа чтения не различала их. Имя кнопки теперь несёт имя своего поля.
 */
describe('кнопка календаря у поля даты', () => {
  it('описание кнопки называет поле, имя остаётся «Открыть календарь»', () => {
    expect(calendarButtonLabel('Период: с')).toBe('для поля «Период: с»');
    expect(calendarButtonLabel('')).toBeUndefined();
    expect(calendarButtonLabel(undefined)).toBeUndefined();
  });
  it('поля «с» и «по» дают кнопкам разные имена уже в разметке сервера', () => {
    const markup = renderToStaticMarkup(
      h('form', null, [
        h(DateInput, { key: 'f', name: 'from', defaultValue: '2026-10-01', 'aria-label': 'Период: с' }),
        h(DateInput, { key: 't', name: 'to', defaultValue: '2026-10-07', 'aria-label': 'Период: по' }),
      ]),
    );
    // имя поля только в описании: в имени кнопки оно совпадало с подписью поля, и поиск поля по подписи
    // находил два элемента (getByLabel('Период: с') в UI-проверках, 22.10.2026)
    expect(markup).not.toContain('aria-label="Открыть календарь (');
    expect(markup).toContain('aria-description="для поля «Период: с»"');
    expect(markup).toContain('aria-description="для поля «Период: по»"');
  });
});
