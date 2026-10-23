import { describe, expect, it } from 'vitest';
import { kk } from './kk';
import { ru } from './ru';

/**
 * Каркас казахских страниц (аудит 22.10.2026, P1-12): шапка, меню и подвал /kk/for/* были на русском,
 * потому что брали `nav`, `footer` и `a11y` из русского словаря. Здесь каждая строка каркаса переведена.
 */
const KK_LETTERS = /[әғқңөұүһі]/i;

describe('казахский словарь: шапка и подвал', () => {
  const same = (section: Record<string, string>, base: Record<string, string>, skip: string[] = []) =>
    Object.keys(base).filter((key) => !skip.includes(key) && section[key] === base[key]);

  it('пункты шапки и меню не совпадают с русскими', () => {
    expect(same(kk.nav, ru.nav, ['blog'])).toEqual([]);
  });
  it('подвал переведён целиком', () => {
    expect(same(kk.footer, ru.footer)).toEqual([]);
  });
  it('подписи для программ чтения переведены (кроме названий языков)', () => {
    expect(same(kk.a11y, ru.a11y, ['switchToKk', 'switchToRu'])).toEqual([]);
  });
  it('хотя бы часть строк каркаса с казахскими буквами, а не латиница или копия', () => {
    for (const text of [kk.nav.audience, kk.nav.login, kk.footer.privacy, kk.a11y.menu])
      expect(text).toMatch(KK_LETTERS);
  });
});
