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
