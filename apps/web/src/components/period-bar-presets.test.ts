import { describe, expect, it } from 'vitest';
import { reportPresets } from './period-bar-presets';

describe('reportPresets', () => {
  const href = (from: string, to: string) => `/r?from=${from}&to=${to}`;
  it('gives today, yesterday, 7 and 30 days ending today, with the matching one selected', () => {
    const list = reportPresets('2026-10-21', '2026-10-15', '2026-10-21', href);
    expect(list.map((p) => [p.label, p.href, p.selected])).toEqual([
      ['Сегодня', '/r?from=2026-10-21&to=2026-10-21', false],
      ['Вчера', '/r?from=2026-10-20&to=2026-10-20', false],
      ['7 дней', '/r?from=2026-10-15&to=2026-10-21', true],
      ['30 дней', '/r?from=2026-09-22&to=2026-10-21', false],
    ]);
  });
  it('crosses month and year borders', () => {
    const list = reportPresets('2027-01-02', '2027-01-02', '2027-01-02', href);
    expect(list[1]?.href).toBe('/r?from=2027-01-01&to=2027-01-01');
    expect(list[2]?.href).toBe('/r?from=2026-12-27&to=2027-01-02');
  });
});
