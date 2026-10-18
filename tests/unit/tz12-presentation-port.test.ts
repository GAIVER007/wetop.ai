import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(`apps/web/src/app/${path}`, 'utf8');
describe('approved TZ12 presentation compatibility port', () => {
  it('keeps restaurant Hours mobile grid scoped away from booking duration rows', () => {
    const text = source('food/settings-board.tsx');
    expect(text).toContain('rest-hours--editable');
    expect(text).toContain('className="rest-hours__from"');
    expect(text).toContain('className="rest-hours__to"');
    expect(text).toContain('<span aria-hidden="true">До</span>');
    const css = source('food/restaurant.css');
    expect(css).toContain("grid-template-areas: 'day toggle' 'from to'");
    expect(css).toContain('.rest-hours--editable li');
  });
  it('explains anonymized occupied slots and offers collapsible filters', () => {
    const text = source('beauty/journal.tsx');
    expect(text).toContain('<Help');
    expect(text).toContain('Занято, скрыто фильтром');
    expect(text).toContain('beauty-active-filters');
    expect(text).toContain('beauty-slot-state');
    expect(text).toContain('const occupied = day.appointments.some(');
  });
  it('provides day-only list search, callable contact and an explicit record action', () => {
    const text = source('appointments/list.tsx');
    expect(text).toContain('Поиск только по выбранному дню.');
    expect(text).toContain('tel:${r.customer.phone}');
    expect(text).toContain('Открыть запись');
  });
  it('groups the shared editor and keeps its scoped save footer reachable', () => {
    const text = source('beauty/appointment-form.tsx');
    for (const name of ['Клиент', 'Услуга и время', 'Дополнительно']) expect(text).toContain(`<legend>${name}</legend>`);
    expect(text).toContain('aria-live="polite"');
    expect(text).toContain('<span className="beauty-selection-line">Дата: {date}</span>');
    expect(text).toContain('<span className="beauty-selection-line">Время: {hour} ({day.location.timezone})</span>');
    expect(text).toContain('appointment-form__footer');
    expect(source('beauty/beauty.css')).toContain('.appointment-editor > .overlay-content');
  });
  it('emphasizes customer identity and makes phone callable without removing metrics', () => {
    const text = source('customers/beauty-table.tsx');
    expect(text).toContain('tel:${row.phone}');
    expect(text).toContain('<strong>{[row.firstName, row.lastName]');
    expect(text).toContain('data-label="Средний чек"');
    expect(text).toContain('data-label="Последний визит"');
  });
  it('puts effective branch service information before subordinate catalog details', () => {
    const text = source('beauty/services/board.tsx');
    expect(text).toContain('beauty-services-table');
    expect(text).toContain('<th>Каталог</th>');
    expect(text.indexOf('<th>В этом филиале</th>')).toBeLessThan(text.indexOf('<th>Каталог</th>'));
    expect(text).toContain('row.effective.durationMinutes');
  });
});

it('keeps the approved Q-DES-4 narrow-phone row wrap below 360 rather than all phones', () => {
  const css = source('beauty/beauty.css');
  const rule = css.match(/@media \(max-width: (\d+)px\) \{[^\n]*\n\s*\.beauty-calendar-actions \.date-bar,\n\s*\.beauty-operational-toolbar \.date-bar \{\n\s*grid-template-columns: 44px minmax\(0, 1fr\) 44px;/);
  expect(rule?.[1]).toBe('360');
  expect(rule?.[0]).toContain('slop-allow: breakpoint-literal Q-DES-4');
  expect(readFileSync('DESIGN.md', 'utf8')).toContain('`max-width: 360px` остаётся технической точкой');
});

it('keeps the mobile calendar toolbar gutter compact without shrinking or hiding controls', () => {
  const mobile = source('beauty/beauty.css').split('@media (max-width: 600px) {').at(-1);
  const toolbar = mobile?.match(/\.beauty-page \.beauty-calendar-toolbar \{([^}]+)\}/)?.[1];
  expect(toolbar).toContain('grid-template-columns: minmax(0, 1fr) auto;');
  // The earlier B05 mobile rule already applies 8px on all sides. Repeating it is a no-op.
  expect(toolbar).toContain('padding: 0 var(--space-2);');
  expect(toolbar).not.toMatch(/(?:min-height|font-size|display|visibility|overflow)\s*:/);
});
