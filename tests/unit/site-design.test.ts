import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож правил главной wetop.ai (DESIGN.md §19, ADR-070).
 *
 * Стойку держит `design-slop.test.ts` по `apps/web/src`; здесь — сайт (`apps/site/src`), у которого свои
 * правила: стекло, лестница отступов, токены цвета. Тест читает исходники и проверяет то, что можно
 * поймать чтением, без снимков и браузера:
 *
 *   1. цвет — только через токены (литерал допустим лишь в `tokens.css`, где токены и объявляются);
 *   2. отступ — только из лестницы §19.3;
 *   3. радиус — только токен (плюс круг, pill и «без скругления»);
 *   4. текст — не мельче 12 px;
 *   5. каждый блок страницы назван в DESIGN.md §19.5, и наоборот: в §19.5 нет блоков, которых нет в коде.
 *
 * Правило 5 — главное: новый блок нельзя добавить молча, сначала строка в DESIGN.md. Снимок нарушений
 * тесту не нужен: на 23.09.2026 их ноль, и так и должно остаться.
 *
 * Исключения ровно два, оба названы в §19.3 и §19.4:
 *   - макеты первого экрана (`.mockup*` — шахматка, `.ops*` — экран «Сегодня») — иллюстрации со своей мелкой
 *     сеткой, а не компоненты страницы;
 *   - `.visually-hidden` — общепринятый приём с `margin: -1px`.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const SITE = resolve(ROOT, 'apps/site/src');
const GLOBALS = resolve(SITE, 'app/globals.css');
const TOKENS = resolve(SITE, 'app/tokens.css');
const DESIGN = resolve(ROOT, 'DESIGN.md');

/** Лестница отступов сайта (DESIGN.md §19.3): шаг 2 px до 16, дальше 4 px. */
const SPACE_SCALE = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64]);
const RADIUS_LITERALS = new Set(['50%', '999px', '0', 'inherit']);
const MIN_FONT_REM = 0.75; // 12 px

type Rule = { selector: string; body: string };

/** Грубый разбор CSS: `селектор { тело }`. Вложенности в файле нет, `@media` пропускаем по имени. */
function rules(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({
      selector: (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim(),
      body: m[2] ?? '',
    }))
    .filter((r) => r.selector !== '' && !r.selector.startsWith('@'));
}

/** Макеты живут по своим правилам (§19.4): у них сетка мельче страницы. `.ops*` — экран «Сегодня» внутри `.mockup`. */
const isMockup = (selector: string) => /\.(mockup|ops)(?![a-z0-9-])/.test(selector);

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) return walk(full, ext);
    return ext.test(name) ? [full] : [];
  });
}

const globals = readFileSync(GLOBALS, 'utf8');
const design = readFileSync(DESIGN, 'utf8');
const here = (file: string) => relative(ROOT, file);

describe('главная wetop.ai — правила DESIGN.md §19', () => {
  it('цвет только через токены: литерала нет нигде, кроме tokens.css', () => {
    // `app/layout.tsx` — второе разрешённое место (§19.2): метатег темы браузера, он проверяется ниже
    const files = [GLOBALS, ...walk(SITE, /\.tsx$/).filter((f) => !f.endsWith('app/layout.tsx'))];
    const found: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of src.matchAll(/(?<![\w-])#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)) {
        const line = src.slice(0, m.index).split('\n').length;
        found.push(`${here(file)}:${line} — ${m[0]}`);
      }
    }
    expect(found, 'цвет мимо токенов (DESIGN.md §19.2)').toEqual([]);
    // сам файл токенов литералы, конечно, содержит — иначе токенам неоткуда взяться
    expect(readFileSync(TOKENS, 'utf8')).toMatch(/#[0-9a-fA-F]{6}/);
  });

  /*
   * Цвет строки браузера (`viewport.themeColor`) переменных не понимает — там обязан стоять литерал.
   * Значит, он живёт отдельной жизнью и легко расходится с фоном страницы: 23.09.2026 так и было,
   * страница уже была стеклянной, а строка браузера — от прежней палитры. Поэтому сверяем с `--bg`.
   */
  it('цвет строки браузера совпадает с фоном страницы в обеих темах', () => {
    const tokens = readFileSync(TOKENS, 'utf8');
    const light = /:root\s*\{[\s\S]*?--bg:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1];
    const dark = /prefers-color-scheme:\s*dark[\s\S]*?--bg:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1];
    const layout = readFileSync(resolve(SITE, 'app/layout.tsx'), 'utf8');
    const themeColors = [...layout.matchAll(/color:\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]);
    expect([light, dark], 'в tokens.css не нашлись --bg обеих тем').toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    expect(themeColors, 'themeColor в app/layout.tsx разошёлся с --bg (DESIGN.md §19.2)').toEqual([
      light,
      dark,
    ]);
  });

  it('отступы — только из лестницы §19.3', () => {
    const found: string[] = [];
    for (const rule of rules(globals)) {
      if (isMockup(rule.selector) || rule.selector.includes('.visually-hidden')) continue;
      for (const m of rule.body.matchAll(
        /(?:^|[;\s])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?\s*:\s*([^;]+)/g,
      )) {
        for (const value of (m[1] ?? '').trim().split(/\s+/)) {
          const px = /^-?(\d+(?:\.\d+)?)px$/.exec(value);
          if (px && !SPACE_SCALE.has(Number(px[1]))) {
            found.push(`${rule.selector} — ${value}`);
          }
        }
      }
    }
    expect(found, 'отступ вне лестницы 0/2/4/…/16/20/…/64 (DESIGN.md §19.3)').toEqual([]);
  });

  it('радиус — только токен, круг, pill или «без скругления»', () => {
    const found: string[] = [];
    for (const rule of rules(globals)) {
      if (isMockup(rule.selector)) continue;
      for (const m of rule.body.matchAll(/border-radius\s*:\s*([^;]+)/g)) {
        const value = (m[1] ?? '').trim();
        const parts = value.split(/\s+/);
        if (parts.every((part) => part.startsWith('var(') || RADIUS_LITERALS.has(part))) continue;
        found.push(`${rule.selector} — ${value}`);
      }
    }
    expect(found, 'радиус мимо токенов (DESIGN.md §19.4)').toEqual([]);
  });

  it('текст не мельче 12 px', () => {
    const found: string[] = [];
    for (const rule of rules(globals)) {
      if (isMockup(rule.selector)) continue;
      for (const m of rule.body.matchAll(/font-size\s*:\s*([0-9.]+)rem/g)) {
        if (Number(m[1]) < MIN_FONT_REM) found.push(`${rule.selector} — ${m[1]}rem`);
      }
    }
    expect(found, 'шрифт мельче 12 px (DESIGN.md §19.6)').toEqual([]);
  });

  /*
   * Реестр блоков. Слева — имя блока в §19.5 (первая ячейка строки таблицы в обратных кавычках),
   * справа — корневые классы страницы в globals.css. Корневым считаем класс верхнего уровня:
   * `.hero__badge` относится к блоку `.hero`, `.card__title` — к `.card`.
   */
  it('каждый блок страницы назван в DESIGN.md §19.5 — и наоборот', () => {
    const section = /## 19\.5[^\n]*\n([\s\S]*?)(?=\n## |\n---\n)/.exec(design);
    expect(section, 'в DESIGN.md нет раздела 19.5 с реестром блоков').not.toBeNull();
    // первая ячейка строки таблицы; в ней может стоять несколько классов через запятую
    const documented = new Set(
      [...(section?.[1] ?? '').matchAll(/^\|([^|]*)\|/gm)].flatMap((row) =>
        [...(row[1] ?? '').matchAll(/`(\.[a-z0-9-]+)`/g)].map((m) => m[1]!),
      ),
    );

    const inCode = new Set<string>();
    for (const rule of rules(globals)) {
      for (const m of rule.selector.matchAll(/\.([a-z][a-z0-9-]*)/g)) {
        const name = m[1]!;
        // `block__element` и `block--modifier` принадлежат блоку `block`
        inCode.add(`.${name.split('__')[0]!.split('--')[0]!}`);
      }
    }

    const undocumented = [...inCode].filter((name) => !documented.has(name)).sort();
    const stale = [...documented].filter((name) => !inCode.has(name)).sort();
    expect(undocumented, 'блок есть в коде, но не описан в DESIGN.md §19.5').toEqual([]);
    expect(stale, 'блок описан в DESIGN.md §19.5, но его нет в коде').toEqual([]);
  });
});
