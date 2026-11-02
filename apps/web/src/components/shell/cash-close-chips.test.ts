import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';

/**
 * «Забыли расход?» в «Закрыть смену» (инструкция гостиницы 01.11.2026): в английском две кнопки читались одинаково
 * «+ Other» («Прочее» и «Другое»). Кнопка своей статьи подписана иначе, чем любая частая статья.
 */
describe('close shift: forgot-expense chips are distinct in English', () => {
  it('the custom-category chip does not repeat a default category', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'cash-shift-forms.tsx'), 'utf8');
    const block = src.slice(src.indexOf('data-testid="cash-close-chips"'));
    const defaults = [...block.slice(0, block.indexOf('.slice(0, 4)')).matchAll(/msg\('([^']+)'\)/g)].map((m) => m[1]!);
    const custom = /\+ \{t\('([^']+)'\)\}\s*<\/button>\s*<\/div>/.exec(block)?.[1];
    expect(custom).toBeTruthy();
    const dict = en;
    const word = (ru: string) => dict[ru] ?? ru;
    expect(defaults.map(word)).not.toContain(word(custom!));
  });
});
