import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * «Все бизнесы» в один экран (аудит кабинета 31.10.2026; владелец 01.11.2026: «без лишних обрезов на один экран»):
 * месяц в шапке, выручка за полгода в карточке итога своей валюты, отдельного блока «Требуют решения» нет.
 */
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./owner.css', import.meta.url), 'utf8');

describe('«Все бизнесы» в один экран', () => {
  it('месяц в шапке страницы, график в карточке итога', () => {
    expect(page).toContain('actions={<MonthPicker');
    expect(page).toContain('{chartOf(x.currency)}');
    expect(page).not.toContain('owner__pair');
  });
  it('карточка итога: суммы и график рядом, на узком экране друг под другом', () => {
    const rule = css.slice(css.indexOf('.owner__total {'), css.indexOf('}', css.indexOf('.owner__total {')));
    expect(rule).toContain('grid-template-columns: repeat(auto-fit');
  });
});
