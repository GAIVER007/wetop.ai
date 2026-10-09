import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

/*
 * Плоские поверхности стойки (DESIGN.md §20.3). До MV8.5 DS0b их держал отдельный `glass.css`,
 * последним файлом поверх всего; с DS0b каждое правило живёт у своего владельца, а файла больше нет.
 * Сторож следит, чтобы стекло не вернулось ни файлом, ни свойствами на блоках страницы.
 */
const root = resolve(import.meta.dirname, '../..');
const src = resolve(root, 'apps/web/src');
const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
  });
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const all = cssFiles(src).map((f) => ({ f, css: strip(readFileSync(f, 'utf8')) }));

const documented = (() => {
  const design = readFileSync(resolve(root, 'DESIGN.md'), 'utf8');
  const list = /## 20\.3[\s\S]*?```\n([\s\S]*?)```/.exec(design)?.[1];
  expect(list).toBeTruthy();
  return [...list!.matchAll(/\.[a-z0-9_-]+/g)].map((m) => m[0]);
})();

/*
 * Полупрозрачная заливка, которую до DS0b файл раздела ставил поверх glass.css порядком загрузки
 * (файл страницы грузится после файлов макета). DS0b внешний вид не меняет, поэтому список закреплён
 * как есть и только сокращается: перевод этих блоков на `--surface-solid` (кандидат DS1).
 */
const GLASS_PANEL_DS1 = new Set([
  '.booking-footer',
  '.booking-head',
  '.finance-block',
  '.incident',
  '.incident-history',
  '.inventory-summary',
  '.inventory-card',
  '.onboarding__section',
  '.reservations-controls',
]);

/** тела правил, в списке селекторов которых есть ровно этот класс */
const bodiesOf = (cls: string) =>
  all.flatMap(({ css }) =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1]!.split(',').some((s) => s.trim() === cls))
      .map((m) => m[2]!),
  );

it('glass.css снят: поверхности у своих владельцев, света за стеклом нет', () => {
  expect(existsSync(resolve(src, 'app/glass.css'))).toBe(false);
  for (const { f, css } of all) expect(css, f).not.toMatch(/body::(?:before|after)/);
});

it('блоки страницы из §20.3 плоские: без градиента, белой кромки и размытия', () => {
  for (const cls of documented) {
    const bodies = bodiesOf(cls);
    expect(bodies.length, `${cls}: правила нет ни в одном CSS стойки`).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(b, cls).not.toMatch(/(?:radial|linear)-gradient\(/);
      expect(b, cls).not.toMatch(/inset\s+0\s+1px/);
      expect(b, cls).not.toMatch(/backdrop-filter:\s*blur/);
      if (!GLASS_PANEL_DS1.has(cls)) expect(b, cls).not.toMatch(/var\(--glass-panel\)/);
    }
  }
});

it('список исключений --glass-panel только сокращается', () => {
  for (const cls of GLASS_PANEL_DS1)
    expect(
      bodiesOf(cls).some((b) => b.includes('var(--glass-panel)')),
      `${cls} уже без --glass-panel: уберите из GLASS_PANEL_DS1`,
    ).toBe(true);
});

it('сетка шахматки и таблица остаются непрозрачными', () => {
  const board = all.find(({ f }) => f.endsWith('chessboard/board.css'))!.css;
  expect(board).toMatch(/\.board,\s*\.board thead th\s*\{[^}]*var\(--surface-solid\)/);
  // липкая колонка номеров: непрозрачная заливка, строки уезжают под неё
  expect(bodiesOf('.board td.board__unit').join('\n')).toMatch(/background:\s*var\(--surface\)/);
  expect(bodiesOf('.tbl').join('\n')).toContain('var(--surface-solid)');
  expect(bodiesOf('.tbl thead th').join('\n')).toContain('var(--surface-solid)');
});
