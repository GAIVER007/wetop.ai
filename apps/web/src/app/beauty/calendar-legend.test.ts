import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusChips, toggleStatus } from './calendar-legend';

/**
 * ТЗ 25.10.2026, п. 11 (владелец: «не понятно что кнопка фильтр делает, не по теме»): легенда статусов стала
 * чипами-отборами. Нажатие ставит тот же отбор `status`, что «Все статусы»; второе нажатие снимает.
 */
describe('чипы статусов салона: отбор по статусу', () => {
  it('нажатие выбирает статус, повторное снимает, другой статус заменяет', () => {
    expect(toggleStatus('', 'BOOKED')).toBe('BOOKED');
    expect(toggleStatus('BOOKED', 'BOOKED')).toBe('');
    expect(toggleStatus('BOOKED', 'DONE')).toBe('DONE');
  });

  it('чипы: кнопки с aria-pressed, выбранный отмечен', () => {
    const html = renderToStaticMarkup(createElement(StatusChips, { value: 'BOOKED', onChange: () => undefined }));
    expect(html).toContain('role="group"');
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>.*Записан/);
    expect(html.match(/aria-pressed="false"/g)?.length).toBeGreaterThan(2);
    expect(html).not.toContain('CANCELLED');
  });

  it('в журнале нет служебного текста про пустые клетки, «Компактный вид» значком', () => {
    const web = join(__dirname, '..', '..');
    const journal = readFileSync(join(web, 'app/beauty/journal.tsx'), 'utf8');
    expect(journal).not.toContain('Свободно: пустая клетка');
    expect(journal).toMatch(/aria-label=\{t\('Компактный вид'\)\}/);
    expect(readFileSync(join(web, 'app/beauty/month-calendar.tsx'), 'utf8')).toContain('<StatusChips');
    expect(journal).toContain('<StatusChips');
  });
  it('на телефоне значка «Компактный вид» нет: он внутри части только для компьютера (шапка телефона не растёт)', () => {
    const journal = readFileSync(new URL('./journal.tsx', import.meta.url), 'utf8');
    const desk = journal.indexOf('<span className="journal-head__desk-only">');
    const button = journal.indexOf('className="icon-button journal-compact"');
    expect(desk).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(desk);
    expect(journal.indexOf('</span>', desk)).toBeGreaterThan(button);
  });
});
