import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES, scan, type Counts } from './design-slop-rules';

/** Правила и обход файлов: `design-slop-rules.ts`. Здесь только храповик против снимка. */
const BASELINE = resolve(import.meta.dirname, 'design-slop.baseline.json');

describe('design: сторож ИИ-слопа (DESIGN.md §15)', () => {
  const actual = scan();

  if (process.env.DESIGN_SLOP_UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(actual, null, 2)}\n`);
  }
  const baseline: Counts = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

  for (const r of RULES) {
    it(`${r.id}: ${r.why}`, () => {
      const got = actual[r.id] ?? {};
      const was = baseline[r.id] ?? {};
      const worse = Object.entries(got)
        .filter(([f, n]) => n > (was[f] ?? 0))
        .map(([f, n]) => `${f}: ${was[f] ?? 0} → ${n}`);
      const better = Object.entries(was)
        .filter(([f, n]) => (got[f] ?? 0) < n)
        .map(([f, n]) => `${f}: ${n} → ${got[f] ?? 0}`);
      expect(
        worse,
        `новые нарушения — исправьте или объясните в reports/design-audit-*.md`,
      ).toEqual([]);
      expect(better, `нарушений стало меньше — обновите снимок: DESIGN_SLOP_UPDATE=1`).toEqual([]);
    });
  }

  it('снимок покрывает все правила', () => {
    expect(Object.keys(baseline).sort()).toEqual(RULES.map((r) => r.id).sort());
  });
});
