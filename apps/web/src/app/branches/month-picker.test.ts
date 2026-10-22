import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MonthPicker, monthLabel, shiftMonth } from './month-picker';

/**
 * Месяц отчёта «Организации» (аудит 22.10.2026, P1-1b): родное поле `type=month` показывало «October 2026»
 * на языке браузера. Теперь стрелки и подпись по-русски: «‹ октябрь 2026 ›», адрес тот же (`?month=`).
 */
describe('MonthPicker', () => {
  it('подпись месяца по-русски, со строчной, без ISO', () => {
    expect(monthLabel('2026-10')).toBe('октябрь 2026');
    expect(monthLabel('2027-01')).toBe('январь 2027');
  });
  it('сдвиг через границу года', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('стрелки ведут на соседние месяцы тем же параметром, родного поля месяца нет', () => {
    const markup = renderToStaticMarkup(h(MonthPicker, { month: '2026-10' }));
    expect(markup).toContain('href="/branches?month=2026-09"');
    expect(markup).toContain('href="/branches?month=2026-11"');
    expect(markup).toContain('октябрь 2026');
    expect(markup).not.toContain('type="month"');
    expect(markup).not.toMatch(/October|2026-10</);
    expect(markup).toContain('aria-label="Предыдущий месяц: сентябрь 2026"');
    expect(markup).toContain('aria-label="Следующий месяц: ноябрь 2026"');
  });
});
