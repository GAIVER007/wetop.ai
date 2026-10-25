import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(`apps/web/src/app/${path}`, 'utf8');
describe('approved TZ12 presentation compatibility port', () => {
  it('keeps restaurant Hours mobile grid scoped away from booking duration rows', () => {
    const text = source('food/settings-board.tsx');
    expect(text).toContain('rest-hours--editable');
    expect(text).toContain('className="rest-hours__from"');
    expect(text).toContain('className="rest-hours__to"');
    expect(text).toContain(`<span aria-hidden="true">{t('До')}</span>`); // KK3: подпись через перевод
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
    expect(text).toContain('const segments = appointmentSegments(day.appointments);');
    expect(text).toContain('const occupied = segments.some(');
  });
  it('provides period list search, callable contact and an explicit record action', () => {
    const text = source('appointments/list.tsx');
    expect(text).toContain('className="beauty-period-filter"');
    // подсказка теперь в самом поле поиска (аудит 21.10.2026 п.19)
    expect(text).toContain("placeholder={t('Имя или телефон')}"); // KK2: текст через перевод
    expect(text).toContain('tel:${r.customer.phone}');
    expect(text).toContain("t('Открыть запись')");
  });
  it('groups the shared editor and keeps its scoped save footer reachable', () => {
    const text = source('beauty/appointment-form.tsx');
    // Группа «Услуга и время» (341554556, решение 19.10): название группы сверяется с tests/beauty-ui/tz12-ui.spec.ts
    for (const name of ['Клиент', 'Услуга и время', 'Дополнительно']) expect(text).toContain(`<legend>{t('${name}')}</legend>`);
    expect(text).toContain('aria-live="polite"');
    expect(text).toContain("<span className=\"beauty-selection-line\">{t('Дата: {date}', { date })}</span>");
    // пояс называется словами (zoneLabel), а не кодом IANA: обход живого сайта 21.10.2026
    expect(text).toMatch(/<span className="beauty-selection-line">\s*\{t\('Время: \{time\} \(\{zone\}\)', \{ time: hour, zone: zoneLabel\(day\.location\.timezone, t\) \}\)\}\s*<\/span>/);
    // подвал с итогом и «Записать» с 23.10.2026 общий у окна брони всех направлений (`BookingShell`)
    expect(text).toContain('<BookingShell');
    expect(text).toContain('appointment-form__total');
    expect(source('beauty/beauty.css')).toContain('.appointment-editor > .overlay-content');
  });
  it('emphasizes customer identity and makes phone callable without removing metrics', () => {
    const text = source('customers/beauty-table.tsx');
    expect(text).toContain('tel:${row.phone}');
    expect(text).toMatch(/<strong>\s*<Link href=\{`\/customers\/\$\{encodeURIComponent\(row.id\)\}`\}>\s*\{\[row.firstName, row.lastName\]/);
    expect(text).toContain("data-label={t('Средний чек')}");
    expect(text).toContain("data-label={t('Последний визит')}");
  });
  it('shows the effective branch price and duration in the price list row (variant B, 25.10.2026)', () => {
    const text = source('beauty/services/board.tsx');
    expect(text).toContain('data-service-list="price"');
    expect(text).toContain('row.effective.durationMinutes');
    expect(text).toContain('shownPriceMinor(row)');
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
  const toolbar = [...source('beauty/beauty.css').matchAll(/\.beauty-page \.beauty-calendar-toolbar \{([^}]+)\}/g)]
    .map((match) => match[1] ?? '')
    .find((body) => body.includes('grid-template-columns: minmax(0, 1fr) auto;'));
  expect(toolbar).toBeDefined();
  expect(toolbar!).toContain('grid-template-columns: minmax(0, 1fr) auto;');
  // The earlier B05 mobile rule already applies 8px on all sides. Repeating it is a no-op.
  expect(toolbar!).toContain('padding: 0 var(--space-2);');
  expect(toolbar!).not.toMatch(/(?:min-height|font-size|display|visibility|overflow)\s*:/);
});
