import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** «Все бизнесы» в один экран 1440×900 (аудит кабинета 31.10.2026): графики валют рядом, а не друг под другом */
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./owner.css', import.meta.url), 'utf8');

describe('«Все бизнесы» в один экран', () => {
  it('графики валют в общей сетке owner__charts', () => {
    expect(page).toContain('className="owner__charts"');
  });
  it('сетка графиков: колонки по числу валют, на телефоне одна', () => {
    const rule = css.slice(css.indexOf('.owner__charts {'), css.indexOf('}', css.indexOf('.owner__charts {')));
    expect(rule).toContain('grid-template-columns: repeat(auto-fit');
    expect(css).toMatch(/@media \(max-width: 600px\) \{[^}]*\.owner__charts \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  });
});
