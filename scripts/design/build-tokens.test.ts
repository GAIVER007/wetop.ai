import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTRAST_FILE,
  CSS_FILE,
  buildContrastMd,
  buildTokensCss,
  contrastReport,
  contrastRatio,
  loadTokens,
  parseTokens,
  toCss,
} from './build-tokens';

const ROOT = resolve(__dirname, '../..');
const tree = loadTokens(ROOT);
/** Сам файл, до разбора: правила имён DTCG проверяются по исходному дереву, а не по нашему виду токенов. */
const raw = JSON.parse(readFileSync(resolve(ROOT, 'design/tokens.json'), 'utf8')) as unknown;

/**
 * Пары, которые не проходят порог сегодня. Значения токенов на шаге 2 не менялись (ADR-048, Д2), поэтому
 * список закреплён: новое нарушение валит тест, молча исправленное — тоже (тогда его надо отсюда убрать).
 * Закрываются срезом 7.4 плана: граница поля 3:1 (WCAG 1.4.11); рамки панелей, строк и сообщений —
 * декоративные, порог 3:1 у них справочный (DESIGN.md §10). «Отменить» на бледно-красном (4,48) закрыто
 * 16.09 перекраской --danger-soft светлой темы в #fff3f5 (4,57) — единственная перекраска шага 2–4.
 */
const KNOWN_GAPS = [
  'light: color.semantic.border / color.semantic.surface',
  'light: color.semantic.border-soft / color.semantic.surface',
  'light: color.semantic.warning-border / color.semantic.warning-bg',
  'light: color.semantic.danger-border / color.semantic.danger-soft',
  'dark: color.semantic.border / color.semantic.surface',
  'dark: color.semantic.border-soft / color.semantic.surface',
  'dark: color.semantic.warning-border / color.semantic.warning-bg',
  'dark: color.semantic.danger-border / color.semantic.danger-soft',
  'contrast: color.semantic.border-soft / color.semantic.surface',
  'contrast: color.semantic.warning-border / color.semantic.warning-bg',
  'contrast: color.semantic.danger-border / color.semantic.danger-soft',
];

describe('tokens.css генерируется из design/tokens.json', () => {
  it('контрастная тема задаёт светлый фон даже внутри тёмной темы', () => {
    const block = buildTokensCss(tree).split("[data-theme='contrast'] {")[1]!.split('}')[0]!;
    expect(block).toContain('--bg: #e9f0f8;');
    expect(block).toContain('--surface: #ffffff;');
    expect(block).toContain('--on-primary: #ffffff;');
  });
  it('файл на диске совпадает с выводом генератора (ручная правка — красный тест)', () => {
    expect(readFileSync(resolve(ROOT, CSS_FILE), 'utf8')).toBe(buildTokensCss(tree));
  });
  it('design/contrast.md совпадает с расчётом', () => {
    expect(readFileSync(resolve(ROOT, CONTRAST_FILE), 'utf8')).toBe(
      buildContrastMd(contrastReport(tree)),
    );
  });
  it('имена переменных прежние: ни одна var(--…) стойки не осталась без определения', () => {
    // только стойка: у главной wetop.ai (apps/site) свои токены
    const files = execFileSync(
      'git',
      ['ls-files', '--', 'apps/web/src/*.css', 'apps/web/src/*.tsx'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    )
      .split('\n')
      .filter(Boolean);
    const used = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(resolve(ROOT, f), 'utf8').matchAll(/var\((--[a-z0-9-]+)/g))
        used.add(m[1]!);
    }
    const defined = new Set(tree.tokens.map((t) => t.cssVar));
    // переменные, которые страницы объявляют сами: локальные размеры сетки и цвет точки бейджа
    const local = new Set([
      '--dot',
      '--min',
      '--week-unit-width',
      '--month-unit-width',
      '--month-min-width',
      '--board-caption-end', // board.css: место под меню брони, 8 px без меню на узкой сетке
      '--board-head-real', // board.css: фактическая высота шапки дат, замер из board-grid.tsx
      '--board-unit-real', // board.css: фактическая ширина колонки мест — к ней липнет имя длинной брони
      '--chart-', // `var(--chart-${n})` в daily-chart.tsx — шаблон, а не имя
      '--space-', // `var(--space-${n})` на странице /design-system — тоже шаблон
      '--text-', //  `var(--text-${s})` там же
    ]);
    const missing = [...used].filter((v) => !defined.has(v) && !local.has(v)).sort();
    expect(missing).toEqual([]);
  });
});

describe('design/tokens.json', () => {
  it('граница поля различима на поверхности в светлой и тёмной теме (редизайн A2)', () => {
    const rows = contrastReport(tree, ['light', 'dark']).filter(
      (row) => row.fg === 'color.semantic.border-input',
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.ratio, `граница поля: ${row.theme}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('темы объявлены, у каждого семантического цвета есть тёмное значение', () => {
    expect(Object.keys(tree.themes)).toEqual(['light', 'dark', 'contrast', 'print']);
    const colors = tree.tokens.filter((t) => t.type === 'color');
    const noDark = colors.filter((t) => !('dark' in t.values)).map((t) => t.path);
    expect(noDark).toEqual([]);
  });
  it('отступы только из шкалы 4, 8, 16, 24, 32, 40, 48, 64', () => {
    const scale = [4, 8, 16, 24, 32, 40, 48, 64];
    const spaces = tree.tokens.filter((t) => t.cssVar.startsWith('--space-'));
    expect(spaces.length).toBe(scale.length);
    for (const t of spaces) {
      const value = (t.values['light'] as { value: number }).value;
      expect(scale, t.cssVar).toContain(value);
      expect(t.cssVar).toBe(`--space-${value / 4}`);
    }
  });
  it('шрифт не мельче 12 px', () => {
    for (const t of tree.tokens.filter(
      (x) => x.type === 'dimension' && x.cssVar.startsWith('--text-'),
    )) {
      expect((t.values['light'] as { value: number }).value).toBeGreaterThanOrEqual(12);
    }
  });
  /**
   * Имена по спецификации DTCG 2025.10 (раздел «Character restrictions», сверено 20.09.2026 —
   * `design/docs/README.md`). `$` в начале отведён под свойства токена, `{`, `}` и `.` — под
   * синтаксис ссылок, поэтому имя с ними делает файл нечитаемым для чужого инструмента.
   * Своими глазами этого не увидеть: наш генератор такие имена проглатывает.
   */
  it('имена токенов и групп годятся по DTCG: без $ в начале, без фигурных скобок и точки', () => {
    const bad: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (typeof node !== 'object' || node === null) return;
      const entries = Object.entries(node as Record<string, unknown>);
      if (entries.some(([k]) => k === '$value')) return;
      for (const [name, child] of entries) {
        if (name.startsWith('$')) continue;
        if (/[{}.]/.test(name)) bad.push(`${path}${name}`);
        walk(child, `${path}${name}.`);
      }
    };
    walk(raw, '');
    expect(bad).toEqual([]);
  });

  /** Тип не угадывается по значению (DTCG: «Tools MUST NOT attempt to guess the type»). */
  it('у каждого листа есть $type — свой или унаследованный от группы', () => {
    const missing: string[] = [];
    const walk = (node: unknown, path: string, inherited: unknown): void => {
      if (typeof node !== 'object' || node === null) return;
      const row = node as Record<string, unknown>;
      const type = row['$type'] ?? inherited;
      if ('$value' in row) {
        if (type === undefined) missing.push(path);
        return;
      }
      for (const [name, child] of Object.entries(row)) {
        if (name.startsWith('$')) continue;
        walk(child, path ? `${path}.${name}` : name, type);
      }
    };
    walk(raw, '', undefined);
    expect(missing).toEqual([]);
  });

  it('ссылка на несуществующий токен и цикл — ошибка с путём', () => {
    expect(() =>
      parseTokens({
        $extensions: { 'kz.wetop.themes': { light: { selector: ':root', colorScheme: 'light' } } },
        a: { $type: 'color', $value: '{b}' },
      }),
    ).toThrow(/несуществующий токен \{b\}/);
    expect(() =>
      parseTokens({
        $extensions: { 'kz.wetop.themes': { light: { selector: ':root', colorScheme: 'light' } } },
        a: { $type: 'color', $value: '{b}' },
        b: { $type: 'color', $value: '{a}' },
      }),
    ).toThrow(/цикл ссылок/);
  });
  it('сериализация: цвет с прозрачностью — rgba, размер — px, тень целиком', () => {
    expect(
      toCss('color', { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' }),
    ).toBe('#ffffff');
    expect(toCss('color', { colorSpace: 'srgb', components: [1, 1, 1], alpha: 0.85 })).toBe(
      'rgba(255, 255, 255, 0.85)',
    );
    expect(toCss('dimension', { value: 38, unit: 'px' })).toBe('38px');
    expect(toCss('fontFamily', ['-apple-system', 'Segoe UI', 'sans-serif'])).toBe(
      "-apple-system, 'Segoe UI', sans-serif",
    );
  });
});

describe('контраст', () => {
  it('формула WCAG: чёрный на белом 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });
  it('все пары проходят порог, кроме закреплённого списка известных нарушений', () => {
    const rows = contrastReport(tree);
    const failing = rows.filter((r) => !r.ok).map((r) => `${r.theme}: ${r.fg} / ${r.bg}`);
    expect(failing).toEqual(KNOWN_GAPS);
  });
  it('контрастная тема: текст и границы полей проходят, декоративные линии — как в светлой', () => {
    const rows = contrastReport(tree, ['contrast']);
    const failing = rows.filter((r) => !r.ok).map((r) => `${r.fg} / ${r.bg}`);
    expect(failing).toEqual([
      'color.semantic.border-soft / color.semantic.surface',
      'color.semantic.warning-border / color.semantic.warning-bg',
      'color.semantic.danger-border / color.semantic.danger-soft',
    ]);
  });
});
