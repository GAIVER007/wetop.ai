import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож правила DESIGN.md §15: системных окон браузера на экранах стойки нет.
 *
 * `window.confirm` не показывает ни суммы штрафа, ни последствия, не переводится и не оформляется —
 * вместо него окно подтверждения `ConfirmDialog` через хук `useConfirm` (§8, срез 7.3). План
 * дизайн-системы (`plans/design-system-2026-09-14.md`, шаг 8) велит проверять это тестом, а не глазами:
 * иначе следующий экран снова напишет `window.confirm`, и разнобой вернётся.
 *
 * `window.prompt` в списке нет намеренно: на карточке брони им вводят время раннего заезда и позднего
 * выезда, а окна ввода в дизайн-системе пока нет — появится вместе со срезом 7.4.
 */
const SRC = resolve(__dirname);
const FORBIDDEN = [/\bwindow\.confirm\s*\(/, /(?<![\w.])confirm\s*\(\s*['"`]/];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * Срез 7.4: правила §6 и §14, которые проверяются по тексту файлов, а не глазами.
 *  — капс (`text-transform: uppercase`) в CSS — кроме значения поля ввода (`.inp--upper`: код
 *    гражданства ISO пишется заглавными по смыслу) и первой буквы (`::first-letter`, это не капс);
 *  — шрифт мельче 12 px — шкала §6 начинается с 12;
 *  — начертания 550 / 650 / 750 / 800 — в шкале только 400 / 500 / 600 / 700;
 *  — `formatMinor` на экранах: он печатает тиыны всегда, деньги стойки — `formatMoney` (§14);
 *    печатные формы (`print/`) не трогаем, там формат счёта.
 */
function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssFiles(path));
    else if (entry.name.endsWith('.css') && entry.name !== 'tokens.css') out.push(path);
  }
  return out;
}
const cssRules = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((block) => {
      const [selector = '', body = ''] = block.split('{');
      return { selector: selector.trim().split('\n').pop()?.trim() ?? '', body };
    });
const offenders = (test: (rule: { selector: string; body: string }) => boolean) =>
  cssFiles(SRC).flatMap((f) =>
    cssRules(f)
      .filter(test)
      .map((r) => `${relative(SRC, f)}: ${r.selector || '(без селектора)'}`),
  );

describe('DESIGN.md §6 и §14: шкалы и форматы держит тест, а не глаз (срез 7.4)', () => {
  it('капса в CSS нет — кроме значения поля ввода и первой буквы', () => {
    expect(
      offenders(
        (r) =>
          /text-transform:\s*uppercase/.test(r.body) &&
          !/\.inp--upper\b/.test(r.selector) &&
          !/::first-letter/.test(r.selector),
      ),
    ).toEqual([]);
  });
  it('шрифта мельче 12 px нет', () => {
    expect(offenders((r) => /font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px\b/.test(r.body))).toEqual([]);
  });
  it('начертания только из шкалы 400 / 500 / 600 / 700', () => {
    expect(offenders((r) => /font-weight:\s*(?:550|650|750|800)\b/.test(r.body))).toEqual([]);
  });
  it('литералов цвета в CSS стойки нет — цвет только токеном (§2; печатные формы не в счёт)', () => {
    expect(
      cssFiles(SRC)
        .filter((f) => !/\/print\//.test(f))
        .filter((f) =>
          /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(
            readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
          ),
        )
        .map((f) => relative(SRC, f)),
    ).toEqual([]);
  });
  it('деньги на экранах — formatMoney; formatMinor остался только счёту и печатным формам', () => {
    const guilty = tsxFiles(SRC)
      .filter((f) => !/\/print\//.test(f) && !/lib\/api\.ts$/.test(f) && !/lib\/money\.ts$/.test(f))
      .filter((f) => /\bformatMinor\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(guilty).toEqual([]);
  });
});

describe('DESIGN.md §15: системных окон подтверждения на экранах нет', () => {
  it('ни один экран не зовёт window.confirm — вопрос задаёт ConfirmDialog', () => {
    const guilty = tsxFiles(SRC)
      .filter((f) => {
        const text = readFileSync(f, 'utf8');
        // строки комментариев не в счёт: правило описано словами в самом компоненте и в этом тесте
        const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        return FORBIDDEN.some((re) => re.test(code));
      })
      .map((f) => relative(SRC, f));
    expect(guilty).toEqual([]);
  });
});
