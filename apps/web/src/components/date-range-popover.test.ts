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

  it('«Вчера» и «Эта неделя» (с понедельника по воскресенье) считаются от дня объекта (владелец 25.10.2026)', () => {
    expect(presetRange('yesterday', '2026-10-25')).toEqual({ from: '2026-10-24', to: '2026-10-24' });
    expect(presetRange('yesterday', '2028-03-01')).toEqual({ from: '2028-02-29', to: '2028-02-29' });
    expect(presetRange('week', '2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(presetRange('week', '2026-10-19')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('окно периода начинается с «Сегодня, Вчера, Эта неделя, Этот месяц»', () => {
    const markup = renderToStaticMarkup(
      createElement(DateRangePopover, { from: '2026-10-19', to: '2026-10-25', today: '2026-10-25' }),
    );
    const labels = [...markup.matchAll(/class="date-range__preset"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(labels.slice(0, 4)).toEqual(['Сегодня', 'Вчера', 'Эта неделя', 'Этот месяц']);
    expect(labels).not.toContain('Текущий месяц');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Эта неделя</);
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
    expect(markup.match(/class="date-range__preset"/g)).toHaveLength(8);
    expect(markup).toContain('aria-label="Календарь периода"');
    expect(markup).toContain('name="from"');
    expect(markup).toContain('name="to"');
    expect(markup).toContain('Применить');
    expect(markup).toContain('10 октября 2026');
    expect(markup).toContain('24 октября 2026');
  });

  it('шахматка (compact): подпись «12–18 октября 2026», на телефоне «12–18 окт.», в окне «Отмена» и «Применить»', () => {
    const markup = renderToStaticMarkup(
      createElement(DateRangePopover, {
        from: '2026-10-12',
        to: '2026-10-18',
        today: '2026-10-13',
        maxDays: 92,
        compact: true,
      }),
    );
    expect(markup).toContain('12–18 октября 2026');
    expect(markup).toContain('12–18 окт.');
    expect(markup).not.toContain('date-range__label-full');
    expect(markup).toContain('Выбрано: 12–18 октября 2026 (7 дн.)');
    expect(markup).toContain('Отмена');
    const may = renderToStaticMarkup(
      createElement(DateRangePopover, { from: '2026-05-04', to: '2026-05-10', today: '2026-05-04', compact: true }),
    );
    expect(may).toContain('4–10 мая<');
  });
});
