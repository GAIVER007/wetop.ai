import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DateRangePopover, presetRange } from './date-range-popover';

describe('DateRangePopover', () => {
  it('считает пресеты от переданного дня объекта, включая високосный месяц', () => {
    expect(presetRange('today', '2028-02-28')).toEqual({ from: '2028-02-28', to: '2028-02-28' });
    expect(presetRange('7', '2028-02-28')).toEqual({ from: '2028-02-28', to: '2028-03-05' });
    expect(presetRange('14', '2028-02-28')).toEqual({ from: '2028-02-28', to: '2028-03-12' });
    expect(presetRange('30', '2028-02-28')).toEqual({ from: '2028-02-28', to: '2028-03-28' });
    expect(presetRange('month', '2028-02-28')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(presetRange('custom', '2028-02-28')).toBeNull();
  });

  it('содержит один управляющий элемент, шесть пресетов, календарь и форму с применением', () => {
    const markup = renderToStaticMarkup(
      createElement(DateRangePopover, {
        from: '2026-10-10',
        to: '2026-10-24',
        today: '2026-10-11',
        maxDays: 60,
      }),
    );
    expect(markup).toContain('aria-label="Выбрать период"');
    expect(markup.match(/class="date-range__preset"/g)).toHaveLength(6);
    expect(markup).toContain('aria-label="Календарь периода"');
    expect(markup).toContain('name="from"');
    expect(markup).toContain('name="to"');
    expect(markup).toContain('Применить');
    expect(markup).toContain('10 октября 2026');
    expect(markup).toContain('24 октября 2026');
  });
});
