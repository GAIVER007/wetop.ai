import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож стеклянного слоя стойки (DESIGN.md §20, ADR-069).
 *
 * Стекло в стойке — закрытый список блоков, и он записан дважды: словами в DESIGN.md §20.3 и кодом
 * в `apps/web/src/app/glass.css` (два правила: размытие и кромка). Списки расходятся молча —
 * панель получает тень без размытия или наоборот, — поэтому тест держит их равными.
 *
 * Он же следит за тем, что рабочие поверхности остались непрозрачными: сетка шахматки и тело
 * таблицы обязаны брать `--surface-solid` (§20.3), иначе строки просвечивают друг сквозь друга.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const GLASS = resolve(ROOT, 'apps/web/src/app/glass.css');
const DESIGN = resolve(ROOT, 'DESIGN.md');

const glass = readFileSync(GLASS, 'utf8');
const design = readFileSync(DESIGN, 'utf8');

/** Классы из блока правил, который начинается после `marker`. */
function selectorsAfter(css: string, marker: string): string[] {
  const start = css.indexOf(marker);
  expect(start, `в glass.css нет правила ${marker}`).toBeGreaterThan(-1);
  const body = css.slice(start + marker.length);
  const head = body.slice(0, body.indexOf('{'));
  return [...head.matchAll(/\.[a-z0-9_-]+/g)].map((m) => m[0]).sort();
}

describe('стеклянный слой стойки — DESIGN.md §20', () => {
  /** Список §20.3 записан блоком кода после слов «Стекло». */
  const documented = (() => {
    const section = /## 20\.3[\s\S]*?```\n([\s\S]*?)```/.exec(design);
    expect(section, 'в DESIGN.md нет списка блоков §20.3').not.toBeNull();
    return [...(section?.[1] ?? '').matchAll(/\.[a-z0-9_-]+/g)].map((m) => m[0]).sort();
  })();

  it('список §20.3 и размытие в glass.css совпадают', () => {
    // правило размытия стоит внутри @supports сразу после него
    const blurred = selectorsAfter(glass, 'backdrop-filter: blur(1px)) {');
    expect(blurred, 'размытие получают не те блоки, что названы в §20.3').toEqual(documented);
  });

  it('кромку получают те же блоки, кроме тех, у кого её нет по смыслу', () => {
    const edged = selectorsAfter(glass, 'Кромка и тень стекла.');
    const extra = edged.filter((s) => !documented.includes(s));
    expect(extra, 'кромка у блока, которого нет в §20.3').toEqual([]);
  });

  it('сетка шахматки и тело таблицы остаются непрозрачными', () => {
    const solid = /\.board,[\s\S]*?\{([\s\S]*?)\}/.exec(glass)?.[1] ?? '';
    expect(solid, 'рабочая поверхность потеряла непрозрачную подложку').toContain(
      'var(--surface-solid)',
    );
    for (const selector of ['.board', '.board thead th', '.tbl', '.tbl thead th']) {
      expect(glass, `${selector} должен стоять в правиле непрозрачных поверхностей`).toContain(
        selector,
      );
    }
  });

  it('градиент стоит только у главной кнопки и знака (§20.4)', () => {
    const gradients = [...glass.matchAll(/^([^{}\n]*)\{[^{}]*linear-gradient/gm)].map((m) =>
      (m[1] ?? '').trim(),
    );
    const allowed = [".btn--primary,\n.btn:not([class*='btn--'])", '.workspace-mark'];
    for (const rule of gradients) {
      expect(
        allowed.some((a) => a.includes(rule) || rule.includes('.workspace-mark')),
        `градиент у «${rule}»: §20.4 разрешает его только главной кнопке и знаку`,
      ).toBe(true);
    }
  });
});
